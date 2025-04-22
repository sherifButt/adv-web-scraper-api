---
title: Hovers
path: hovers/config.json
description: Demonstrates hovering over elements to reveal hidden information and asserting that the information becomes visible.
tags: ["Navigation", "Hover", "Mouse Interaction", "Wait", "Assert", "Visibility"]
difficulty: Easy
related_steps: ["goto", "hover", "wait", "assert"]
---

# Challenge: Hovers

This challenge involves hovering the mouse cursor over user profile images to reveal additional information (like name and a link) that appears dynamically.

## Approach

The `config.json` for this challenge simulates hovering over the first two images and asserting the revealed content:

1.  **`goto`**: Navigates to the `/hovers` page.
2.  **Hover Image 1:**
    *   **`hover`**: Moves the mouse cursor over the first image (`.figure:nth-of-type(1)`).
    *   **`wait`**: Waits for the caption element (`.figcaption`) within the first figure to become visible.
    *   **`assert`**: Asserts that the caption element is indeed visible (`assertionType: "isVisible"`).
    *   **`assert`**: Asserts that the `h5` element within the caption contains the expected text ("name: user1").
3.  **Hover Image 2:**
    *   **`hover`**: Moves the mouse cursor over the second image (`.figure:nth-of-type(2)`).
    *   **`wait`**: Waits for the caption element (`.figcaption`) within the second figure to become visible.
    *   **`assert`**: Asserts that the second caption element is visible.

## Configuration (`config.json`)

(See the `config.json` file in this directory)

## Expected Outcome

The navigation flow should complete successfully, demonstrating the ability to trigger hover effects, wait for resulting elements, and assert their visibility and content.
