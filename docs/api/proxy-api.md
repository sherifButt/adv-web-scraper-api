# Proxy API Documentation

The Proxy API provides endpoints for managing and interacting with the proxy system. This includes listing available proxies, testing proxies, and rotating proxies.

## Endpoints

### List Available Proxies
`GET /api/v1/proxy/list`

Returns a list of all configured proxies from the proxies.txt file.

#### Request
```http
GET /api/v1/proxy/list
```

#### Response
```json
{
  "success": true,
  "count": 10,
  "proxies": [
    "123.45.67.89:8080",
    "111.222.333.444:3128",
    "proxy.example.com:8080",
    "user:pass@proxy1.example.com:8080",
    "192.168.1.100:8888",
    "45.67.89.123:3128",
    "proxy2.example.com:80",
    "admin:admin123@proxy3.example.com:8080",
    "10.0.0.1:8080",
    "proxy4.example.com:443"
  ]
}
```

### Get Proxy Status
`GET /api/v1/proxy`

Returns general proxy system status and statistics.

#### Request
```http
GET /api/v1/proxy
```

#### Response
```json
{
  "success": true,
  "message": "Proxy status placeholder",
  "data": {
    "enabled": true,
    "totalProxies": 25,
    "activeProxies": 18,
    "countries": ["US", "UK", "DE", "FR", "JP"],
    "types": ["http", "https", "socks5"],
    "lastUpdated": "2025-12-04T19:46:53.000Z"
  }
}
```

### Test Proxy
`POST /api/v1/proxy/test`

Tests a specific proxy connection.

#### Request
```http
POST /api/v1/proxy/test
Content-Type: application/json

{
  "host": "proxy.example.com",
  "port": 8080,
  "type": "http",
  "username": "user",
  "password": "pass"
}
```

#### Response
```json
{
  "success": true,
  "message": "Proxy test placeholder",
  "data": {
    "host": "proxy.example.com",
    "port": 8080,
    "type": "http",
    "working": true,
    "responseTime": 250,
    "ip": "203.0.113.1",
    "country": "US",
    "timestamp": "2025-12-04T19:46:53.000Z"
  }
}
```

### Rotate Proxy
`POST /api/v1/proxy/rotate`

Rotates to a new proxy based on criteria.

#### Request
```http
POST /api/v1/proxy/rotate
Content-Type: application/json

{
  "country": "US",
  "type": "http",
  "session": "session123"
}
```

#### Response
```json
{
  "success": true,
  "message": "Proxy rotation placeholder",
  "data": {
    "host": "203.0.113.2",
    "port": 8080,
    "type": "http",
    "country": "US",
    "session": "session123",
    "timestamp": "2025-12-04T19:46:53.000Z"
  }
}
```

## Error Responses

### Proxy File Not Found
```json
{
  "success": false,
  "message": "Failed to read proxies file",
  "error": "ENOENT: no such file or directory, open 'proxies.txt'"
}
```

### Invalid Proxy Format
```json
{
  "success": false,
  "message": "Invalid proxy format",
  "error": "Proxy must be in format host:port or user:pass@host:port"
}
```

### Validate All Proxies
`POST /api/v1/proxy/validate`

Tests and validates all proxies in the list.

#### Request
```http
POST /api/v1/proxy/validate
```

#### Response
```json
{
  "success": true,
  "message": "Proxy validation completed",
  "results": [
    {
      "proxy": "123.45.67.89:8080",
      "valid": true,
      "responseTime": 250,
      "lastChecked": "2025-12-04T19:54:10.000Z"
    },
    {
      "proxy": "111.222.333.444:3128",
      "valid": false,
      "responseTime": null,
      "lastChecked": "2025-12-04T19:54:10.000Z"
    }
  ]
}
```

### Clean Proxy List
`POST /api/v1/proxy/clean`

Removes invalid proxies from the list.

#### Request
```http
POST /api/v1/proxy/clean
```

#### Response
```json
{
  "success": true,
  "message": "Proxy list cleaned",
  "removed": 5,
  "remaining": 15
}
```

## Best Practices

1. **Proxy Management**
   - Keep proxies.txt updated with working proxies
   - Use authentication when available
   - Group proxies by type/country in the file with comments

2. **Usage Patterns**
   - Test proxies before adding them to the pool
   - Rotate proxies regularly to avoid detection
   - Monitor proxy health and response times

3. **Security**
   - Never commit proxies.txt with credentials to version control
   - Use environment variables for sensitive credentials
   - Restrict access to the proxy API endpoints
