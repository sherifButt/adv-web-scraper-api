---
title: Disappearing Elements
path: disappearing_elements/config.json
description: Navigates to a page where elements (menu items) might not be present on initial load or after refresh. Demonstrates extracting available elements.
tags: ["Navigation", "Dynamic Elements", "Extraction", "Optional Elements"]
difficulty: Easy
related_steps: ["goto", "extract"]
---

# Challenge: Disappearing Elements

This challenge involves navigating to a page where some elements (specifically, menu items) may or may not be present depending on the page load.

## Approach

The `config.json` for this challenge focuses on extracting the text of all available top-level menu items (`li > a`) without failing if some are missing:

1.  **`goto`**: Navigates to the `/disappearing_elements` page.
2.  **`extract`**: Extracts the text content from all list item links (`li > a`) within the main example div (`.example`).
    *   `multiple: true` is used to get all matching elements.
    *   The default behavior of `extract` (or setting `continueOnError: true` within fields) handles cases where some elements might not be found without stopping the flow.

## Configuration (`config.json`)

(See the `config.json` file in this directory)

## Expected Outcome

The navigation flow should complete successfully. The `result` object in the final output should contain a `menuItems` field, which is an array of objects, each containing the `text` of a menu item link that was present on the page during that specific run. The number of items in the array may vary between runs.
