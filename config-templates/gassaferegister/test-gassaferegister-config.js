// Test script for the gassaferegister-config.json configuration
import { chromium } from 'playwright'; // Removed LaunchOptions import
import { NavigationEngine } from '../../src/navigation/navigation-engine.js';
import fs from 'fs';
import { ProxyManager } from '../../src/core/proxy/proxy-manager.js'; // Added
import { config as globalConfig } from '../../src/config/index.js'; // Added & aliased
// Removed ProxyInfo import as types are not used in JS

async function testGasSafeRegisterConfig() {
  // Renamed function for clarity
  try {
    console.log('Starting test of gassaferegister-config.json');

    // Read the configuration file
    const configPath = './gassaferegister-config.json';
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configContent);

    console.log('Configuration loaded successfully');

    // --- Proxy Logic Start ---
    const launchOptions = { headless: false }; // Removed type annotation, changed let to const

    if (globalConfig.proxy.enabled) {
      try {
        // Initialize ProxyManager (assuming it loads proxies on instantiation or via a method)
        const proxyManager = ProxyManager.getInstance();
        // Ensure proxies are loaded if not done automatically
        if (proxyManager.listProxies().length === 0) {
          console.log('Loading proxies for test script...');
          await proxyManager.loadProxies(); // Make sure this method exists and loads proxies
          console.log(`ProxyManager loaded ${proxyManager.listProxies().length} proxies.`); // Added log
        } else {
          console.log(
            // Fixed line break
            `ProxyManager already has ${proxyManager.listProxies().length} proxies loaded.`
          );
        }

        // --- Try getting HTTP/HTTPS proxy first ---
        console.log('Attempting to get HTTP/HTTPS proxy...'); // Changed to single quotes
        let proxyInfo = await proxyManager.getProxy({ protocols: ['http', 'https'] });
        console.log('HTTP/HTTPS proxy selected:', proxyInfo);

        // --- Fallback to SOCKS5 if no HTTP/HTTPS found ---
        if (!proxyInfo) {
          console.log('No HTTP/HTTPS proxy found, attempting SOCKS5...'); // Changed to single quotes
          proxyInfo = await proxyManager.getProxy({ protocols: ['socks5'] });
          console.log('SOCKS5 proxy selected:', proxyInfo);
        }

        // --- Fallback to any proxy if specific types not found ---
        if (!proxyInfo) {
          console.log('No specific proxy type found, attempting any proxy...'); // Changed to single quotes
          proxyInfo = await proxyManager.getProxy(); // Get any proxy as a last resort
          console.log('Any proxy selected:', proxyInfo);
        }
        // --- End of proxy selection logic ---
        if (proxyInfo && proxyInfo.protocols && proxyInfo.protocols.length > 0) {
          // Removed blank line
          const protocol = proxyInfo.protocols[0]; // Use the first protocol listed for the selected proxy
          launchOptions.proxy = {
            // Assign directly to const object property
            server: `${protocol}://${proxyInfo.ip}:${proxyInfo.port}`,
            // username: proxyInfo.username, // Add if needed
            // password: proxyInfo.password, // Add if needed
          };
          console.log(`Using proxy for test: ${launchOptions.proxy.server}`);
        } else {
          console.warn(
            'Proxy enabled, but no valid proxy found for test. Proceeding without proxy.' // Fixed line break
          ); // Added newline
        }
      } catch (proxyError) {
        console.error(
          // Fixed line break
          `Error getting proxy for test: ${
            proxyError instanceof Error ? proxyError.message : String(proxyError)
          }. Proceeding without proxy.`
        ); // Added newline
      }
    } else {
      console.log('Proxy is disabled globally. Proceeding without proxy for test.'); // Removed leading space
    }
    // --- Proxy Logic End ---

    // Launch a browser with potential proxy options
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      // Fixed line break
      userAgent:
        config.options.userAgent ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      // Note: Proxy applied at launch level is usually sufficient, context proxy might override or conflict.
      // proxy: launchOptions.proxy // Usually not needed here if set at launch
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
testGasSafeRegisterConfig() // Renamed function call
  .then(() => {
    console.log('Test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    // Removed parentheses
    console.error('Test failed:', error);
    process.exit(1);
  });
