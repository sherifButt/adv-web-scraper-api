import { NavigationEngine } from '../../../../src/navigation/navigation-engine.js';
import { BrowserPool } from '../../../../src/core/browser/browser-pool.js';
import { logger } from '../../../../src/utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Derive __dirname equivalent in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testBasicAuthConfig() {
  logger.info('Starting Basic Auth config test...');

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
    const expectedMessage = 'Congratulations! You must have the proper credentials.';
    if (
      result.status === 'completed' &&
      result.result?.basicAuthResult?.message?.trim() === expectedMessage
    ) {
      logger.info('SUCCESS: Basic Auth test completed and message extracted successfully.');
    } else {
      logger.error(
        'FAILURE: Basic Auth test did not complete successfully or message was incorrect.'
      );
      console.error('Detailed Result:', result);
    }
  } catch (error) {
    logger.error(`Error executing Basic Auth flow: ${error.message}`);
    console.error(error);
  } finally {
    await page.close();
    // Important: Release browser only if you are managing the pool explicitly
    // await BrowserPool.getInstance().releaseBrowser(browser);
    // Or close the pool if this is the end of all tests
    // await BrowserPool.getInstance().close();
    logger.info('Basic Auth config test finished.');
  }
}

testBasicAuthConfig();
