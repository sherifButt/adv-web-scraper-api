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
