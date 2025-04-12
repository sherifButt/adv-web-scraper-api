# System Patterns: Advanced Web Scraper API

## Queue System Architecture

```mermaid
graph TD
    Client[Client] -->|HTTP Request| API[API Server]
    API -->|Queue Job| Redis[(Redis Queue)]
    Redis --> Worker1[Worker Process 1]
    Redis --> Worker2[Worker Process 2]
    Redis --> Worker3[Worker Process 3]
    Worker1 -->(1) Process Job|Worker1
    Worker1 -->(2) Store Results| Storage[(Storage)]
    Worker1 -->(3) Return Results|Redis
    Worker2 -->(1) Process Job|Worker2
    Worker2 -->(2) Store Results| Storage
    Worker2 -->(3) Return Results|Redis
    Worker3 -->(1) Process Job|Worker3
    Worker3 -->(2) Store Results| Storage
    Worker3 -->(3) Return Results|Redis
    Client -->|Check Status (GET /jobs/:id)| API
    API -->(A) Get Job State| Redis
    API -->(B) Try Get Results| Storage
    API -->(C) Fallback Get Results| Redis[job.returnvalue]
    Storage -->(B) Return Stored Results| API
    Redis -->(C) Return Job Return Value| API
    API -->|Return Status & Results| Client
```

### Key Components & Flow
1.  **API Server**: Receives HTTP requests (e.g., POST /navigate), validates input, creates a job in the Redis queue via `QueueService`, and returns a job ID and status URL (`/api/v1/jobs/:id`) to the client.
2.  **Redis Queue (BullMQ)**: Stores pending jobs, manages job state (waiting, active, completed, failed), handles retries, and stores the job's return value upon completion.
3.  **Worker Processes**: Poll Redis for jobs. When a job is received:
    *   Execute the core logic (e.g., `processNavigationJob`).
    *   Attempt to store the generated results in the configured `StorageService` using the `job.id` as the key.
    *   Return the generated results. BullMQ stores this in the `job.returnvalue` field in Redis.
    *   Update job status (handled by BullMQ).
4.  **Storage Service**: An abstraction layer (`StorageService`) managing different storage backends (Memory, File, Redis, MongoDB, API). Workers use `store(job.id, result)` to save data.
5.  **Job Status Check (Client -> API)**: The client polls `GET /api/v1/jobs/:id`.
6.  **Result Retrieval (API)**:
    *   The API route retrieves the `Job` object from Redis using `QueueService.getJobFromAnyQueue(id)`.
    *   It checks the `job.state`.
    *   If `completed`, it first attempts to retrieve results from `StorageService.retrieve(id)`.
    *   If storage retrieval fails (returns null), it falls back to checking `job.returnvalue` (retrieved from Redis).
    *   The found result (or null) is included in the API response to the client.

## Queue Implementation Details

### Job Types
1. **Scraping Jobs**
   - Process data extraction requests
   - Handle page loading and rendering
   - Execute extraction strategies
   - Transform and store results

2. **Navigation Jobs**  
   - Execute multi-step navigation flows
   - Handle conditional logic
   - Manage browser state
   - Process pagination

### Error Handling
- Automatic retries for transient failures
- Exponential backoff for rate limits
- Dead letter queue for unrecoverable failures
- Comprehensive logging for debugging

## Performance Considerations

1. **Worker Scaling**
   - Dynamic scaling based on queue depth
   - Resource-based throttling
   - Priority-based job processing

2. **Resource Management**
   - Browser instance pooling
   - Proxy rotation strategies
   - Memory and CPU monitoring

3. **Monitoring**
   - Queue depth metrics
   - Job processing times
   - Failure rates and patterns
   - Resource utilization
