# Advanced Web Scraper API

A robust and flexible API for web scraping with advanced capabilities for handling complex scenarios such as CAPTCHA solving, human behavior emulation, proxy management, and multi-step navigation.

## Project Status

**Current Phase**: Initial Implementation (40% Complete)

The project has progressed from planning to initial implementation. Core components have been implemented, including browser automation, human behavior emulation, CAPTCHA detection, proxy management, navigation engine, and data extraction. The API foundation is in place with functional endpoints for scraping.

Next steps include implementing storage adapters for different destinations, enhancing CAPTCHA solving strategies, adding comprehensive testing, and expanding API documentation.

## Features

- **CAPTCHA Solving**
  - reCAPTCHA v2/v3 detection and solving
  - hCaptcha detection and solving
  - Image CAPTCHA handling
  - Cloudflare challenge bypass

- **Human Behavior Emulation**
  - Natural mouse movements using Bezier curves
  - Variable typing speeds with occasional typos
  - Realistic scrolling behavior
  - Configurable behavior profiles (fast, average, careful)

- **Proxy Management**
  - Support for HTTP, HTTPS, SOCKS4, and SOCKS5 proxies
  - Intelligent rotation with session persistence
  - Health checking and performance monitoring
  - Automatic fallback mechanisms

- **Website Navigation & Crawling**
  - Multi-step navigation flows with state management
  - Form filling with human-like input
  - Conditional logic and branching
  - Pagination handling
  - Deep crawling with filters

- **Data Extraction**
  - Multiple selector strategies (CSS, XPath, regex, function)
  - Structured data extraction with nested fields
  - Data cleaning and transformation pipeline
  - Schema-based validation and type conversion
  - Declarative configuration approach

## Project Structure

```
/src
  /api                 # API layer
    /middleware        # Express middleware
    /routes            # API route definitions
    /controllers       # Route controllers (coming soon)
    /validators        # Request validation (coming soon)
  
  /core                # Core functionality
    /browser           # Browser automation
    /captcha           # CAPTCHA detection and solving
    /human             # Human behavior emulation
    /proxy             # Proxy management
  
  /navigation          # Navigation engine
  /extraction          # Data extraction engine
    /selectors         # Selector strategies
  /storage             # Data storage
    /adapters          # Storage adapters for different destinations
  
  /utils               # Utility functions
  /config              # Configuration management
  /types               # TypeScript type definitions
  
  app.ts               # Express application setup
  server.ts            # Server entry point
```

## Tech Stack

- **Node.js** with **TypeScript** (ESM modules)
- **Express.js** for API endpoints
- **Playwright** for browser automation
- **MongoDB** for data storage
- **Redis** for caching and job queues

## Core Components

### Browser Automation

The browser automation module uses Playwright to control browsers with a pool management system for efficient resource usage:

```typescript
// Example: Getting a browser from the pool
const browserPool = BrowserPool.getInstance();
const browser = await browserPool.getBrowser({
  browserType: 'chromium',
  headless: true,
});

// Create a context with specific options
const context = await browserPool.createContext(browser, {
  viewport: { width: 1920, height: 1080 },
  userAgent: 'Mozilla/5.0 ...',
});

// Release the browser when done
browserPool.releaseBrowser(browser);
```

### Human Behavior Emulation

The human behavior emulation module provides realistic human-like interactions:

```typescript
// Example: Using the behavior emulator
const behaviorEmulator = new BehaviorEmulator(page, {
  profile: 'average', // 'fast', 'average', or 'careful'
});

// Move mouse to an element with natural motion
await behaviorEmulator.moveMouseToElement('#search-button');

// Click with realistic timing
await behaviorEmulator.clickElement('#search-button');

// Type text with variable speed and occasional typos
await behaviorEmulator.typeText('search query', {
  mistakes: true,
  variableSpeed: true,
});

// Scroll naturally
await behaviorEmulator.scroll('down', 500);

// Add a "thinking" pause
await behaviorEmulator.think();
```

