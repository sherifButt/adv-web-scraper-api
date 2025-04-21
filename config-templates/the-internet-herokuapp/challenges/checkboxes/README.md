---
title: Checkboxes
path: checkboxes/config.json
description: Navigates to a page with checkboxes and demonstrates clicking them. Includes optional assertion steps (commented out) for checking state.
tags: ["Navigation", "Forms", "Checkboxes", "Click", "Assert"]
difficulty: Easy
related_steps: ["goto", "click", "assert"]
---

# Challenge: Checkboxes

This challenge involves interacting with standard HTML checkboxes.

## Approach

The `config.json` for this challenge performs the following:

1.  **`goto`**: Navigates to the `/checkboxes` page.
2.  **`click`**: Clicks the first checkbox using a positional selector (`:first-of-type`).
3.  **`click`**: Clicks the second (last) checkbox using a positional selector (`:last-of-type`).
4.  **(Optional/Commented Out) `assert`**: Includes commented-out examples of how one might assert the checked state. Checking checkbox state reliably often requires inspecting the `checked` property via `executeScript` or checking for a specific attribute if the HTML uses one, as the visual state might not be enough.

## Configuration (`config.json`)

(See the `config.json` file in this directory)

## Expected Outcome

The navigation flow should complete successfully, demonstrating clicking both checkboxes. No specific data is extracted, but the commented assertions provide guidance for state validation if needed.
