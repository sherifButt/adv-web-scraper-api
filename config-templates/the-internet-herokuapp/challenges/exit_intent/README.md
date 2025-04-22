---
title: Exit Intent
path: exit_intent/config.json
description: Navigates to a page that triggers a modal when the mouse moves towards the top of the viewport (exit intent). Demonstrates waiting for and closing the modal.
tags: ["Navigation", "Exit Intent", "Modal", "Popup", "Mouse Interaction", "Wait", "Click"]
difficulty: Hard
related_steps: ["goto", "mousemove", "wait", "click"]
---

# Challenge: Exit Intent

This challenge involves a page that displays a modal window when the mouse cursor moves out of the main viewport towards the top, simulating an "exit intent" behavior.

## Approach

Triggering exit intent reliably via automation can be tricky. This configuration attempts it using `mousemove`, but success might depend on browser/environment specifics.

1.  **`goto`**: Navigates to the `/exit_intent` page.
2.  **`wait`**: A short pause to ensure the page and its scripts are fully loaded.
3.  **`mousemove`**: Attempts to trigger the exit intent by moving the mouse from the center of the page (`selector: "body"`) towards the top-left corner (`x: 0, y: 0`) over a short duration.
4.  **`wait`**: Waits for the modal window (`#ouibounce-modal`) to become visible. This has a longer timeout as the trigger might be inconsistent. This step is marked `optional` as the `mousemove` might not always successfully trigger the modal in an automated environment.
5.  **`condition`**: Checks if the modal actually appeared (using the same selector).
6.  **`click` (within `thenSteps`)**: If the modal appeared, this clicks the close link in the modal footer.

## Configuration (`config.json`)

(See the `config.json` file in this directory)

## Expected Outcome

The navigation flow should complete. Ideally, the exit intent modal appears and is closed. However, due to the nature of simulating exit intent, the modal might not always trigger. The `wait` and `condition` steps handle this potential inconsistency gracefully. No specific data is extracted.
