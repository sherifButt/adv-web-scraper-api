---
title: Dynamic Loading
path: config.json
description: Demonstrates waiting for dynamically loaded content to appear after clicking a button. Covers two examples on the page.
tags: ["Navigation", "Dynamic Content", "Wait", "Click", "Assert", "Extraction"]
difficulty: Intermediate
related_steps: ["goto", "click", "wait", "assert", "extract"]
---

# Challenge: Dynamic Loading

This challenge presents two examples of content that is hidden and loaded dynamically after a button click.

## Approach

The `config.json` handles both examples on the page:

1.  **`goto`**: Navigates to the `/dynamic_loading` page.

2.  **Example 1 (Element is hidden on page load):**
    *   **`goto`**: Navigates to the specific sub-page `/dynamic_loading/1`.
    *   **`click`**: Clicks the "Start" button (`#start button`).
    *   **`wait`**: Waits for the loading indicator (`#loading`) to disappear (`state: "hidden"`).
    *   **`wait`**: Waits for the result container (`#finish`) to become visible (`state: "visible"`).
    *   **`extract`**: Extracts the text ("Hello World!") from the result container (`#finish h4`).

3.  **Example 2 (Element is rendered after the fact):**
    *   **`goto`**: Navigates to the specific sub-page `/dynamic_loading/2`.
    *   **`click`**: Clicks the "Start" button (`#start button`).
    *   **`wait`**: Waits for the loading indicator (`#loading`) to disappear (`state: "hidden"`).
    *   **`wait`**: Waits for the result container (`#finish`) to appear in the DOM and become visible (`state: "visible"`).
    *   **`extract`**: Extracts the text ("Hello World!") from the result container (`#finish h4`).

## Configuration (`config.json`)

(See the `config.json` file in this directory)

## Expected Outcome

The navigation flow should complete successfully. The `result` object in the final output should contain `dynamicLoadResult1` and `dynamicLoadResult2` fields, each containing the extracted "Hello World!" message from the respective examples.
