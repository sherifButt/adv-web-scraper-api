---
title: Entry Ad
path: entry_ad/config.json
description: Handles a modal window (entry ad) that appears shortly after page load. Waits for the modal and clicks the close button.
tags: ["Navigation", "Modal", "Popup", "Wait", "Click"]
difficulty: Medium
related_steps: ["goto", "wait", "click"]
---

# Challenge: Entry Ad

This challenge involves a page that displays a modal window (an "entry ad") shortly after the page loads. The goal is to detect and close this modal.

## Approach

The `config.json` for this challenge performs the following:

1.  **`goto`**: Navigates to the `/entry_ad` page.
2.  **`wait`**: Waits for the modal window element (`.modal`) to become visible. A suitable timeout is included to allow the modal to appear.
3.  **`click`**: Clicks the close button within the modal (`.modal-footer p`).

## Configuration (`config.json`)

(See the `config.json` file in this directory)

## Expected Outcome

The navigation flow should complete successfully after waiting for and closing the modal window. No specific data is extracted.
