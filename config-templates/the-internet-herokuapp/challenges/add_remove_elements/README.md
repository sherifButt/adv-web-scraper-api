---
title: Add/Remove Elements
path: config.json
description: Tests adding an element to the page via a button click, asserting its existence, clicking the new element to remove it, and asserting its removal.
tags: ["DOM Manipulation", "Click", "Assert", "Dynamic Elements"]
difficulty: Beginner
related_steps: ["goto", "click", "assert"]
---

# Challenge: Add/Remove Elements

This challenge involves interacting with buttons that dynamically add and remove elements from the page's Document Object Model (DOM).

## Approach

The `config.json` for this challenge performs the following steps:

1.  **`goto`**: Navigates to the `/add_remove_elements/` page.
2.  **`click`**: Clicks the "Add Element" button.
3.  **`assert`**: Checks that a new element with the class `added-manually` now exists (`assertionType: "exists"`).
4.  **`click`**: Clicks the newly added element (which acts as a "Delete" button).
5.  **`assert`**: Checks that the element with the class `added-manually` is now hidden or removed from the DOM (`assertionType: "isHidden"`).

## Configuration (`config.json`)

(See the `config.json` file in this directory)

## Expected Outcome

The navigation flow should complete successfully, demonstrating the ability to trigger DOM changes and validate the results using assertions. No specific data is extracted in this example.
