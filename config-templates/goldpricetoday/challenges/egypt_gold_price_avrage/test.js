import { NavigationEngine } from '../../../../src/navigation/navigation-engine.js';
import { BrowserPool } from '../../../../src/core/browser/browser-pool.js';
import { logger } from '../../../../src/utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Derive __dirname equivalent in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testABTestingConfig() {
  logger.info('Starting A/B Testing config test...');

  const configPath = path.join(__dirname, 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  const browser = await BrowserPool.getInstance().getBrowser();
  if (!browser) {
    logger.error('Failed to get browser instance');
    return;
  }
  const page = await browser.newPage();

  try {
    const engine = new NavigationEngine(page, config.options);
    const result = await engine.executeFlow(config.startUrl, config.steps, config.variables);

    logger.info('Navigation flow executed.');
    console.log('Result:', JSON.stringify(result, null, 2));

    // Basic validation
    if (result.status === 'completed' && result.result?.abTestHeading?.heading) {
      logger.info(
        `SUCCESS: A/B Test completed and heading extracted: "${result.result.abTestHeading.heading}"`
      );
    } else {
      logger.error('FAILURE: A/B Test did not complete successfully or heading was not extracted.');
      console.error('Detailed Result:', result);
    }
  } catch (error) {
    logger.error(`Error executing A/B Testing flow: ${error.message}`);
    console.error(error);
  } finally {
    await page.close();
    // Important: Release browser only if you are managing the pool explicitly
    // await BrowserPool.getInstance().releaseBrowser(browser);
    // Or close the pool if this is the end of all tests
    // await BrowserPool.getInstance().close();
    logger.info('A/B Testing config test finished.');
  }
}

testABTestingConfig();
