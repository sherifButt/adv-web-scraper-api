# Technical Context: Advanced Web Scraper API

## Queue System Implementation

### Core Technologies
- **BullMQ**: Redis-based queue implementation
- **Redis**: Persistent queue storage
- **Node.js Worker Threads**: For job processing

### Configuration
```typescript
// Queue service configuration
interface QueueConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  defaultJobOptions: {
    attempts: number;
    backoff: {
      type: 'exponential';
      delay: number;
    };
    removeOnComplete: boolean;
    removeOnFail: boolean;
  };
  queues: {
    scraping: {
      concurrency: number;
      limiter?: RateLimiter;
    };
    navigation: {
      concurrency: number;
      priority: number;
    };
    // Added config generation queue
    configGeneration: {
        concurrency: number; // Lower concurrency for potentially long-running AI tasks
        timeout: number; // Longer timeout
    };
  };
}
```

### Worker Implementation (Navigation Example)
```typescript
// src/core/queue/navigation-worker.ts
import { Job } from 'bullmq';
import { logger } from '../../utils/logger.js';
import { BrowserPool } from '../browser/browser-pool.js';
import { NavigationEngine } from '../../navigation/navigation-engine.js';
import { StorageService } from '../../storage/index.js';

export async function processNavigationJob(job: Job): Promise<any> { // Worker returns results
  const { startUrl, steps, variables, options } = job.data;
  logger.info(`Starting navigation job ${job.id} for URL: ${startUrl}`);

  const browser = await BrowserPool.getInstance().getBrowser(/* ... */);
  const page = await browser.newPage();

  try {
    const engine = new NavigationEngine(page, options);
    const result = await engine.executeFlow(startUrl, steps, variables);
    logger.debug(`Navigation result for job ${job.id}:`, JSON.stringify(result, null, 2));

    if (!job.id) {
      logger.error('Job ID is missing, cannot store results.');
    } else {
      try {
        // Attempt to store results in configured StorageService
        await StorageService.getInstance().store({
          ...result,
          id: job.id,
          timestamp: new Date().toISOString(),
        });
        logger.debug(`Successfully stored results for job ${job.id}`);
      } catch (storageError) {
        logger.error(`Failed to store results for job ${job.id}: ...`);
      }
    }
    await page.close();
    logger.info(`Completed navigation job ${job.id} successfully`);
    return result; // Explicitly return result for job.returnvalue fallback
  } catch (error) {
    await page.close();
    logger.error(`Failed navigation job ${job.id}: ...`);
    throw error;
  } finally {
    await BrowserPool.getInstance().releaseBrowser(browser);
  }
}

// src/core/queue/queue-service.ts (Worker Registration)
// ...
this.createWorker('navigation-jobs', processNavigationJob); // Processor can return Promise<any>
// ...

// Worker setup options
const workerOptions = {
  connection: redisConfig,
  concurrency: 5,
  limiter: {
    max: 10,
    duration: 1000
  }
});
```

### API Integration
```typescript
// Queue service usage in API routes
router.post('/scrape', async (req, res) => {
  const job = await queueService.addJob('scraping-jobs', 'extract-data', req.body);

  res.status(202).json({
    jobId: job.id,
    statusUrl: `/jobs/${job.id}`
  });
});
```

## AI Configuration Generation Implementation

### Core Technologies & Libraries
- **Node.js**: Runtime environment
- **TypeScript**: Programming language
- **BullMQ**: Queue management for asynchronous job processing
- **Redis**: Backend for BullMQ
- **Zod**: Schema declaration and validation (used for validating generated config)
- **Playwright**: Used by the worker to test the generated configuration
- **LLM API Client**: (Placeholder) Client library for interacting with the chosen Large Language Model (e.g., OpenAI SDK). Requires API key (`OPENAI_API_KEY` environment variable).

### Configuration (`src/config/index.ts`)
```typescript
// Added AI configuration section
interface AiConfig {
  apiKey: string | null;
}

interface Config {
  // ... other config sections
  ai?: AiConfig;
}

export const config: Config = {
  // ... other config values
  ai: {
    apiKey: process.env.OPENAI_API_KEY || null,
  },
};
```

