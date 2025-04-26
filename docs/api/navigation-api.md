# Navigation API Documentation

This document describes the endpoints for executing multi-step browser navigation flows, crawling websites, and retrieving navigation results.

## Base Path

`/api/v1/navigate`

## Common Response Format

All successful responses share a common structure:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": { /* Endpoint-specific data */ },
  "timestamp": "2023-10-27T10:00:00.000Z"
}
```

Error responses also follow a common structure:

```json
{
  "success": false,
  "message": "Operation failed",
  "error": "Detailed error message",
  "timestamp": "2023-10-27T10:00:00.000Z"
}
```

## Endpoints

### 1. Execute Navigation Flow

Queues a job to execute a predefined sequence of browser actions (steps) starting from a given URL.

- **Method:** `POST`
- **Path:** `/`
- **Description:** Initiates an asynchronous navigation job based on the provided steps. Returns a job ID to track progress.
- **Access:** Public

**Request Body:**

```json
{
  "startUrl": "https://example.com",
  "steps": [
    { "type": "goto", "url": "https://example.com/login" },
    { "type": "type", "selector": "#username", "text": "user" },
    { "type": "type", "selector": "#password", "text": "password" },
    { "type": "click", "selector": "button[type='submit']" },
    { "type": "waitForNavigation" },
    {
      "type": "extract",
      "name": "userData",
      "selector": ".user-profile",
      "fields": {
        "name": ".name",
        "email": ".email"
      }
    }
  ],
  "variables": {
    "searchTerm": "example product"
  },
  "options": {
    "timeout": 60000,
    "proxy": true,
    "solveCaptcha": true,
    "humanEmulation": true,
    "screenshots": true,
    "screenshotsPath": "/path/to/screenshots",
    "useSession": true,
    "alwaysCheckCaptcha": false,
    "javascript": true
  }
}
```

**Request Body Parameters:**

- `startUrl` (string, required): The initial URL to navigate to before executing steps.
- `steps` (array, required): An array of navigation step objects defining the actions to perform. See [Step Types](#step-types) below.
- `variables` (object, optional): Key-value pairs to substitute into step parameters (e.g., `{{variableName}}`).
- `options` (object, optional): Configuration options for the navigation engine.
    - `timeout` (number): Maximum time in milliseconds for the entire flow.
    - `proxy` (boolean | object): Use a proxy from the pool. Can be `true` or proxy configuration options.
    - `solveCaptcha` (boolean): Enable automatic CAPTCHA solving.
    - `humanEmulation` (boolean): Enable human-like interaction emulation.
    - `screenshots` (boolean): Capture screenshots during navigation.
    - `screenshotsPath` (string): Directory to save screenshots.
    - `useSession` (boolean): Enable session management (default: true if configured).
    - `alwaysCheckCaptcha` (boolean): Check for CAPTCHA on every page load.
    - `javascript` (boolean): Enable JavaScript execution (default: true).

**Successful Response (202 Accepted):**

Indicates the job was successfully queued.

```json
{
  "success": true,
  "message": "Navigation job queued successfully",
  "jobId": "nav_1678886400000",
  "statusUrl": "/api/jobs/nav_1678886400000",
  "timestamp": "2023-10-27T10:00:00.000Z"
}
```

**Error Responses:**

- **400 Bad Request:** Missing `startUrl` or `steps`.
- **500 Internal Server Error:** Failed to queue the job.

### 2. Retrieve Navigation Result

Fetches the result of a completed navigation job using its ID.

- **Method:** `GET`
- **Path:** `/:id`
- **Description:** Retrieves the data extracted or status of a specific navigation job.
- **Access:** Public

**Path Parameters:**

- `id` (string, required): The unique ID of the navigation job (obtained from the `POST /` response or listing endpoint).

**Successful Response (200 OK):**

```json
{
  "success": true,
  "message": "Navigation result retrieved successfully",
  "data": {
    "id": "nav_1678886400000",
    "url": "https://example.com",
    "status": "completed", // "completed", "failed", "partial"
    "stepsExecuted": 6,
    "data": {
      "userData": {
        "name": "John Doe",
        "email": "john.doe@example.com"
      }
    },
    "timestamp": "2023-10-27T10:05:00.000Z",
    "error": null // Contains error message if status is 'failed'
  },
  "timestamp": "2023-10-27T10:06:00.000Z"
}
```

**Error Responses:**

- **404 Not Found:** No result found for the given job ID.
- **500 Internal Server Error:** Error retrieving the result from storage.

### 3. Start Crawling Job

Initiates a crawling process starting from a URL, automatically discovering and scraping linked pages based on selectors.

- **Method:** `POST`
- **Path:** `/crawl`
- **Description:** Starts an asynchronous crawling job. The crawler follows links (typically pagination) and extracts data based on provided selectors. Returns an ID for the crawl job.
- **Access:** Public

**Request Body:**

```json
{
  "startUrl": "https://example.com/products",
  "maxPages": 10,
  "selectors": {
    "itemSelector": ".product-item",
    "fields": {
      "name": ".product-name",
      "price": ".product-price",
      "link": "a@href"
    }
  },
  "filters": {
    "nextPageSelector": "a.next-page",
    "waitForSelector": ".products-loaded"
  },
  "options": {
    "timeout": 300000,
    "proxy": true,
    "solveCaptcha": false,
    "humanEmulation": false,
    "screenshots": false,
    "useSession": false,
    "javascript": true
  }
}
```

**Request Body Parameters:**

- `startUrl` (string, required): The URL to begin crawling.
- `maxPages` (number, optional, default: 1): The maximum number of pages to crawl (including the start page).
- `selectors` (object, required): Defines how to extract data.
    - `itemSelector` (string, required): CSS selector for individual items on a page.
    - `fields` (object, required): Key-value pairs where the key is the data field name and the value is the CSS selector (or attribute selector like `a@href`).
- `filters` (object, optional): Controls crawling behavior.
    - `nextPageSelector` (string, optional, default: `a.next-page`): CSS selector for the link to the next page.
    - `waitForSelector` (string, optional, default: `networkidle`): A selector to wait for before extracting data on each page, or a navigation event like `networkidle`.
- `options` (object, optional): Similar to navigation flow options (see above).

**Successful Response (202 Accepted):**

Indicates the crawl job was started.

```json
{
  "success": true,
  "message": "Crawling job started",
  "data": {
    "id": "crawl_1678887000000",
    "startUrl": "https://example.com/products",
    "maxPages": 10,
    "status": "pending", // Initial status
    "timestamp": "2023-10-27T10:10:00.000Z"
  },
  "timestamp": "2023-10-27T10:10:00.000Z"
}
```

**Error Responses:**

- **400 Bad Request:** Missing `startUrl` or `selectors`.
- **500 Internal Server Error:** Failed to start the crawl job.

### 4. List Navigation Results

Retrieves a list of past navigation and crawling results, with filtering and pagination options.

- **Method:** `GET`
- **Path:** `/`
- **Description:** Lists historical navigation/crawl job results stored in the system.
- **Access:** Public

**Query Parameters:**

- `limit` (number, optional): Maximum number of results to return.
- `offset` (number, optional): Number of results to skip (for pagination).
- `status` (string, optional): Filter by job status (`completed`, `failed`, `partial`, `pending`).
- `url` (string, optional): Filter by the starting URL.
- `fromDate` (string, optional): Filter results created on or after this date (ISO 8601 format, e.g., `2023-10-26T00:00:00Z`).
- `toDate` (string, optional): Filter results created on or before this date (ISO 8601 format).

**Successful Response (200 OK):**

```json
{
  "success": true,
  "message": "Navigation results retrieved successfully",
  "data": [
    {
      "id": "crawl_1678887000000",
      "url": "https://example.com/products",
      "status": "completed",
      "stepsExecuted": 10, // Corresponds to pages crawled in this context
      "data": { /* Aggregated crawl data */ },
      "timestamp": "2023-10-27T10:20:00.000Z",
      "error": null
    },
    {
      "id": "nav_1678886400000",
      "url": "https://example.com",
      "status": "completed",
      "stepsExecuted": 6,
      "data": { /* Extracted navigation data */ },
      "timestamp": "2023-10-27T10:05:00.000Z",
      "error": null
    }
    // ... other results
  ],
  "count": 2, // Total number of results returned in this response
  "timestamp": "2023-10-27T10:30:00.000Z"
}
```

**Error Responses:**

- **500 Internal Server Error:** Failed to retrieve results from storage.

---

## Step Types

The `steps` array in the `POST /` request consists of objects, each defining an action. Key properties include:

- `type` (string, required): The type of action (e.g., `goto`, `click`, `type`, `extract`, `waitForSelector`, `waitForNavigation`, `scroll`, `evaluate`, `screenshot`, `solveCaptcha`, `paginate`).
- `selector` (string, optional): CSS selector for targeting elements (used by `click`, `type`, `extract`, `waitForSelector`, `scroll`, `paginate`).
- Other parameters depend on the `type`.

*(Note: A full definition of all step types and their parameters should ideally be in a separate, more detailed document or linked here.)* 