---
title: JavaScript onload event error
path: javascript_error/config.json
description: Navigates to a page that intentionally throws a JavaScript error on load. Demonstrates simple navigation.
tags: ["Navigation", "JavaScript Error", "Error Handling"]
difficulty: Easy
related_steps: ["goto"]
---

# Challenge: JavaScript onload event error

This challenge involves navigating to a page that is designed to throw a JavaScript error in its `onload` event handler.

## Approach

The `config.json` for this challenge simply navigates to the page:

1.  **`goto`**: Navigates to the `/javascript_error` page.

**Note:** The `adv-web-scraper-api` itself doesn't automatically fail or stop on encountering page-level JavaScript errors like this (unless the error prevents navigation itself). Detecting and asserting specific JavaScript errors would typically require listening for `pageerror` events within Playwright, which is beyond the scope of a standard navigation configuration.

## Configuration (`config.json`)

(See the `config.json` file in this directory)

## Expected Outcome

The navigation flow should complete successfully, landing on the target page despite the JavaScript error occurring in the browser console. No specific data is extracted or asserted.