### Service (`src/core/ai/ai-service.ts`)
- Implemented as a Singleton (`AiService.getInstance()`).
- Reads API key from configuration/environment.
- **`generateConfiguration()`**: Builds initial prompt (system + user context including URL, prompt, optional HTML), calls LLM API (placeholder), parses JSON response, returns config and token usage.
- **`fixConfiguration()`**: Builds fixing prompt (system + user context including URL, original prompt, previous failed config, error log), calls LLM API (placeholder), parses JSON response, returns corrected config and token usage.
- **`calculateCost()`**: Calculates estimated cost based on tokens used and model pricing.
- Contains detailed system prompts defining the required JSON output structure and rules for the LLM.

### Worker (`src/core/queue/generate-config-worker.ts`)
- **`processGenerateConfigJob(job)`**: The main processor function for the `config-generation-jobs` queue.
- **Orchestration**: Manages the overall generate-test-fix loop.
- **State Management**: Tracks iteration count, token usage, cost, status messages, last config, and last error within the job data. Uses `job.updateData()` and `job.updateProgress()` frequently.
- **AI Interaction**: Calls `AiService.generateConfiguration()` or `AiService.fixConfiguration()`.
- **Schema Validation**: Uses Zod (`ScrapingConfigSchema`) to validate the basic structure of the JSON returned by the AI. If validation fails, logs the error and proceeds to the next fix iteration.
- **Testing (Optional)**: If `testConfig` option is true:
    - Launches a browser using `BrowserPool` (potentially with proxy).
    - Creates a `NavigationEngine` instance.
    - Executes the generated configuration using `navigationEngine.executeFlow()`.
    - Evaluates the result (checks for errors, basic data presence).
    - If the test fails, captures the error log for the next fix iteration.
- **Loop Control**: Continues iterating (up to `maxIterations`) if validation or testing fails. Exits successfully if testing passes or is disabled. Throws an error if max iterations are reached.
- **Result Storage**: Stores the final, successful configuration using `StorageService`.

### Queue (`src/core/queue/queue-service.ts`)
- A new queue named `config-generation-jobs` is created.
- The `processGenerateConfigJob` worker is registered to process jobs from this queue.
- Default job options include a longer timeout (e.g., 5 minutes) and potentially fewer retry attempts compared to navigation jobs.

### API Integration (`src/api/routes/ai.routes.ts`)
- New route file created.
- **`POST /api/v1/ai/generate-config`**:
    - Accepts `url` (string) and `prompt` (string) in the request body, along with optional `options`.
    - Performs basic validation on `url` and `prompt`.
    - Adds a job to the `config-generation-jobs` queue via `QueueService`.
    - Returns a standard 202 Accepted response with the `jobId` and `statusUrl` (`/api/v1/jobs/:jobId`).

### API Router (`src/api/routes/index.ts`)
- The `aiRoutes` router is mounted under the `/api/v1/ai` path.

## Monitoring and Management

### Key Metrics
1. **Queue Depth**: Number of pending jobs
2. **Processing Time**: Average job duration
3. **Failure Rate**: Percentage of failed jobs
4. **Retry Count**: Average retries per job

### Operational Commands
```bash
# Monitor queue status
npm run queue:monitor

# Pause processing
npm run queue:pause scraping-jobs

# Resume processing
npm run queue:resume scraping-jobs

# Clean completed jobs
npm run queue:clean -- --status completed --age 7d
```

## Proxy System Implementation

### Configuration
```typescript
// Proxy configuration in src/config/index.ts
interface ProxyConfig {
  enabled: boolean;
  sources: {
    type: string; // 'file' or 'api'
    path?: string; // Path to proxies.json if type is 'file'
    url?: string; // URL if type is 'api'
    apiKey?: string | null;
    refreshInterval?: number; // Optional refresh interval for API sources
  }[];
  testUrl: string; // URL used for health checks
  healthCheckInterval: number; // Interval in minutes for periodic health checks
}

// Proxy data is now loaded from proxies.json, which contains an array of objects
// matching the ProxyInfo interface defined in src/types/index.ts.
// Example structure within proxies.json:
// [
//   {
//     "ip": "51.15.196.107",
//     "port": "16379", // Note: Port is loaded as string, converted to number
//     "protocols": ["socks4"],
//     "country": "FR",
//     "city": "Paris",
//     "latency": 7.401,
//     "upTime": 11.18,
//     ... other fields from ProxyInfo
//   },
//   ...
// ]
```