### CAPTCHA Detection and Solving

The CAPTCHA module detects and solves various types of CAPTCHAs:

```typescript
// Example: Detecting and solving CAPTCHAs
const captchaDetector = new CaptchaDetector();
const captchaSolver = new CaptchaSolver(page);

// Detect CAPTCHA
const detection = await CaptchaDetector.detect(page);

if (detection.detected) {
  console.log(`Detected ${detection.type} CAPTCHA`);
  
  // Solve the CAPTCHA
  const result = await captchaSolver.solve({
    useExternalService: true,
    timeout: 60000,
  });
  
  if (result.success) {
    console.log('CAPTCHA solved successfully');
  }
}
```

### Proxy Management

The proxy management module handles proxy rotation, health checking, and performance monitoring:

```typescript
// Example: Using the proxy manager
const proxyManager = ProxyManager.getInstance();

// Get a proxy with specific options
const proxy = await proxyManager.getProxy({
  country: 'US',
  type: 'http',
  session: 'session1',
});

// Report proxy result
proxyManager.reportProxyResult(proxy, true, 250); // success, response time

// Get proxy statistics
const stats = proxyManager.getProxyStats();
console.log(`Healthy proxies: ${stats.healthy}/${stats.total}`);
```

### Navigation Engine

The navigation engine executes multi-step navigation flows. It has recently been refactored to use a handler-based architecture (Strategy/Factory pattern), where each step type (`goto`, `click`, `input`, etc.) has its own dedicated handler class. This makes the engine more modular and extensible.

```typescript
// Example: Using the navigation engine
const navigationEngine = new NavigationEngine(page, {
  timeout: 30000,
  solveCaptcha: true,
});

// Execute a navigation flow
const result = await navigationEngine.executeFlow(
  'https://example.com/search',
  [
    {
      type: 'input',
      selector: '#search-input',
      value: 'search term',
      humanInput: true,
    },
    {
      type: 'click',
      selector: '#search-button',
      waitFor: '.results-container',
    },
    {
      type: 'extract',
      name: 'searchResults',
      selector: '.result-item',
      fields: {
        title: '.result-title',
        url: '.result-link@href',
      },
    },
  ],
  { keywords: 'initial context' }
);

console.log(`Navigation completed with ${result.stepsExecuted} steps`);
console.log('Extracted data:', result.result);
```

## Getting Started

### Prerequisites

- Node.js (v18.x or later)
- MongoDB (coming soon)
- Redis (coming soon)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/adv-web-scraper-api.git
   cd adv-web-scraper-api
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on the provided `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file with your configuration settings.

### Development

Start the development server with hot reloading:

```bash
npm run dev
```

### Building for Production

Build the TypeScript code:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

## API Documentation

### Health Check Endpoint

```bash
# Check API health
curl -X GET http://localhost:3000/health
```

```bash
# Check API v1 health
curl -X GET http://localhost:3000/api/v1/health
```

### Scraping Endpoints

```bash
# Scrape data from a URL
curl -X POST http://localhost:3000/api/v1/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://loyalleads.co.uk",
    "fields": {
      "title": {
        "type": "css",
        "name": "title",
        "selector": "title"
      },
      "products": {
        "selector": ".product-item",
        "type": "css",
        "multiple": true,
        "fields": {
          "name": {
            "type": "css",
            "name": "name",
            "selector": ".product-name"
          },
          "price": {
            "type": "css",
            "name": "price",
            "selector": ".product-price"
          },
          "description": {
            "type": "css",
            "name": "description",
            "selector": ".product-description"
          }
        }
      }
    },
    "options": {
      "javascript": true,
      "proxy": true,
      "humanEmulation": true
    }
  }'

