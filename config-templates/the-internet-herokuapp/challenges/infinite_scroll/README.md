---
title: Infinite Scroll
path: config.json
description: Demonstrates handling an infinite scroll page by repeatedly scrolling down and extracting the newly loaded content.
tags: ["Navigation", "Scrolling", "Infinite Scroll", "Dynamic Content", "Extraction", "Loop"]
difficulty: Intermediate
related_steps: ["goto", "scroll", "extract", "wait"]
---

# Challenge: Infinite Scroll

This challenge involves a page where more content is loaded dynamically as the user scrolls down.

## Approach

The `config.json` for this challenge simulates scrolling down multiple times to load more content and extracts all the generated paragraphs:

1.  **`goto`**: Navigates to the `/infinite_scroll` page.
2.  **`scroll`**: Scrolls down by 1000 pixels to trigger the first content load.
3.  **`wait`**: Pauses briefly (e.g., 1000ms) to allow content to load after the scroll.
4.  **`scroll`**: Scrolls down again.
5.  **`wait`**: Pauses again.
6.  **`scroll`**: Scrolls down a third time.
7.  **`wait`**: Pauses a final time.
8.  **`extract`**: Extracts the text content of all paragraphs (`.jscroll-added`) that were added by the infinite scroll mechanism.

**Note:** A more robust implementation might use a loop (`condition` + `gotoStep`) or the `paginate` step (if applicable) combined with checks to see if new content has actually loaded after each scroll, stopping when no new content appears. This example uses a fixed number of scrolls for simplicity.

## Configuration (`config.json`)

(See the `config.json` file in this directory)

## Expected Outcome

The navigation flow should complete successfully. The `result` object in the final output should contain an `infiniteScrollParagraphs` field, which is an array of objects, each containing the `text` of a paragraph loaded via infinite scroll.
