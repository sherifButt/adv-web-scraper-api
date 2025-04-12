# Browser Configuration Options

The Advanced Web Scraper API provides extensive browser configuration options when creating sessions. These settings allow fine-grained control over the browser environment used for scraping.

## Core Browser Configuration

```typescript
interface BrowserConfig {
  userAgent?: string;
  headless?: boolean;
  device?: 'desktop' | 'mobile' | 'tablet';
  viewport?: {
    width: number;
    height: number;
  };
  language?: string;
  timezone?: string;
  stealth?: boolean;
}
```

## Configuration Details

### 1. User Agent
- **Type**: `string`
- **Default**: System default
- **Description**: Sets the browser's user agent string
- **Example**: 
  ```json
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
  ```

### 2. Headless Mode
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Runs browser without GUI when true
- **Example**:
  ```json
  "headless": false
  ```

### 3. Device Emulation
- **Type**: `'desktop' | 'mobile' | 'tablet'`
- **Default**: `'desktop'`
- **Description**: Emulates different device types
- **Example**:
  ```json
  "device": "mobile"
  ```

### 4. Viewport Settings
- **Type**: `object`
- **Properties**:
  - `width`: Number between 800-3840
  - `height`: Number between 600-2160
- **Default**: `{ width: 1280, height: 720 }`
- **Example**:
  ```json
  "viewport": {
    "width": 1920,
    "height": 1080
  }
  ```

### 5. Language
- **Type**: `string`
- **Format**: BCP 47 language tag (e.g. "en-US")
- **Default**: System default
- **Example**:
  ```json
  "language": "fr-FR"
  ```

### 6. Timezone
- **Type**: `string`
- **Values**: Valid IANA timezone (e.g. "America/New_York")
- **Default**: System default
- **Example**:
  ```json
  "timezone": "Asia/Tokyo"
  ```

### 7. Stealth Mode
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enables anti-detection measures when true
- **Example**:
  ```json
  "stealth": true
  ```

## Example Configuration

```json
{
  "browser": {
    "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X)",
    "headless": false,
    "device": "mobile",
    "viewport": {
      "width": 375,
      "height": 812
    },
    "language": "en-GB",
    "timezone": "Europe/London",
    "stealth": true
  }
}
```

## Best Practices

1. **Mobile Emulation**: Use mobile device settings when scraping mobile-optimized sites
2. **Stealth Mode**: Enable for sites with strong bot detection
3. **Viewports**: Match target site's responsive breakpoints
4. **Language/Timezone**: Set to match target audience locale
5. **Testing**: Always test configurations in non-headless mode first