### Proxy Manager Implementation (`src/core/proxy/proxy-manager.ts`)
```typescript
// Implemented as a Singleton
export class ProxyManager {
  private static instance: ProxyManager;
  private proxies: ProxyInfo[] = [];
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastProxyIndex = -1;
  private sessionProxies: Map<string, ProxyInfo> = new Map();

  // Core Methods:
  public static getInstance(): ProxyManager;
  public async loadProxies(): Promise<void>; // Loads from sources defined in config
  public listProxies(filters?: {...}): ProxyInfo[]; // Lists proxies with filtering
  public getProxyStats(): {...}; // Returns detailed statistics
  public async getProxy(options?: ProxyOptions): Promise<ProxyInfo | null>; // Gets next proxy based on criteria/rotation
  public reportProxyResult(proxy: ProxyInfo, success: boolean, responseTime?: number): void; // Updates internal success/response metrics
  public async checkProxyHealth(limit?: number): Promise<void>; // Checks health of a subset of proxies
  public async testProxy(options: ProxyOptions): Promise<{...}>; // Tests a specific proxy
  public async rotateProxy(options: ProxyOptions): Promise<ProxyInfo | null>; // Gets a new proxy based on criteria
  public async validateAllProxies(): Promise<Array<{...}>>; // Tests all loaded proxies
  public async cleanProxyList(minSuccessRate?: number): Promise<{...}>; // Removes proxies below internal success rate threshold
  public getHealthyProxyCount(): number; // Counts proxies above internal success rate threshold
  public dispose(): void; // Clears health check interval

  // Private helpers for loading from JSON file and API
  private async loadProxiesFromJsonFile(filePath: string): Promise<ProxyInfo[]>;
  private async loadProxiesFromApi(url: string, apiKey?: string | null): Promise<ProxyInfo[]>;
  private async checkSingleProxy(proxy: ProxyInfo): Promise<void>;
}
```

### API Integration (`src/api/routes/proxy.routes.ts`)
```typescript
// Exposes proxy functionality via REST endpoints

// GET /api/v1/proxy/list
// - Lists proxies with extensive filtering options via query parameters
// - Returns full ProxyInfo objects

// GET /api/v1/proxy/stats
// - Returns aggregated statistics (total, healthy count, counts by protocol/country/anonymity, avg latency/response time/uptime)

// POST /api/v1/proxy/test
// - Tests a specific proxy provided in the request body (ip, port)
// - Returns success status, response time, and error message if failed

// POST /api/v1/proxy/rotate
// - Gets the next available proxy based on filtering criteria in the request body
// - Returns details of the selected proxy or 404 if none found

// POST /api/v1/proxy/clean
// - Removes proxies from the internal list based on their calculated internal success rate
// - Returns counts of removed and remaining proxies
```

## Validation Libraries

### Joi (v17.9.1)
- Used for API request validation in route handlers
- Key features:
  - Schema-based validation
  - Rich error messages
  - Middleware integration
- Usage locations:
  - src/api/validators/proxy.validator.ts
  - src/api/validators/session.validator.ts

### Zod (v3.24.3)
- Used for internal configuration validation
- Key features:
  - TypeScript-first schema validation
  - Automatic type inference
  - Complex nested structure validation
- Usage locations:
  - src/core/queue/generate-config-worker.ts

## Best Practices

1. **Job Design**
   - Keep jobs small and focused
   - Split large jobs into smaller units
   - Avoid long-running synchronous operations

2. **Error Handling**
   - Implement exponential backoff for retries
   - Use dead letter queue for unrecoverable failures
   - Include detailed error context

3. **Resource Management**
   - Limit concurrent jobs per worker
   - Implement graceful shutdown
   - Monitor memory usage
