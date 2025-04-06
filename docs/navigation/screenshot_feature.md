# Screenshot Feature

The Advanced Web Scraper API includes a screenshot capability that allows you to automatically capture screenshots during navigation steps. This feature is particularly useful for debugging, monitoring, and verifying the navigation process.

## Table of Contents

- [Overview](#overview)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [Accessing Screenshots](#accessing-screenshots)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The screenshot feature captures full-page screenshots at key points during the navigation process:

- Before executing each navigation step
- After executing each navigation step
- At any point where errors occur

Screenshots are saved to a specified directory with filenames that include the step index, step type, and timestamp, making it easy to track the navigation flow visually.

## Configuration

To enable screenshots in your navigation requests, include the following options in your request:

```json
{
  "startUrl": "https://example.com",
  "steps": [
    // Your navigation steps here
  ],
  "options": {
    "screenshots": true,
    "screenshotsPath": "./screenshots" // Optional, defaults to "./screenshots"
  }
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `screenshots` | boolean | `false` | Enable or disable screenshot capture |
| `screenshotsPath` | string | `"./screenshots"` | Directory where screenshots will be saved |

## Usage Examples

### Example 1: Basic Screenshot Configuration

```json
{
  "startUrl": "https://example.com/login",
  "steps": [
    {
      "type": "input",
      "selector": "#username",
      "value": "testuser",
      "description": "Enter username"
    },
    {
      "type": "input",
      "selector": "#password",
      "value": "password123",
      "description": "Enter password"
    },
    {
      "type": "click",
      "selector": "#login-button",
      "waitFor": ".dashboard",
      "description": "Click login button"
    }
  ],
  "options": {
    "screenshots": true
  }
}
```

This configuration will capture 6 screenshots:
- Before entering the username
- After entering the username
- Before entering the password
- After entering the password
- Before clicking the login button
- After clicking the login button (showing the dashboard)

### Example 2: Custom Screenshot Directory

```json
{
  "startUrl": "https://example.com/products",
  "steps": [
    {
      "type": "click",
      "selector": ".product-category",
      "waitFor": ".product-list",
      "description": "Click on a product category"
    },
    {
      "type": "extract",
      "name": "products",
      "selector": ".product-item",
      "multiple": true,
      "fields": {
        "name": ".product-name",
        "price": ".product-price"
      },
      "description": "Extract product information"
    }
  ],
  "options": {
    "screenshots": true,
    "screenshotsPath": "./screenshots/product-extraction"
  }
}
```

This configuration will save screenshots to the `./screenshots/product-extraction` directory.

### Example 3: Debugging CAPTCHA Issues

```json
{
  "startUrl": "https://example.com/login",
  "steps": [
    {
      "type": "input",
      "selector": "#username",
      "value": "testuser",
      "description": "Enter username"
    },
    {
      "type": "input",
      "selector": "#password",
      "value": "password123",
      "description": "Enter password"
    },
    {
      "type": "click",
      "selector": "#login-button",
      "description": "Click login button"
    },
    {
      "type": "wait",
      "value": ".dashboard, .captcha-container",
      "description": "Wait for either dashboard or CAPTCHA"
    }
  ],
  "options": {
    "screenshots": true,
    "solveCaptcha": true
  }
}
```

This configuration will capture screenshots before and after each step, including when a CAPTCHA appears and after it's solved.

## Accessing Screenshots

The screenshot paths are included in the navigation result response:

```json
{
  "success": true,
  "message": "Navigation flow executed successfully",
  "data": {
    "id": "nav_1234567890",
    "startUrl": "https://example.com/login",
    "status": "completed",
    "stepsExecuted": 3,
    "result": {
      // Extracted data
    },
    "screenshots": [
      "./screenshots/0_before_input_1234567890.png",
      "./screenshots/0_after_input_1234567890.png",
      "./screenshots/1_before_input_1234567890.png",
      "./screenshots/1_after_input_1234567890.png",
      "./screenshots/2_before_click_1234567890.png",
      "./screenshots/2_after_click_1234567890.png"
    ],
    "timestamp": "2025-04-06T12:34:56.789Z"
  }
}
```

## Best Practices

1. **Use Descriptive Step Descriptions**
   - Add clear descriptions to your navigation steps to make it easier to identify screenshots.

2. **Organize Screenshots by Task**
   - Use custom screenshot directories for different tasks or websites.

3. **Clean Up Old Screenshots**
   - Implement a cleanup strategy to remove old screenshots and prevent disk space issues.

4. **Use Screenshots for Debugging**
   - Enable screenshots when debugging navigation issues to see exactly what's happening.

5. **Disable in Production**
   - Consider disabling screenshots in production environments to improve performance.

## Troubleshooting

### Common Issues

1. **Missing Screenshots**
   - Ensure the screenshots directory exists and is writable.
   - Check that the `screenshots` option is set to `true`.

2. **Permission Errors**
   - Verify that the process has permission to write to the screenshots directory.

3. **Disk Space Issues**
   - Regularly clean up old screenshots to prevent disk space problems.

4. **Performance Impact**
   - Taking screenshots, especially of long pages, can impact performance. Consider disabling screenshots for performance-critical operations.

### Debugging with Screenshots

When troubleshooting navigation issues:

1. Enable screenshots with `"screenshots": true`
2. Review the screenshots in the order they were taken
3. Look for unexpected page states or error messages
4. Check if elements are visible and in the expected state before interactions