# Example response:
# {
#    "success": true,
#    "message": "Extraction completed successfully",
#    "data": {
#        "id": "extract_6ca58c6f-f199-4b3e-bb7b-32dbad81c076",
#        "url": "https://loyalleads.co.uk",
#        "status": "completed",
#        "data": {
#            "title": "Loyalleads is a premier software development agency based in Cardiff, renowned for its expertise in creating sophisticated web applications, bespoke websites, and effective online marketing flows. With a strong focus on both B2B and B2C markets, Loyalleads has established a reputation for delivering high-quality, tailored solutions that meet the unique needs of each client.",
#            "products": []
#        },
#        "stats": {
#            "startTime": "2025-04-05T18:58:10.675Z",
#            "endTime": "2025-04-05T18:58:17.220Z",
#            "duration": 6545,
#            "pagesProcessed": 1,
#            "itemsExtracted": 1
#        },
#        "timestamp": "2025-04-05T18:58:17.220Z"
#    },
#    "timestamp": "2025-04-05T18:58:17.220Z"
#}
```

```bash
# Get the result of a scraping job
curl -X GET http://localhost:3000/api/v1/scrape/extract_6ca58c6f-f199-4b3e-bb7b-32dbad81c076

# Example response:
# {
#    "success": true,
#    "message": "Extraction completed successfully",
#    "data": {
#        "id": "extract_6ca58c6f-f199-4b3e-bb7b-32dbad81c076",
#        "url": "https://loyalleads.co.uk",
#        "status": "completed",
#        "data": {
#            "title": "Loyalleads is a premier software development agency based in Cardiff, renowned for its expertise in creating sophisticated web applications, bespoke websites, and effective online marketing flows. With a strong focus on both B2B and B2C markets, Loyalleads has established a reputation for delivering high-quality, tailored solutions that meet the unique needs of each client.",
#            "products": []
#        },
#        "stats": {
#            "startTime": "2025-04-05T18:58:10.675Z",
#            "endTime": "2025-04-05T18:58:17.220Z",
#            "duration": 6545,
#            "pagesProcessed": 1,
#            "itemsExtracted": 1
#        },
#        "timestamp": "2025-04-05T18:58:17.220Z"
#    },
#    "timestamp": "2025-04-05T18:58:17.220Z"
#}
```

### CAPTCHA Endpoints

```bash
# Solve a CAPTCHA challenge
curl -X POST http://localhost:3000/api/v1/captcha/solve \
  -H "Content-Type: application/json" \
  -d '{
    "captchaType": "recaptcha_v2",
    "url": "https://example.com/login",
    "siteKey": "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI",
    "options": {
      "useExternalService": true,
      "service": "twocaptcha"
    }
  }'

# Example response:
# {
#   "success": true,
#   "message": "CAPTCHA solved successfully",
#   "data": {
#     "captchaType": "recaptcha_v2",
#     "url": "https://example.com/login",
#     "solved": true,
#     "token": "03AGdBq24PBCbwiDRgC3...rqAHSjxEc3wNkJqVNCjnk",
#     "timestamp": "2025-05-04T17:31:56.789Z"
#   }
# }
```

```bash
# Get available CAPTCHA solving services
curl -X GET http://localhost:3000/api/v1/captcha/services

# Example response:
# {
#   "success": true,
#   "message": "CAPTCHA services retrieved",
#   "data": {
#     "services": [
#       {
#         "name": "internal",
#         "enabled": true,
#         "types": ["recaptcha", "hcaptcha", "image"]
#       },
#       {
#         "name": "2captcha",
#         "enabled": false,
#         "types": ["recaptcha", "hcaptcha", "image", "funcaptcha"]
#       }
#     ]
#   }
# }
```

### Proxy Endpoints

```bash
# Get proxy status and statistics
curl -X GET http://localhost:3000/api/v1/proxy
```

```bash
# Test a specific proxy
curl -X POST http://localhost:3000/api/v1/proxy/test \
  -H "Content-Type: application/json" \
  -d '{
    "host": "203.0.113.1",
    "port": 8080,
    "type": "http",
    "username": "user",
    "password": "pass"
  }'

