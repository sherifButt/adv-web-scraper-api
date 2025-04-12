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
