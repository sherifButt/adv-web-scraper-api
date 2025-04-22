---
title: Dynamic Content
path: dynamic_content/config.json
description: Navigates to a page where content (text and images) changes on each refresh. Extracts the dynamic content present on load.
tags: ["Navigation", "Dynamic Content", "Extraction"]
difficulty: Easy
related_steps: ["goto", "extract"]
---

# Challenge: Dynamic Content

This challenge involves a page where the text and images change each time the page is loaded or refreshed.

## Approach

The `config.json` for this challenge focuses on capturing the content as it appears on a single load:

1.  **`goto`**: Navigates to the `/dynamic_content` page.
2.  **`extract`**: Extracts the `src` attribute of all images and the text content of all description paragraphs (`.row .large-10`).
    *   `multiple: true` is used to capture all matching image and text elements.

## Configuration (`config.json`)

(See the `config.json` file in this directory)

## Expected Outcome

The navigation flow should complete successfully. The `result` object in the final output should contain a `dynamicContent` field, which is an array of objects. Each object represents a content row and contains the `imageSrc` and `text` extracted during that specific page load. The content will likely differ on subsequent runs.