# Example response:
# {
#   "success": true,
#   "message": "Proxy test successful",
#   "data": {
#     "host": "203.0.113.1",
#     "port": 8080,
#     "type": "http",
#     "working": true,
#     "responseTime": 250,
#     "ip": "203.0.113.1",
#     "country": "US",
#     "timestamp": "2025-05-04T17:32:56.789Z"
#   }
# }
```

```bash
# Rotate to a new proxy
curl -X POST http://localhost:3000/api/v1/proxy/rotate \
  -H "Content-Type: application/json" \
  -d '{
    "country": "US",
    "type": "http",
    "session": "session1"
  }'

# Example response:
# {
#   "success": true,
#   "message": "Proxy rotation successful",
#   "data": {
#     "host": "203.0.113.2",
#     "port": 8080,
#     "type": "http",
#     "country": "US",
#     "session": "session1",
#     "timestamp": "2025-05-04T17:33:56.789Z"
#   }
# }
```

### Navigation Endpoints

#### Navigation Step Types

The navigation engine supports the following step types for multi-step navigation flows:

| Step Type | Description | Required Parameters | Optional Parameters |
|-----------|-------------|---------------------|---------------------|
| `goto` | Navigate to a URL | `value` (URL) | `waitFor`, `timeout` |
| `click` | Click on an element | `selector` | `waitFor`, `timeout` |
| `input` | Enter text into an input field | `selector`, `value` | `clearInput`, `humanInput`, `waitFor`, `timeout` |
| `select` | Select an option from a dropdown | `selector`, `value` | `waitFor`, `timeout` |
| `wait` | Wait for a condition | `value` (selector or time in ms) or `waitFor` | `timeout` |
| `extract` | Extract data from the page | `selector`, `name` | `fields`, `list`, `attribute` |
| `condition` | Conditional branching | `condition` | `thenSteps`, `elseSteps` |
| `paginate` | Handle pagination | `selector` | `maxPages`, `extractSteps`, `waitFor`, `timeout` |

#### Navigation Step Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `selector` | `string` | CSS selector to locate elements |
| `value` | `string` or `number` | Value to use (URL, text input, wait time, etc.) |
| `waitFor` | `string` or `number` | Selector to wait for, time in ms, or special values like `navigation` or `networkidle` |
| `timeout` | `number` | Timeout in milliseconds for the step |
| `humanInput` | `boolean` | Whether to simulate human typing (with variable speed and occasional typos) |
| `clearInput` | `boolean` | Whether to clear the input field before typing |
| `name` | `string` | Name to use for extracted data in the result context |
| `fields` | `object` | Field definitions for structured data extraction |
| `list` | `boolean` | Whether to extract a list of items |
| `attribute` | `string` | Element attribute to extract (e.g., `href`, `src`) |
| `condition` | `string` or `function` | Condition to evaluate (selector or function) |
| `thenSteps` | `array` | Steps to execute if condition is true |
| `elseSteps` | `array` | Steps to execute if condition is false |
| `maxPages` | `number` | Maximum number of pages to paginate through |
| `extractSteps` | `array` | Steps to execute on each page during pagination |

#### Template Variables

You can use template variables in your navigation steps by enclosing them in double curly braces: `{{variableName}}`. These variables will be replaced with values from the `variables` object provided in the request.

For more detailed examples of navigation configurations, see the [Navigation Examples](docs/navigation/navigation_examples.md) documentation.

```bash
# Execute a multi-step navigation flow
curl -X POST http://localhost:3000/api/v1/navigate \
  -H "Content-Type: application/json" \
  -d '{
    "startUrl": "https://example.com/search",
    "steps": [
      {
        "type": "input",
        "selector": "#ta_searchInput",
        "value": "{{keyword}}",
        "humanInput": true
      },
      {
        "type": "click",
        "selector": ".dsrm_button",
        "waitFor": "#Search_propertySearchCriteria__Wn7r_"
      },
      {
        "type": "extract",
        "name": "searchResults",
        "selector": ".Search_titleContainer__HQ9QA",
        "fields": {
          "title": ".result-title",
          "url": ".result-link@href"
        }
      }
    ],
    "variables": {
      "keywords": "CF40 2RS"
    },
    "options": {
      "solveCaptcha": true,
      "proxyRegion": "US",
      "timeout": 60000
    }
  }'
