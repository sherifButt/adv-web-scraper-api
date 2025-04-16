# AI API Documentation

This document details the API endpoints related to AI features.

## Generate Scraping Configuration

Generates a web scraping configuration based on a target URL and a natural language prompt. This process is asynchronous, and the status should be tracked using the Jobs API.

- **URL**: `/api/v1/ai/generate-config`
- **Method**: `POST`
- **Access**: Public

### Request Body

```json
{
  "url": "string",
  "prompt": "string",
  "options": {
    "maxIterations": "number (optional, default: 3)",
    "testConfig": "boolean (optional, default: true)",
    "model": "string (optional, default: 'gpt-4')",
    "maxTokens": "number (optional, default: 8192)",
    "temperature": "number (optional, default: 0.7)",
    "browserOptions": {
      "headless": "boolean (optional, default: true)",
      "proxy": "boolean (optional, default: false)"
    }
  }
}
```

**Parameters:**

- `url` (string, required): The target URL of the website to scrape.
- `prompt` (string, required): A natural language description of the desired data and navigation steps.
- `options` (object, optional): Options to control the generation process.
  - `maxIterations` (number): Maximum number of test-and-fix iterations the worker will perform if testing fails.
  - `testConfig` (boolean): If `true`, the worker will attempt to execute the generated configuration to verify it works. If `false`, the configuration is returned after initial generation and schema validation only.
  - `model` (string): The identifier of the LLM to use (e.g., 'gpt-4', 'gpt-3.5-turbo'). Must match a model supported by the configured AI service.
  - `maxTokens` (number): Maximum tokens allowed for the LLM response.
  - `temperature` (number): Sampling temperature for the LLM (0.0 to 1.0). Lower values are more deterministic, higher values are more creative.
  - `browserOptions` (object): Options for the browser used during the testing phase (if `testConfig` is true).
    - `headless` (boolean): Run the test browser in headless mode.
    - `proxy` (boolean): Attempt to use a proxy from the Proxy Manager during testing.

### Success Response (202 Accepted)

Indicates that the generation job has been successfully queued.

```json
{
  "success": true,
  "message": "AI configuration generation job queued successfully",
  "data": {
    "jobId": "string",
    "statusUrl": "/api/v1/jobs/string"
  },
  "timestamp": "string (ISO 8601)"
}
```

**Fields:**

- `jobId`: The unique ID assigned to this generation job.
- `statusUrl`: The URL to poll for job status and results (using the [Jobs API](./queue-system.md)).

### Error Responses

- **400 Bad Request**: Missing or invalid `url` or `prompt`.
  ```json
  {
    "success": false,
    "message": "URL is required and must be a string", // or "Prompt is required..." or "Invalid URL format"
    "error": "Missing or invalid parameter: url", // or "prompt" or "Invalid parameter format: url"
    "timestamp": "string (ISO 8601)"
  }
  ```
- **500 Internal Server Error**: Failed to add the job to the queue.
  ```json
  {
    "success": false,
    "message": "Failed to queue AI configuration generation job",
    "error": "string (Error details)",
    "timestamp": "string (ISO 8601)"
  }
  ```

### Job Status and Result

Use the `statusUrl` (e.g., `GET /api/v1/jobs/{jobId}`) provided in the 202 response to track the job's progress. The job data will be updated with status messages like `generating`, `testing`, `fixing`, and include `tokensUsed` and `estimatedCost`.

When the job `status` is `completed`, the `result` field in the job status response will contain the generated scraping configuration JSON object.

If the job `status` is `failed`, the `failedReason` field will contain details about the failure (e.g., max iterations reached, persistent validation errors).
