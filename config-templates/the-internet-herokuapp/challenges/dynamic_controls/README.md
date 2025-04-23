---
title: Dynamic Controls
path: config.json
description: Demonstrates interacting with controls (checkbox, input field) that can be dynamically enabled/disabled or added/removed. Uses `wait` for elements to become interactable.
tags: ["Navigation", "Dynamic Elements", "Forms", "Checkbox", "Input", "Wait", "Click", "Assert"]
difficulty: Intermediate
related_steps: ["goto", "click", "wait", "input", "assert"]
---

# Challenge: Dynamic Controls

This challenge features controls (a checkbox and an input field) that are initially disabled or absent and become enabled or present after clicking corresponding buttons. It tests the ability to wait for elements to become interactable.

## Approach

The `config.json` for this challenge demonstrates the following sequence:

1.  **`goto`**: Navigates to the `/dynamic_controls` page.
2.  **Remove/Add Checkbox:**
    *   **`click`**: Clicks the "Remove" button for the checkbox.
    *   **`wait`**: Waits for the loading indicator (`#loading`) to disappear.
    *   **`assert`**: Asserts that the checkbox (`#checkbox`) is now hidden/gone.
    *   **`click`**: Clicks the "Add" button for the checkbox.
    *   **`wait`**: Waits for the loading indicator (`#loading`) to disappear.
    *   **`assert`**: Asserts that the checkbox (`#checkbox`) now exists.
3.  **Enable/Disable Input:**
    *   **`assert`**: Asserts that the input field (`#input-example input`) initially has the `disabled` attribute.
    *   **`click`**: Clicks the "Enable" button for the input field.
    *   **`wait`**: Waits for the loading indicator (`#loading`) to disappear.
    *   **`assert`**: Asserts that the input field (`#input-example input`) no longer has the `disabled` attribute (using `isHidden` on the disabled selector).
    *   **`input`**: Types text into the now-enabled input field.
    *   **`click`**: Clicks the "Disable" button.
    *   **`wait`**: Waits for the loading indicator (`#loading`) to disappear.
    *   **`assert`**: Asserts that the input field (`#input-example input`) now has the `disabled` attribute again.

## Configuration (`config.json`)

(See the `config.json` file in this directory)

## Expected Outcome

The navigation flow should complete successfully, demonstrating the ability to wait for elements to change state (appear/disappear, become enabled/disabled) before interacting with them or asserting their state.