```

#### Explanation of the Navigation Steps

This example demonstrates a multi-step navigation flow that:

1. **Starts the navigation**: Opens a browser and navigates to "https://example.com/search"

2. **Enters search text**: 
   - Finds the search input field with ID "ta_searchInput"
   - Types "CF40 2RS" (from the variables object) into the field
   - Uses human-like typing with variable speed and occasional typos (because humanInput is true)

3. **Clicks the search button**:
   - Finds and clicks on an element with class "dsrm_button" (likely the search button)
   - Waits for an element with ID "Search_propertySearchCriteria__Wn7r_" to appear before proceeding
   - This ensures the search results have loaded before moving to the next step

4. **Extracts search results**:
   - Finds elements matching the selector ".Search_titleContainer__HQ9QA"
   - For each matching element, extracts:
     - The title (text content of elements matching ".result-title")
     - The URL (href attribute of elements matching ".result-link")
   - Stores the extracted data in the result context under the name "searchResults"

5. **Additional options**:
   - Automatically solves any CAPTCHAs encountered during navigation
   - Uses a proxy server from the US region
   - Sets a timeout of 60 seconds for each step

The navigation engine handles all the browser automation, human-like behavior, and CAPTCHA solving behind the scenes, making it easy to automate complex web interactions with a simple declarative configuration.

```bash
# Example response:
# {
#   "success": true,
#   "message": "Navigation job started",
#   "data": {
#     "id": "nav_1683213456789",
#     "startUrl": "https://example.com/search",
#     "stepsExecuted": 3,
#     "status": "completed",
#     "timestamp": "2025-05-04T17:34:56.789Z"
#   }
# }
```

```bash
# Get the result of a navigation job
curl -X GET http://localhost:3000/api/v1/navigate/nav_1234567890

# Example response:
# {
#   "success": true,
#   "message": "Navigation result retrieved",
#   "data": {
#     "id": "nav_1234567890",
#     "status": "completed",
#     "result": {
#       "pagesVisited": 3,
#       "dataExtracted": {
#         "title": "Example Page Title",
#         "items": [
#           { "name": "Item 1", "price": "$10.99" },
#           { "name": "Item 2", "price": "$24.99" },
#           { "name": "Item 3", "price": "$5.99" }
#         ]
#       }
#     },
#     "timestamp": "2025-05-04T17:35:56.789Z"
#   }
# }
```

```bash
# Start a crawling job
curl -X POST http://localhost:3000/api/v1/navigate/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "startUrl": "https://example.com/products",
    "maxPages": 5,
    "selectors": {
      "links": ".product-link@href",
      "nextPage": ".pagination .next@href"
    },
    "filters": {
      "urlPattern": "product-detail",
      "maxDepth": 2
    }
  }'

