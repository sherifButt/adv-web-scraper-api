---
title: Horizontal Slider
path: config.json
description: Demonstrates interacting with a horizontal slider using keyboard arrow keys (via `input` step) and asserting the displayed value.
tags: ["Navigation", "Forms", "Slider", "Input", "Keyboard Simulation", "Assert"]
difficulty: Intermediate
related_steps: ["goto", "click", "input", "assert"]
---

# Challenge: Horizontal Slider

This challenge involves interacting with a horizontal range slider (`<input type="range">`). The value changes when the slider handle is moved, typically via mouse drag or keyboard arrows.

## Approach

Since precise mouse dragging on a slider can be complex to automate reliably across different screen sizes/resolutions, this configuration uses keyboard interaction:

1.  **`goto`**: Navigates to the `/horizontal_slider` page.
2.  **`click`**: Clicks the slider element (`input[type='range']`) to ensure it has focus for subsequent keyboard events.
3.  **`input`**: Sends the `{ArrowRight}` key press to the focused slider element. This simulates pressing the right arrow key once, incrementing the slider value (typically by 0.5 for this specific slider).
4.  **`assert`**: Asserts that the displayed value (`#range`) now contains "0.5".
5.  **`input`**: Sends the `{ArrowRight}` key press four more times to reach the value "2.5".
6.  **`assert`**: Asserts that the displayed value (`#range`) now contains "2.5".

## Configuration (`config.json`)

(See the `config.json` file in this directory)

## Expected Outcome

The navigation flow should complete successfully, demonstrating interaction with the slider using simulated keyboard inputs and confirming the resulting value changes via assertions.
