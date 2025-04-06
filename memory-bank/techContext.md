# Technical Context: Advanced Web Scraper API

## Technologies Used

The Advanced Web Scraper API is built using the following technologies:

### Core Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18.x+ | Runtime environment |
| TypeScript | 5.x | Type-safe JavaScript |
| Express.js | 4.x | Web framework for API endpoints |
| Playwright | 1.x | Browser automation |
| MongoDB | 6.x | Data storage (planned) |
| Redis | 7.x | Caching and job queues (planned) |

### Development Tools

| Tool | Version | Purpose |
|------|---------|---------|
| ESLint | 8.x | Code linting |
| Prettier | 3.x | Code formatting |
| Jest | 29.x | Testing framework |
| dotenv | 16.x | Environment variable management |
| winston | 3.x | Logging |
| nodemon | 3.x | Development server with hot reload |

### Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| express-rate-limit | 7.x | API rate limiting |
| helmet | 7.x | Security headers |
| cors | 2.x | Cross-origin resource sharing |
| joi | 17.x | Request validation |
| axios | 1.x | HTTP client for API calls |
| morgan | 1.x | HTTP request logging |

## Development Setup

### Project Structure

The project follows a modular structure with clear separation of concerns:

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
  /extraction          # Data extraction (coming soon)
  /storage             # Data storage (coming soon)
  
  /utils               # Utility functions
  /config              # Configuration management
  /types               # TypeScript type definitions
  
  app.ts               # Express application setup
  server.ts            # Server entry point
```

### Configuration

The application uses a hierarchical configuration system with environment variables:

1. Default configuration values are defined in `src/config/index.ts`
2. Environment-specific values are loaded from `.env` files
3. Runtime overrides can be provided via environment variables

Example `.env` file:

```
# Server Configuration
PORT=3000
HOST=localhost
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/web-scraper

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Logging
LOG_LEVEL=info

# CAPTCHA Solving Services
TWOCAPTCHA_API_KEY=your_api_key
ANTICAPTCHA_API_KEY=your_api_key

# Proxy Configuration
PROXY_API_URL=your_proxy_api_url
PROXY_API_KEY=your_api_key

# Browser Configuration
BROWSER_POOL_MIN=1
BROWSER_POOL_MAX=5
BROWSER_IDLE_TIMEOUT=30000
```

### TypeScript Configuration

The project uses TypeScript with ESM modules. Key TypeScript configuration:

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### ESLint and Prettier Configuration

The project uses ESLint with Prettier for code quality and formatting:

```json
// .eslintrc.json
{
  "env": {
    "node": true,
    "es2022": true
  },
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "plugins": ["@typescript-eslint"],
  "rules": {
    // Custom rules
  }
}
```

```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

## Technical Constraints

### Browser Automation

1. **Resource Intensive**
   - Browser automation requires significant memory and CPU resources
   - Each browser instance consumes ~100-150MB of memory
   - Concurrent browser instances need to be carefully managed

2. **Headless Browser Limitations**
   - Some websites detect and block headless browsers
   - Additional fingerprinting techniques are needed to avoid detection
   - Browser arguments and launch options need to be carefully configured

3. **Playwright Specifics**
   - Playwright uses a custom browser build that may differ from standard browsers
   - Browser contexts provide isolation but add overhead
   - Page lifecycle events need careful handling to avoid memory leaks

### CAPTCHA Solving

1. **External Service Limitations**
   - External CAPTCHA solving services have usage quotas and costs
   - Success rates vary by CAPTCHA type and complexity
   - Response times can be slow (5-30 seconds)

2. **Detection Mechanisms**
   - CAPTCHA providers continuously update detection mechanisms
   - Token application needs to mimic legitimate browser behavior
   - Audio CAPTCHA solving may be rate-limited or blocked

3. **Implementation Challenges**
   - Different CAPTCHA types require different solving strategies
   - Token harvesting requires careful session management
   - CAPTCHA iframe handling can be complex

### Proxy Management