# Example response:
# {
#   "success": true,
#   "message": "Crawling job started",
#   "data": {
#     "id": "crawl_1683213456789",
#     "startUrl": "https://example.com/products",
#     "maxPages": 5,
#     "status": "started",
#     "timestamp": "2025-05-04T17:36:56.789Z"
#   }
# }
```

## Data Extraction Configuration

### Field Configuration Options

The data extraction engine supports a variety of field configuration options:

| Option | Type | Description |
|--------|------|-------------|
| `type` | `string` | Selector type: `css`, `xpath`, `regex`, or `function` |
| `name` | `string` | Name of the field |
| `selector` | `string` | CSS or XPath selector to locate elements |
| `attribute` | `string` (optional) | Element attribute to extract (e.g., `href`, `src`). If not provided, innerText is used |
| `multiple` | `boolean` (optional) | If true, returns an array of matches. Default: `false` |
| `transform` | `string` or `function` (optional) | Transformation to apply to extracted value (e.g., `trim`, `toLowerCase`) |
| `dataType` | `string` (optional) | Data type conversion: `string`, `number`, `boolean`, `date`, `array`, `object` |
| `required` | `boolean` (optional) | If true, extraction fails if field is not found. Default: `false` |
| `defaultValue` | `any` (optional) | Value to use if extraction fails |
| `pattern` | `string` (for regex type) | Regular expression pattern to match |
| `flags` | `string` (for regex type, optional) | Regular expression flags (e.g., `g`, `i`, `m`) |
| `group` | `number` (for regex type, optional) | Capture group to extract. Default: `0` (entire match) |
| `source` | `string` (for regex type, optional) | Source to apply regex to (e.g., `html`, `text`, or a CSS/XPath selector) |
| `function` | `string` or `function` (for function type) | Function to execute for extraction |

### Extraction Options

The extraction engine supports the following options:

| Option | Type | Description |
|--------|------|-------------|
| `timeout` | `number` (optional) | Page load timeout in milliseconds. Default: `30000` |
| `waitForSelector` | `string` (optional) | Selector to wait for before extraction |
| `waitForTimeout` | `number` (optional) | Timeout for waitForSelector in milliseconds. Default: `5000` |
| `javascript` | `boolean` (optional) | Whether to enable JavaScript. Default: `true` |
| `proxy` | `boolean` (optional) | Whether to use a proxy. Default: `false` |
| `humanEmulation` | `boolean` (optional) | Whether to emulate human behavior. Default: `false` |
| `solveCaptcha` | `boolean` (optional) | Whether to attempt to solve CAPTCHAs. Default: `false` |
| `headers` | `object` (optional) | Custom HTTP headers to send with requests |
| `cookies` | `object` (optional) | Custom cookies to set before navigation |
| `browser` | `object` (optional) | Browser configuration options |
| `browser.type` | `string` (optional) | Browser type: `chromium`, `firefox`, or `webkit`. Default: `chromium` |
| `browser.headless` | `boolean` (optional) | Whether to run in headless mode. Default: `true` |
| `browser.args` | `string[]` (optional) | Additional browser arguments |

## Example Usage

### Simple Scraping

```json
// POST /api/v1/scrape
{
  "url": "https://example.com/products",
  "selectors": {
    "products": {
      "selector": ".product-item",
      "type": "list",
      "fields": {
        "name": ".product-name",
        "price": ".product-price",
        "description": ".product-description"
      }
    }
  },
  "options": {
    "javascript": true,
    "proxy": true,
    "humanEmulation": true
  }
}
```

### Multi-step Navigation

```json
// POST /api/v1/navigate
{
  "startUrl": "https://example.com/search",
  "steps": [
    {
      "type": "input",
      "selector": "#search-input",
      "value": "{{keywords}}",
      "humanInput": true
    },
    {
      "type": "click",
      "selector": "#search-button",
      "waitFor": ".results-container"
    },
    {
      "type": "extract",
      "name": "searchResults",
      "selector": ".result-item",
      "fields": {
        "title": ".result-title",
        "url": ".result-link@href"
      }
    },
    {
      "type": "paginate",
      "selector": ".next-page",
      "maxPages": 3
    }
  ],
  "variables": {
    "keywords": "example search term"
  },
  "options": {
    "solveCaptcha": true,
    "proxyRegion": "US",
    "timeout": 60000
  }
}
```

## Storage System

The storage system provides a flexible and extensible way to store, retrieve, update, and delete extraction results. It follows the Strategy pattern, allowing the application to switch between different storage implementations without changing the client code.

### Storage Adapters

The following storage adapters are available:

- **Memory Storage**: Stores extraction results in memory using a Map. Useful for development and testing.
- **File Storage**: Stores extraction results as JSON files in the file system. Provides persistence between server restarts.
- **MongoDB Storage**: Stores extraction results in a MongoDB database. Provides scalable and queryable storage.
- **Redis Storage**: Stores extraction results in Redis. Provides high-performance caching and storage with optional expiration.
- **API Storage**: Stores extraction results in an external API. Provides integration with external systems.

### Storage Factory and Service

The storage system includes a Storage Factory that creates and manages storage adapters, and a Storage Service that provides a unified interface for storage operations with support for primary and backup storage.

```typescript
// Example: Using the Storage Service
import { StorageService } from './storage/index.js';

