# AI API Documentation

This document details the API endpoints related to AI features.

## Generate or Refine Scraping Configuration

Generates a new web scraping configuration based on a target URL and a natural language prompt, OR refines a previously generated configuration using user feedback. This process is asynchronous, and the status should be tracked using the Jobs API.

- **URL**: `/api/v1/ai/generate-config`
- **Method**: `POST`
- **Access**: Public

### Request Body

```json
{
  "url": "string",
  "prompt": "string",
  "previousJobId": "string (optional)",
  "fetchHtmlForRefinement": "boolean (optional, default: false)",
  "options": {
    "maxIterations": "number (optional, default: 3)",
    "testConfig": "boolean (optional, default: true)",
    "model": "string (optional, default: defined by environment)",
    "maxTokens": "number (optional, default: 8192)",
    "temperature": "number (optional, default: 0.7)",
    "browserOptions": {
      "headless": "boolean (optional, default: true)",
      "proxy": "boolean (optional, default: false)"
    },
    "interactionHints": ["string"] // Optional array of strings
  }
}
```

**Parameters:**

- `url` (string, required if `previousJobId` is not provided): The target URL of the website to scrape for initial generation. Ignored if `previousJobId` is provided (the URL from the previous job will be used).
- `prompt` (string, required):
    - For initial generation: A natural language description of the desired data and navigation steps.
    - For refinement (if `previousJobId` is provided): Natural language feedback or instructions on how to modify the configuration from the `previousJobId`.
- `previousJobId` (string, optional): The ID of a previously completed or failed `generate-config` job. If provided, this request will initiate a refinement process based on that job's last configuration and original prompt, using the current request's `prompt` field as user feedback.
- `fetchHtmlForRefinement` (boolean, optional, default: `false`): Only used when `previousJobId` is provided. If `true`, the worker will fetch fresh HTML content from the target URL before attempting the refinement. Useful if the feedback relates to selectors or page structure.
- `options` (object, optional): Options to control the generation or refinement process. If refining, these options will be merged with (and override) the options from the previous job.
  - `interactionHints` (string[], optional): An array of strings providing hints to the AI about necessary user interactions (e.g., "Click the 'Load More' button", "Paginate using the '.next-page' link"). Useful for guiding the AI on pages with dynamic content loading.
  - `maxIterations` (number): Maximum number of test-and-fix iterations the worker will perform if testing fails during initial generation or refinement.
  - `testConfig` (boolean): If `true`, the worker will attempt to execute the generated/refined configuration to verify it works. If `false`, the configuration is returned after generation/refinement and schema validation only.
  - `model` (string): The identifier of the LLM to use (e.g., 'gpt-4o-mini'). Must match a model supported by the configured AI service.
  - `maxTokens` (number): Maximum tokens allowed for the LLM response.
  - `temperature` (number): Sampling temperature for the LLM (0.0 to 1.0).
  - `browserOptions` (object): Options for the browser used during the testing phase.
    - `headless` (boolean): Run the test browser in headless mode.
    - `proxy` (boolean): Attempt to use a proxy from the Proxy Manager during testing.

### Success Response (202 Accepted)

Indicates that the generation or refinement job has been successfully queued.

```json
{
  "success": true,
  "message": "AI configuration generation job queued successfully", // or "AI configuration refinement job queued successfully"
  "data": {
    "jobId": "string",
    "statusUrl": "/api/v1/jobs/string"
  },
  "timestamp": "string (ISO 8601)"
}
```

**Fields:**

- `jobId`: The unique ID assigned to this generation/refinement job.
- `statusUrl`: The URL to poll for job status and results (using the [Jobs API](./queue-system.md)).

### Error Responses

- **400 Bad Request**: Missing required fields (e.g., `url` or `prompt` for initial generation) or invalid parameters.
  ```json
  {
    "success": false,
    "message": "Validation Error",
    "errors": [
      { "field": "url", "message": "\"url\" must be a valid URI" }
    ],
    "timestamp": "string (ISO 8601)"
  }
  ```
- **404 Not Found**: Provided `previousJobId` does not exist or the previous job data is incomplete (e.g., missing config or original prompt).
  ```json
  {
      "success": false,
      "message": "Previous job data not found or incomplete (missing config or originalPrompt) for ID: {previousJobId}",
      "timestamp": "string (ISO 8601)"
  }
  ```
- **500 Internal Server Error**: Failed to add the job to the queue or other server-side issue.
  ```json
  {
    "success": false,
    "message": "Failed to queue AI configuration job", // Message might vary slightly
    "error": "string (Error details)",
    "timestamp": "string (ISO 8601)"
  }
  ```

### Job Status and Result

Use the `statusUrl` (e.g., `GET /api/v1/jobs/{jobId}`) provided in the 202 response to track the job's progress. The job data will be updated with status messages like `generating`, `refining`, `testing`, `fixing`, and include `tokensUsed` and `estimatedCost`.

When the job `status` is `completed`, the `result` field in the job status response will contain the generated or refined scraping configuration JSON object.

If the job `status` is `failed`, the `failedReason` field will contain details about the failure (e.g., max iterations reached, persistent validation errors).
