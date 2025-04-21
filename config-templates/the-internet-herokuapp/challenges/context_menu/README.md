---
title: Context Menu
path: context_menu/config.json
description: Demonstrates triggering a context menu (right-click) and handling the resulting JavaScript alert.
tags: ["Navigation", "Context Menu", "Right Click", "JavaScript Alert", "Dialog Handling"]
difficulty: Easy
related_steps: ["goto", "handleDialog", "click"]
---

# Challenge: Context Menu

This challenge involves right-clicking a specific area to trigger a context menu, which in turn triggers a JavaScript `alert()` dialog.

## Approach

The `config.json` for this challenge performs the following:

1.  **`goto`**: Navigates to the `/context_menu` page.
2.  **`handleDialog`**: Sets up a listener to automatically `accept` (click OK on) the *next* JavaScript dialog that appears. This step must come *before* the action that triggers the dialog.
3.  **`click`**: Performs a right-click (`button: "right"`) on the designated hot spot element (`#hot-spot`). This triggers the alert, which is then automatically accepted by the listener set up in the previous step.

## Configuration (`config.json`)

(See the `config.json` file in this directory)

## Expected Outcome

The navigation flow should complete successfully, demonstrating the ability to perform a right-click and handle the subsequent JavaScript alert without user intervention. No specific data is extracted.
