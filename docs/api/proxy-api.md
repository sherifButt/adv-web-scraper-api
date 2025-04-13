# Proxy API Documentation

The Proxy API provides endpoints for managing and interacting with the proxy pool used by the web scraper.

## Base URL
All endpoints are prefixed with `/api/v1/proxy`

## Endpoints

### GET /list
Get a list of all available proxies with optional filtering.

**Query Parameters:**
- `type` - Filter by protocol (http, https, socks4, socks5)
- `country` - Filter by country code
- `city` - Filter by city  
- `region` - Filter by region
- `asn` - Filter by ASN
- `anonymityLevel` - Filter by anonymity level
- `minSpeed` - Minimum speed requirement
- `maxLatency` - Maximum allowed latency
- `minUpTime` - Minimum uptime percentage
- `minSuccessRate` - Minimum internal success rate

**Example Response:**
```json
{
  "success": true,
  "count": 42,
  "proxies": [
    {
      "ip": "192.168.1.1",
      "port": 8080,
      "protocols": ["http", "https"],
      "country": "US",
      "city": "New York",
      "latency": 120,
      "upTime": 99.5,
      "successRate": 0.85
    }
  ]
}
```

### GET /stats
Get statistics about available proxies.

**Response:**
```json
{
  "success": true,
  "message": "Proxy statistics retrieved successfully",
  "data": {
    "total": 100,
    "healthy": 85,
    "byProtocol": {
      "http": 60,
      "https": 40
    },
    "byCountry": {
      "US": 50,
      "UK": 30
    },
    "avgLatency": 150,
    "avgInternalResponseTime": 200,
    "avgUpTime": 95.5
  }
}
```

### POST /test
Test a specific proxy.

**Request Body:**
```json
{
  "ip": "192.168.1.1",
  "port": 8080,
  "type": "http"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Proxy test completed",
  "data": {
    "success": true,
    "responseTime": 250
  }
}
```

### POST /rotate
Get a new proxy with optional targeting.

**Request Body:**
```json
{
  "type": "https",
  "country": "US",
  "minSuccessRate": 0.8
}
```

**Response:**
```json
{
  "success": true,
  "message": "Proxy rotated successfully",
  "data": {
    "ip": "192.168.1.2",
    "port": 3128,
    "protocols": ["https"],
    "country": "US",
    "latency": 100,
    "responseTime": 150,
    "upTime": 99.8
  }
}
```

### POST /clean
Clean the proxy list by removing invalid proxies.

**Response:**
```json
{
  "success": true,
  "message": "Proxy list cleaned based on internal success rate",
  "removedCount": 15,
  "remainingCount": 85
}
```

## Error Responses

All endpoints return standardized error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

Common status codes:
- 400 - Bad request (validation errors)
- 404 - Not found (no proxies available)
- 500 - Internal server error
