---
title: Geolocation
path: geolocation/config.json
description: Navigates to a page with a button to trigger the browser's Geolocation API. Clicks the button and extracts the resulting latitude/longitude. Requires browser permissions.
tags: ["Navigation", "Geolocation", "Browser API", "Click", "Wait", "Extract"]
difficulty: Medium
related_steps: ["goto", "click", "wait", "extract"]
---

# Challenge: Geolocation

This challenge involves clicking a button that uses the browser's Geolocation API to determine the user's current location (latitude and longitude).

## Approach

The `config.json` for this challenge attempts to get the location and extract it:

1.  **`goto`**: Navigates to the `/geolocation` page.
2.  **`click`**: Clicks the "Where am I?" button. This will trigger a browser permission prompt for location access the first time. **Note:** Automated browser contexts might handle this differently or require specific permission setup (e.g., via Playwright's context options) which is not configured in this basic example.
3.  **`wait`**: Waits for either the latitude (`#lat-value`) or an error message (`#map-link` becoming visible without latitude, indicating an error) to appear. This uses a more complex selector to handle both success and potential failure states gracefully. A longer timeout is used as geolocation can take time.
4.  **`extract`**: Extracts the text content of the latitude (`#lat-value`) and longitude (`#long-value`) elements if they appear. This step is marked `optional` because geolocation might fail or be denied.

## Configuration (`config.json`)

(See the `config.json` file in this directory)

## Expected Outcome

If browser permissions are granted (or pre-configured) and geolocation succeeds, the flow should complete successfully, and the `result` object should contain a `geoLocation` field with the detected `latitude` and `longitude`. If permissions are denied or geolocation fails, the flow should still complete (due to the optional extract step), but the `geoLocation` field might be missing or contain empty values.
