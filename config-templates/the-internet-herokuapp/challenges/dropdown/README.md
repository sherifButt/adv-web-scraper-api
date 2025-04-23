---
title: Dropdown List
path: config.json
description: Demonstrates selecting options from a standard HTML dropdown list using both value attribute and visible text, and asserting the selection.
tags: ["Navigation", "Forms", "Dropdown", "Select", "Assert"]
difficulty: Beginner
related_steps: ["goto", "select", "assert"]
---

# Challenge: Dropdown List

This challenge involves selecting options from a standard HTML `<select>` dropdown element.

## Approach

The `config.json` for this challenge demonstrates two ways to select options using the `select` step:

1.  **`goto`**: Navigates to the `/dropdown` page.
2.  **`select`**: Selects "Option 1" by specifying its `value` attribute ("1").
3.  **`assert`**: Confirms "Option 1" is selected by checking the text content of the element with the `selected` attribute.
4.  **`select`**: Selects "Option 2" by specifying its visible text ("Option 2").
5.  **`assert`**: Confirms "Option 2" is selected using the same assertion method.

## Configuration (`config.json`)

(See the `config.json` file in this directory)

## Expected Outcome

The navigation flow should complete successfully, demonstrating the selection of dropdown options by both value and text, with assertions confirming the selections.
