---
title: File Download
path: config.json
description: Demonstrates navigating to the file download page and clicking a download link. Note that the actual download handling happens outside the scope of this config.
tags: ["Navigation", "File Download", "Click"]
difficulty: Beginner
related_steps: ["goto", "click"]
---

# Challenge: File Download

This challenge involves navigating to a page with links that trigger file downloads.

## Approach

The `config.json` for this challenge simply navigates to the page and clicks the first download link:

1.  **`goto`**: Navigates to the `/download` page.
2.  **`click`**: Clicks the first link within the `.example` div (which corresponds to `some-file.txt`).

**Important Note:** This configuration only *initiates* the download by clicking the link. Playwright (and therefore this API) handles downloads automatically based on browser configuration. The downloaded file's path or status is not directly tracked or returned by this specific configuration. Verifying the download would typically require checking the filesystem after the navigation flow completes or configuring Playwright's download behavior externally.

## Configuration (`config.json`)

(See the `config.json` file in this directory)

## Expected Outcome

The navigation flow should complete successfully after clicking the download link. The browser will handle the download process itself.
