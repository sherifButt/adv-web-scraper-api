// Test script for the config.json configuration
import { chromium } from 'playwright';
import { NavigationEngine } from '../../../../src/navigation/navigation-engine.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Derive __dirname equivalent in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testDragAndDropConfig() {
  try {
    console.log('Starting test of config.json');

    // Read the configuration file
    const configPath = path.join(__dirname, 'config.json');
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configContent);

    console.log('Configuration loaded successfully');

    // Launch a browser
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
      userAgent:
        config.options.userAgent ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    console.log('Browser launched successfully');

    // Create a navigation engine
    const navigationEngine = new NavigationEngine(page, {
      timeout: config.options.timeout || 30000,
      screenshots: config.options.screenshots || false,
      screenshotsPath: config.options.screenshotsPath || './screenshots',
    });

    console.log('Navigation engine created successfully');

    // Execute the navigation flow
    const result = await navigationEngine.executeFlow(
      config.startUrl,
      config.steps,
      config.variables || {}
    );

    console.log('Navigation flow executed successfully');
    console.log('Result:', JSON.stringify(result, null, 2));

    // Basic validation (checks if flow completed without errors)
    if (result.status === 'completed') {
      console.log('SUCCESS: Drag and Drop test completed successfully.');
    } else {
      console.error('FAILURE: Drag and Drop test did not complete successfully.');
      console.error('Detailed Result:', result);
    }

    // Close the browser
    await browser.close();

    console.log('Test completed successfully');
    return result;
  } catch (error) {
    console.error('Error in test:', error);
    throw error;
  }
}

// Run the test
testDragAndDropConfig()
  .then(() => {
    console.log('Test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
