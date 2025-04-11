// Test script for the googlemaps-session-config.json configuration
import { chromium } from 'playwright';
import { NavigationEngine } from './src/navigation/navigation-engine.js';
import { SessionManager } from './src/core/session/session-manager.js';
import fs from 'fs';

async function testGooglemapsSessionConfig() {
  try {
    console.log('Starting test of googlemaps-session-config.json');

    // Read the configuration files
    const sessionConfigPath = './googlemaps-session-config.json';
    const sessionConfigContent = fs.readFileSync(sessionConfigPath, 'utf8');
    const sessionConfig = JSON.parse(sessionConfigContent);

    const navConfigPath = './googlemaps-config.json';
    const navConfigContent = fs.readFileSync(navConfigPath, 'utf8');
    const navConfig = JSON.parse(navConfigContent);

    console.log('Configurations loaded successfully');

    // Initialize session manager with Redis adapter
    const sessionManager = new SessionManager({
      adapter: sessionConfig.adapter,
      ttl: sessionConfig.ttl,
    });

    // Launch browser with session config settings
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
      userAgent: sessionConfig.browser.userAgent,
      viewport: {
        width: sessionConfig.browser.viewport.width,
        height: sessionConfig.browser.viewport.height,
      },
    });
    const page = await context.newPage();

    console.log('Browser launched with session settings');

    // Create navigation engine with combined config options
    const navigationEngine = new NavigationEngine(page, {
      timeout: navConfig.options.timeout || 30000,
      screenshots: navConfig.options.screenshots || false,
      screenshotsPath: navConfig.options.screenshotsPath || './screenshots',
      sessionManager, // Pass session manager to navigation engine
    });

    console.log('Navigation engine created with session support');

    // Execute the navigation flow
    const result = await navigationEngine.executeFlow(
      navConfig.startUrl,
      navConfig.steps,
      navConfig.variables || {}
    );

    console.log('Navigation flow executed successfully');
    console.log('Result:', JSON.stringify(result, null, 2));

    // Verify session was stored
    const sessionId = navigationEngine.getSessionId();
    if (sessionId) {
      const storedSession = await sessionManager.getSession(sessionId);
      console.log('Stored session data:', storedSession);
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
testGooglemapsSessionConfig()
  .then(() => {
    console.log('Test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
