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

3. **AI Config Generation Jobs**
   - Receive URL and natural language prompt.
   - Interact with an AI model (LLM) to generate initial configuration.
   - Validate the generated configuration schema.
   - (Optional) Test the configuration using the Navigation Engine.
   - If testing fails, interact with the AI model again to fix the configuration based on errors.
   - Repeat test/fix loop up to a maximum number of iterations.
   - Store the final validated (and potentially tested) configuration.

### Error Handling
- Automatic retries for transient failures
- Exponential backoff for rate limits
- Dead letter queue for unrecoverable failures
- Comprehensive logging for debugging

## Validation Strategies

### Dual Library Approach
- **Joi**: Used for API request validation in route handlers (src/api/validators/)
  - Validates external input from clients
  - Integrates with Express middleware
  - Provides detailed error messages for API consumers

- **Zod**: Used for internal configuration validation (src/core/queue/generate-config-worker.ts)
  - Validates AI-generated scraping configurations
  - Enforces type safety for complex nested structures
  - Enables automatic type inference for TypeScript

Rationale:
- Separation of concerns between external API contracts and internal data structures
- Joi's middleware integration suits API validation needs
- Zod's type inference better supports AI-generated configurations
- No functional overlap between the two use cases

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

## AI Configuration Generation Flow

```mermaid
graph TD
    Client[Client/UI] -->|POST /api/v1/ai/generate-config (URL, Prompt)| API[API Server]
    API -->|Add Job 'generate-config'| RedisQueue[(Redis Queue)]
    RedisQueue --> GenWorker[Generate Config Worker]

    subgraph GenWorker Logic
        direction TB
        Start --> Init[Initialize (Iter=0, Status='Initializing')]
        Init --> FetchPage[Fetch Page (Optional)]
        FetchPage --> LoopStart{Iter < MaxIter?}
        LoopStart -- Yes --> BuildPrompt[Build LLM Prompt (Initial/Fix)]
        BuildPrompt --> CallLLM[Call LLM API (Track Tokens/Cost)]
        CallLLM --> ParseValidate[Parse & Validate Schema]
        ParseValidate -- Invalid --> HandleValidationError[Log Error, Set lastError/lastConfig, Status='Validation Failed']
        HandleValidationError --> LoopEnd[Increment Iter]
        ParseValidate -- Valid --> TestCheck{Test Config Enabled?}
        TestCheck -- No --> StoreResult[Store Config (StorageService)]
        TestCheck -- Yes --> TestConfig[Execute Config w/ NavEngine (Status='Testing')]
        TestConfig --> Evaluate{Test Successful?}
        Evaluate -- Yes --> StoreResult
        Evaluate -- No --> HandleTestFailure[Log Error, Set lastError/lastConfig, Status='Test Failed']
        HandleTestFailure --> LoopEnd
        StoreResult --> Success[End Job (Status='Completed')]
        LoopEnd --> LoopStart
        LoopStart -- No --> MaxIterFailure[End Job (Status='Failed - Max Iterations')]
        CallLLM -- API Error --> HandleGenericError[Log Error, Set lastError]
        FetchPage -- Error --> HandleGenericError
        HandleGenericError --> Failure[End Job (Failed)]
    end

    GenWorker --> Storage[(Storage Service)]
    GenWorker -- Update Status/Data --> RedisJobUpdate[Update Job Status/Data (Redis)]

    Client -->|GET /api/v1/jobs/:jobId| API
    API -->|Get Job State, Progress, Result| RedisQueue
    API -->|Get Result (Primary)| Storage
    Storage -->|Result| API
    RedisQueue -->|Result (Fallback)| API
    API -->|Return Config JSON / Status / Progress / Cost| Client
```

### AI Generation Components
1.  **API Endpoint (`/api/v1/ai/generate-config`)**: Receives URL and prompt, queues a `generate-config` job.
2.  **Queue (`config-generation-jobs`)**: Holds pending generation tasks.
3.  **Worker (`generate-config-worker.ts`)**:
    *   Orchestrates the generation process.
    *   Calls `AiService` for LLM interaction.
    *   Validates the generated JSON schema using Zod.
    *   Optionally calls `NavigationEngine` to test the generated config.
    *   Enters a fix loop if testing fails, providing errors back to `AiService`.
    *   Updates job status and progress frequently.
    *   Stores the final successful config using `StorageService`.
4.  **AI Service (`ai-service.ts`)**:
    *   Uses adapter pattern to support multiple LLM providers (OpenAI, DeepSeek)
    *   Builds prompts for initial generation and fixing.
    *   Routes requests to appropriate LLM adapter based on model selection.
    *   Parses the LLM response.
    *   Tracks token usage and calculates estimated cost for all supported models.
5.  **LLM Adapters**:
    *   Standardized interface (`llm-adapter.interface.ts`)
    *   OpenAI adapter for GPT models
    *   DeepSeek adapter for DeepSeek models
    *   Handles provider-specific API calls and response formats
6.  **Job Status (`/api/v1/jobs/:id`)**: Allows clients to poll for the status (`pending`, `generating`, `testing`, `fixing`, `completed`, `failed`), progress, cost, and final result (the generated config).