1. **Proxy Reliability**
   - Proxies have variable reliability and performance
   - Some proxies may be blacklisted by target websites
   - Residential proxies are more effective but more expensive

2. **Authentication and Session Management**
   - Some proxies require authentication
   - Session persistence across requests can be challenging
   - IP rotation needs to be balanced with session requirements

3. **Geolocation Constraints**
   - Some websites serve different content based on geolocation
   - Proxy selection needs to consider geographic requirements
   - IP-based rate limiting may affect proxy rotation strategies

## Implementation Patterns

### Browser Pool Management

The browser pool manages browser instances for efficient resource usage:

```typescript
// Get a browser from the pool
const browserPool = BrowserPool.getInstance();
const browser = await browserPool.getBrowser({
  browserType: 'chromium',
  headless: true,
});

// Use the browser
const context = await browserPool.createContext(browser);
const page = await context.newPage();
await page.goto('https://example.com');

// Release the browser back to the pool
browserPool.releaseBrowser(browser);
```

### Human Behavior Emulation

The human behavior emulation module provides realistic interactions:

```typescript
// Create a behavior emulator
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
// Detect CAPTCHA
const detection = await CaptchaDetector.detect(page);

if (detection.detected) {
  console.log(`Detected ${detection.type} CAPTCHA`);
  
  // Solve the CAPTCHA
  const captchaSolver = new CaptchaSolver(page);
  const result = await captchaSolver.solve({
    useExternalService: true,
    timeout: 60000,
  });
  
  if (result.success) {
    console.log('CAPTCHA solved successfully');
  }
}
```

### Multi-step Navigation

The navigation engine executes multi-step navigation flows:

```typescript
// Create navigation engine
const navigationEngine = new NavigationEngine(page, {
  timeout: 30000,
  solveCaptcha: true,
});

// Define navigation steps
const steps = [
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
];

// Execute the navigation flow
const result = await navigationEngine.executeFlow(
  'https://example.com/search',
  steps,
  { initialContext: 'data' }
);
```

### Proxy Management

The proxy management system handles proxy rotation and health checking:

```typescript
// Get a proxy with specific options
const proxyManager = ProxyManager.getInstance();
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

## API Design

### RESTful Endpoints

The API follows RESTful principles with the following endpoints:

1. **Scraping Endpoints**
   - `POST /api/v1/scrape` - Scrape data from a URL
   - `GET /api/v1/scrape/:id` - Get the result of a scraping job

2. **CAPTCHA Endpoints**
   - `POST /api/v1/captcha/solve` - Solve a CAPTCHA challenge
   - `GET /api/v1/captcha/services` - Get available CAPTCHA solving services

3. **Proxy Endpoints**
   - `GET /api/v1/proxy` - Get proxy status and statistics
   - `POST /api/v1/proxy/test` - Test a specific proxy
   - `POST /api/v1/proxy/rotate` - Rotate to a new proxy

4. **Navigation Endpoints**
   - `POST /api/v1/navigate` - Execute a multi-step navigation flow
   - `GET /api/v1/navigate/:id` - Get the result of a navigation job
   - `POST /api/v1/navigate/crawl` - Start a crawling job

### Request/Response Format

All API endpoints use JSON for request and response bodies:

```json
// Example request
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

