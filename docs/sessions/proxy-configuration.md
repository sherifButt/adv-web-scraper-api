# Proxy Configuration and Usage Guide

This guide explains how to configure proxy sources and utilize proxies within navigation and scraping jobs in the Advanced Web Scraper API.

## Overview

The API uses a central `ProxyManager` to handle a pool of proxies sourced from configured locations. When a job requests a proxy, the manager selects a suitable one based on filtering criteria and rotation strategies. Several anti-detection measures are automatically applied when a proxy is used.

## 1. Configuring Proxy Sources

The `ProxyManager` loads proxies from sources defined in the main application configuration (`src/config/index.ts` under the `proxy.sources` array). Supported source types are:

### a) JSON File

Proxies can be loaded from a local JSON file. The file should contain an array of proxy objects.

**Configuration (`src/config/index.ts`):**

```typescript
proxy: {
  // ... other settings
  sources: [
    {
      type: 'file',
      path: './proxies.json', // Path relative to project root
    },
    // ... other sources
  ],
  // ... other settings
},
```

**Example `proxies.json` format:**

```json
[
  {
    "ip": "51.15.196.107",
    "port": 16379, // Port should be a number
    "protocols": ["socks4"], // Array of "http", "https", "socks4", "socks5"
    "country": "FR",
    "city": "Paris",
    "username": "user", // Optional
    "password": "password", // Optional
    "anonymityLevel": "elite", // Optional
    "isp": "SCALEWAY", // Optional
    "asn": "AS12876", // Optional
    "latency": 7.401, // Optional: Latency from source
    "upTime": 11.18, // Optional: Uptime % from source
    "speed": 1 // Optional: Speed metric from source
    // Other fields from the source are preserved but may not be used directly for filtering
  },
  { // Another proxy... }
]
```
*Note: Ensure the `port` is a number, not a string, in your JSON file.*

### b) API Endpoint

Proxies can be fetched dynamically from an external API endpoint. The API is expected to return a JSON array of proxy objects in a similar format to the file source.

**Configuration (`src/config/index.ts`):**

```typescript
proxy: {
  // ... other settings
  sources: [
    {
      type: 'api',
      url: process.env.PROXY_API_URL, // URL fetched from environment variable
      apiKey: process.env.PROXY_API_KEY || null, // Optional API key (Bearer token assumed)
      refreshInterval: 3600000, // Optional: How often to refresh (ms), e.g., 1 hour
    },
    // ... other sources
  ],
  // ... other settings
},
```

## 2. Using Proxies in Navigation/Scraping Jobs

To use a proxy for a specific navigation or scraping job, include the `proxy` key within the `options` object in your job request payload (e.g., when POSTing to `/api/v1/navigate` or `/api/v1/scrape`).

**Requesting *any* available proxy:**

Simply include an empty object `{}`. The `ProxyManager` will select the best available proxy based on its internal metrics (success rate, latency) and rotation strategy.

```json
{
  "startUrl": "https://example.com",
  "steps": [ /* ... your steps ... */ ],
  "options": {
    "proxy": {} // Request a proxy from the manager
    // ... other options like timeout, javascript, etc.
  }
}
```

**Requesting a proxy with specific criteria:**

You can provide filtering criteria within the `proxy` object. The `ProxyManager` will attempt to find a loaded proxy matching these criteria.

```json
{
  "startUrl": "https://example.com",
  "steps": [ /* ... your steps ... */ ],
  "options": {
    "proxy": {
      "country": "US", // Optional: Filter by country code (e.g., "US", "GB")
      "city": "New York", // Optional: Filter by city
      "region": "NY", // Optional: Filter by region/state
      "asn": "AS15169", // Optional: Filter by ASN (Autonomous System Number)
      "type": "http", // Optional: Filter by protocol ("http", "https", "socks4", "socks5")
      "anonymityLevel": "elite", // Optional: Filter by anonymity level (e.g., "elite", "anonymous")
      "minSpeed": 50, // Optional: Minimum speed metric (from source data)
      "maxLatency": 500, // Optional: Maximum latency in ms (from source data)
      "minUpTime": 95, // Optional: Minimum uptime percentage (from source data)
      "minSuccessRate": 0.7 // Optional: Minimum internal success rate (0.0 to 1.0)
      // "session": "my_sticky_session_id" // Optional: Request a sticky proxy for this session ID
    }
    // ... other options
  }
}
```

*Note: If no proxy matches the criteria, the manager logs a warning and falls back to selecting from all available proxies.*

## 3. Automatic Anti-Detection Measures

When a proxy is successfully obtained and used for a job via the `options.proxy` setting, the system automatically applies several anti-detection measures:

*   **Browser Launch Arguments:** Includes flags like `--proxy-bypass-list=*` and `--disable-features=WebRtcHideLocalIpsWithMdns,WebRTC` to prevent common IP leaks.
*   **Context Options:** Sets a common `userAgent`, standard `viewport`, blocks `geolocation` permission, and enables `bypassCSP`.
*   **Init Script:** Overrides browser properties like `navigator.webdriver`, `navigator.plugins`, and `navigator.languages` to appear less like automation.
*   **HTTP Headers:** Sets realistic headers like `X-Forwarded-For` (using the proxy IP), `Accept-Language`, and various `Sec-` headers.

**Important:** Despite these measures, sophisticated WAFs (like Imperva) might still detect automation or IP leaks, especially if using low-quality (e.g., datacenter) proxies. The persistent detection of the user's real IP alongside the proxy IP often points to issues with the proxy server itself or the network environment, rather than the application's configuration. Using high-quality residential or mobile proxies is strongly recommended for difficult targets.

## 4. Managing and Testing Proxies via API

The API provides endpoints to interact with the `ProxyManager`:

*   **`GET /api/v1/proxy/list`**: Lists all proxies currently loaded by the manager, optionally filtered by query parameters (e.g., `?country=US&type=http`).
*   **`GET /api/v1/proxy/stats`**: Provides statistics about the loaded proxies (total count, counts by country/protocol, average metrics).
*   **`POST /api/v1/proxy/test`**: Tests a specific proxy using the application's internal health check mechanism. Requires `ip` and `port` in the JSON body.
    ```bash
    curl -X POST http://localhost:3000/api/v1/proxy/test -H "Content-Type: application/json" -d '{"ip": "1.2.3.4", "port": 8080}'
    ```
*   **`POST /api/v1/proxy/rotate`**: Requests the manager to select and return the next proxy based on optional filtering criteria provided in the JSON body.
*   **`POST /api/v1/proxy/clean`**: Removes proxies from the manager's list that fall below a minimum internal success rate (default 0.1 or 10%).

These endpoints are useful for monitoring the proxy pool and diagnosing issues.
