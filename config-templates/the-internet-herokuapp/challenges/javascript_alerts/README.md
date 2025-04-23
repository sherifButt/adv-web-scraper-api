---
title: JavaScript Alerts
path: config.json
description: Demonstrates handling different types of JavaScript dialogs (alert, confirm, prompt) using the `handleDialog` step.
tags: ["Navigation", "JavaScript Alert", "Dialog Handling", "Click", "Assert"]
difficulty: Beginner
related_steps: ["goto", "handleDialog", "click", "assert"]
---

# Challenge: JavaScript Alerts

This challenge involves interacting with buttons that trigger different standard JavaScript dialog boxes: `alert`, `confirm`, and `prompt`.

## Approach

The `config.json` demonstrates handling each type of dialog:

1.  **`goto`**: Navigates to the `/javascript_alerts` page.
2.  **Handle JS Alert:**
    *   **`handleDialog`**: Sets up a listener to `accept` the next dialog.
    *   **`click`**: Clicks the "Click for JS Alert" button. The dialog is automatically accepted.
    *   **`assert`**: Checks the result text confirms the alert was handled.
3.  **Handle JS Confirm (Accept):**
    *   **`handleDialog`**: Sets up a listener to `accept` the next dialog.
    *   **`click`**: Clicks the "Click for JS Confirm" button.
    *   **`assert`**: Checks the result text confirms "Ok" was clicked.
4.  **Handle JS Confirm (Dismiss):**
    *   **`handleDialog`**: Sets up a listener to `dismiss` the next dialog.
    *   **`click`**: Clicks the "Click for JS Confirm" button again.
    *   **`assert`**: Checks the result text confirms "Cancel" was clicked.
5.  **Handle JS Prompt (Accept with Text):**
    *   **`handleDialog`**: Sets up a listener to `accept` the next dialog, providing text (`promptText`) to be entered.
    *   **`click`**: Clicks the "Click for JS Prompt" button.
    *   **`assert`**: Checks the result text includes the entered text.
6.  **Handle JS Prompt (Dismiss):**
    *   **`handleDialog`**: Sets up a listener to `dismiss` the next dialog.
    *   **`click`**: Clicks the "Click for JS Prompt" button again.
    *   **`assert`**: Checks the result text confirms the prompt was cancelled (resulting in `null` input).

## Configuration (`config.json`)

(See the `config.json` file in this directory)

## Expected Outcome

The navigation flow should complete successfully, demonstrating the handling of all three dialog types (accepting, dismissing, and providing input to prompts) and asserting the expected outcome text for each interaction.