// Get the storage service instance
const storageService = StorageService.getInstance({
  primaryAdapter: 'mongodb',
  primaryAdapterOptions: {
    uri: 'mongodb://localhost:27017/web-scraper',
  },
  backupAdapter: 'file',
  backupAdapterOptions: {
    directory: './data/backup',
  },
  useBackup: true,
});

// Initialize the storage service
await storageService.initialize();

// Store an extraction result
const id = await storageService.store(extractionResult);

// Retrieve an extraction result
const result = await storageService.retrieve(id);

// Update an extraction result
const success = await storageService.update(id, { status: 'updated' });

// List extraction results
const results = await storageService.list({ limit: 10, offset: 0 });

// Delete an extraction result
const deleted = await storageService.delete(id);
```

### Session Manager Module

- Created a new SessionManager class that handles storing and retrieving browser sessions
- Implemented methods for saving, retrieving, and applying sessions
- Added session expiration and cleanup mechanisms
- Integrated with the existing storage system for persistence

### CAPTCHA Solver Integration

- Updated the CaptchaSolver to check for existing sessions before attempting to solve CAPTCHAs
- Added functionality to save sessions after successfully solving CAPTCHAs
- Implemented a method to mark sessions as having solved CAPTCHAs

### Navigation Engine Integration

- Modified the NavigationEngine to apply existing sessions before navigation
- Added options to control session usage in navigation flows
- Implemented automatic session saving after successful navigation

### API Endpoints for Session Management

- Created new API routes for managing sessions
- Implemented endpoints to list, delete, and clear sessions
- Added proper error handling and validation

### Configuration Options

- Updated the configuration system to include session-related settings
- Added environment variables for controlling session behavior
- Implemented session TTL (time-to-live) configuration

This implementation provides several benefits:

- Significantly reduces the need for CAPTCHA solving when repeatedly scraping the same website
- Preserves cookies and localStorage data between scraping sessions
- Provides a clean API for managing sessions
- Integrates seamlessly with the existing architecture
- Follows the established patterns and practices of the project

For more details, see the [Storage Module Documentation](docs/storage/README.md).

## Current Limitations

- External CAPTCHA solving service integration is placeholder only
- Unit and integration tests are not yet implemented
- Documentation is still in progress

## Roadmap

1. **Short Term (1-2 weeks)**
   - Enhance CAPTCHA solving with external service integration
   - Add unit tests for core components
   - Implement request validation with JSON schema

2. **Medium Term (2-4 weeks)**
   - Implement MongoDB and Redis integration
   - Add request validation with JSON schema
   - Create comprehensive API documentation

3. **Long Term (1-2 months)**
   - Add performance optimization
   - Implement distributed scraping capabilities
   - Create advanced examples and tutorials

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Ethical Use

This tool is intended for legitimate web scraping purposes such as data analysis, research, and integration. Always:

1. Respect robots.txt directives
2. Implement reasonable rate limiting
3. Identify your scraper appropriately
4. Comply with websites' terms of service
5. Respect copyright and data privacy laws

The developers of this tool are not responsible for any misuse or legal consequences resulting from improper use.
