---
title: Challenging DOM
path: config.json
description: Navigates to a page with elements that change ID on refresh, demonstrating interaction with elements based on stable attributes or structure. Extracts table data.
tags: ["Navigation", "DOM Manipulation", "Dynamic Elements", "Click", "Extraction", "Tables"]
difficulty: Intermediate
related_steps: ["goto", "click", "extract"]
---

# Challenge: Challenging DOM

This challenge presents a page where button IDs and other attributes change on every page load, making simple ID-based selectors unreliable. It also includes a table with data and action links (edit/delete).

## Approach

The `config.json` for this challenge focuses on interacting with the stable elements and extracting the table data:

1.  **`goto`**: Navigates to the `/challenging_dom` page.
2.  **`click`**: Clicks the first (blue) button. Since its ID changes, the selector targets it based on its class (`button`) and position (`:nth-of-type(1)`).
3.  **`click`**: Clicks the second (red) button, again using class and position (`.button.alert`).
4.  **`click`**: Clicks the third (green) button (`.button.success`).
5.  **`extract`**: Extracts data from the table.
    *   It selects all table rows (`tbody tr`).
    *   For each row, it extracts the text from each cell (`td`).
    *   It also extracts the `href` attribute from the 'edit' and 'delete' links within the last cell.

## Configuration (`config.json`)

(See the `config.json` file in this directory)

## Expected Outcome

The navigation flow should complete successfully. The `result` object in the final output should contain a `challengingDomTable` field, which is an array of objects, each representing a row from the table with its cell data and action links.
