# Queue System API Documentation

## Common Response Format

All queue-enabled endpoints return responses in this format:

```json
{
  "success": true,
  "message": "Job queued successfully",
  "jobId": "job-123456",
  "statusUrl": "/api/jobs/job-123456",
  "timestamp": "2025-12-04T08:35:54.000Z"
}
```

## Job Status Response (`GET /api/v1/jobs/:id`)

When checking job status via the status URL, the response includes the current state and, if completed, the results.

```json
{
  "success": true,
  "message": "Job status retrieved",
  "data": {
    "id": "job-123456", // The Job ID
    "status": "completed", // Current status (see below)
    "progress": 0, // Job progress (if reported by worker)
    "result": { /* Extracted data or null */ }, // See Result Retrieval below
    "estimatedCost": 0.15, // Cost estimation when available
    "numberInQueue": 3, // Position in queue (only for waiting/active jobs)
    "createdAt": 1744450886841, // Timestamp (ms) when job was created
    "completedAt": 1744450939697, // Timestamp (ms) when job finished (if completed/failed)
    "failedReason": null // Reason for failure (if status is 'failed')
  },
  "timestamp": "2025-04-12T09:42:36.752Z" // Timestamp of this API response
}
```

### Possible Status Values (`status`)

The `status` field reflects the BullMQ job state:

- `waiting`: Job is in the queue waiting to be processed.
- `active`: Job is currently being processed by a worker.
- `completed`: Job finished successfully.
- `failed`: Job failed after exhausting retries. Check `failedReason`.
- `delayed`: Job is scheduled for future processing (e.g., due to backoff).
- `paused`: The queue is paused.
- `stuck`: Job processing exceeded a timeout (requires manual intervention or cleanup).

### Result Retrieval (`result`)

- When a job `status` is `completed`, the API attempts to retrieve the results.
- **Primary Method**: It first queries the configured `StorageService` using the `job.id`.
- **Fallback Method**: If no results are found in the `StorageService`, it checks the `job.returnvalue` field stored by BullMQ in Redis (this contains the value returned by the worker function).
- If neither method yields results, the `result` field will be `null`. Check worker logs and storage configuration if results are expected but missing.

## Jobs List Response (`GET /api/v1/jobs`)

Retrieves a paginated list of all jobs across all queues or filtered by a specific queue.

```json
{
  "success": true,
  "message": "Jobs retrieved",
  "data": [
    {
      "queue": "scraping-jobs",
      "jobs": [
        {
          "id": "job-123456",
          "status": "completed",
          "progress": 100,
          "createdAt": 1744450886841,
          "completedAt": 1744450939697,
          "failedReason": null
        }
        // More jobs in this queue...
      ]
    },
    // More queues...
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalJobs": 45,
    "totalPages": 5
  },
  "timestamp": "2025-04-12T09:42:36.752Z"
}
```

### Query Parameters

- `page`: Page number (default: 1)
- `limit`: Number of jobs per page (default: 10)
- `queue`: Filter jobs by specific queue name (optional)
- `name`: Filter jobs by specific job name (optional)

## Error Responses

### Job Not Found

```json
{
  "success": false,
  "message": "Job not found",
  "error": "No job found with ID: job-123456",
  "timestamp": "2025-12-04T08:36:15.000Z"
}
```

### Queue Full

```json
{
  "success": false,
  "message": "Queue is full",
  "error": "Maximum queue capacity reached",
  "timestamp": "2025-12-04T08:36:15.000Z"
}
```

## Rate Limiting

When rate limited, responses include:

```json
{
  "success": false,
  "message": "Too many requests",
  "error": "Rate limit exceeded",
  "retryAfter": 30,
  "timestamp": "2025-12-04T08:36:15.000Z"
}
```

## Best Practices

### 1. Client Implementation
- Always check job status via the statusUrl
- Implement polling with exponential backoff
- Handle rate limiting gracefully
- Cache completed job results

### 2. Error Recovery
- Check for transient failures
- Implement automatic retries for network issues
- Provide user feedback for unrecoverable errors

### 3. Performance
- Minimize polling frequency
- Use webhooks if available
- Batch requests when possible
- Use pagination parameters for listing jobs
- Filter by queue name when monitoring specific job types
