// Test script for the googlemaps-session-config.json configuration
import { chromium } from 'playwright';
import { SessionManager } from '../../src/core/session/session-manager.js';
import fs from 'fs';

async function testGooglemapsSessionConfig() {
  try {
    console.log('Starting test of googlemaps-session-config.json');

    // Read the session configuration file
    const configPath = './googlemaps-session-config.json';
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configContent);

    console.log('Session configuration loaded successfully');

    // Initialize session manager
    const sessionManager = SessionManager.getInstance();
    await sessionManager.initialize();

    // Create a new session with the config
    const session = await sessionManager.createSession({
      adapter: config.adapter,
      ttl: config.ttl,
      browserOptions: {
        userAgent: config.browser.userAgent,
        viewport: config.browser.viewport,
      },
    });

    console.log('Session created successfully:', session.id);

    // Launch a browser to test the session
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
      userAgent: config.browser.userAgent,
      viewport: config.browser.viewport,
    });

    // Apply the session to the browser context
    await sessionManager.applySession(context, session);
    console.log('Session applied to browser context');

    // Test the session by navigating to a page
    const page = await context.newPage();
    await page.goto('https://maps.google.com');
    console.log('Navigated to Google Maps with session');

    // Close the browser
    await browser.close();

    console.log('Test completed successfully');
    return session;
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