// Example response
{
  "success": true,
  "message": "Scraping completed successfully",
  "data": {
    "id": "scrape_1234567890",
    "url": "https://example.com/products",
    "status": "completed",
    "result": {
      "products": [
        {
          "name": "Product 1",
          "price": "$10.99",
          "description": "Description 1"
        },
        {
          "name": "Product 2",
          "price": "$24.99",
          "description": "Description 2"
        }
      ]
    },
    "timestamp": "2025-05-04T17:30:00.000Z"
  }
}
```

### Error Handling

The API uses consistent error responses:

```json
{
  "success": false,
  "message": "Invalid request parameters",
  "error": "URL is required",
  "timestamp": "2025-05-04T17:30:00.000Z"
}
```

Error status codes follow HTTP conventions:
- 400: Bad Request (client error)
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 429: Too Many Requests
- 500: Internal Server Error
- 503: Service Unavailable

## Development Workflow

### Running the Application

Development mode with hot reloading:

```bash
npm run dev
```

Production build:

```bash
npm run build
npm start
```

### Testing

Run tests:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

### Linting and Formatting

Lint code:

```bash
npm run lint
```

Fix linting issues:

```bash
npm run lint:fix
```

Format code:

```bash
npm run format
```

## Deployment Considerations

### Environment Variables

The application requires the following environment variables in production:

- `NODE_ENV`: Set to 'production'
- `PORT`: Port to listen on
- `HOST`: Host to bind to
- `MONGODB_URI`: MongoDB connection string
- `REDIS_HOST`: Redis host
- `REDIS_PORT`: Redis port
- `LOG_LEVEL`: Logging level (info, warn, error)

### Resource Requirements

Minimum server requirements:
- 2 CPU cores
- 4GB RAM
- 20GB disk space

Recommended server requirements:
- 4+ CPU cores
- 8GB+ RAM
- 50GB+ disk space

### Scaling Strategies

1. **Vertical Scaling**
   - Increase CPU and memory resources for the server
   - Suitable for moderate workloads

2. **Horizontal Scaling**
   - Deploy multiple instances behind a load balancer
   - Use Redis for shared state and job queues
   - Suitable for high-volume workloads

3. **Distributed Scraping**
   - Deploy worker nodes in different regions
   - Distribute scraping tasks across workers
   - Suitable for geographically diverse scraping needs

### Monitoring and Logging

1. **Application Metrics**
   - CPU and memory usage
   - Browser instance count
   - Request rate and response time
   - Scraping success rate

2. **Error Tracking**
   - Capture and aggregate errors
   - Track error rates by endpoint and website
   - Alert on critical errors

3. **Logging**
   - Structured logging with correlation IDs
   - Log rotation and retention policies
   - Centralized log collection

## Tool Usage Patterns

### Browser Automation

Playwright is used for browser automation with the following patterns:

1. **Browser Pool**
   - Maintain a pool of browser instances
   - Reuse browsers for multiple requests
   - Clean up idle browsers to free resources

2. **Context Isolation**
   - Create a new browser context for each scraping job
   - Isolate cookies, localStorage, and cache
   - Prevent cross-contamination between jobs

3. **Resource Management**
   - Limit concurrent browser instances
   - Monitor memory usage
   - Implement graceful shutdown

### Human Emulation

Human behavior is emulated using the following techniques:

1. **Mouse Movement**
   - Use Bezier curves for natural mouse paths
   - Vary movement speed
   - Add small random deviations

2. **Typing Patterns**
   - Vary typing speed
   - Occasionally make and correct typos
   - Add pauses between words

3. **Scrolling Behavior**
   - Scroll in small increments
   - Vary scrolling speed
   - Pause occasionally while scrolling

### CAPTCHA Solving

CAPTCHA solving uses a multi-strategy approach:

1. **Detection**
   - Identify CAPTCHA type and location
   - Extract necessary parameters (site key, etc.)
   - Determine confidence level

2. **Solving Strategies**
   - External service integration
   - Audio CAPTCHA solving
   - Token harvesting
   - Browser-based solving

3. **Token Application**
   - Apply tokens to the appropriate form fields
   - Trigger callback functions
   - Verify successful application

### Proxy Management

Proxy management follows these patterns:

1. **Proxy Sources**
   - Load proxies from files
   - Fetch proxies from API providers
   - Maintain a pool of available proxies

2. **Health Checking**
   - Test proxies periodically
   - Track success rate and response time
   - Remove or deprioritize failing proxies

3. **Rotation Strategies**
   - Round-robin rotation
   - Performance-based selection
   - Session-based persistence
   - Geographic targeting

*Note: This document will be updated as implementation progresses and new technical insights emerge.*
