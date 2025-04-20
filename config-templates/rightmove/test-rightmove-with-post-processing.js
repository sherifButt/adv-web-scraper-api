// Test script for the rightmove-config.json configuration with post-processing
import { chromium } from 'playwright';
import { NavigationEngine } from '../../src/navigation/navigation-engine.js';
import fs from 'fs';
import postProcessRightmoveResults from '../../post-process-rightmove.js';

async function testRightmoveConfig() {
  try {
    console.log('Starting test of rightmove-config.json with post-processing');
    
    // Read the configuration file
    const configPath = './rightmove-config.json';
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configContent);
    
    console.log('Configuration loaded successfully');
    
    // Launch a browser
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
      userAgent: config.options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
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
    
    // Post-process the results
    const processedResult = postProcessRightmoveResults(result.result);
    result.result = processedResult;
    
    console.log('Results post-processed successfully');
    console.log('Result:', JSON.stringify(result, null, 2));
    
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
testRightmoveConfig()
  .then(() => {
    console.log('Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
