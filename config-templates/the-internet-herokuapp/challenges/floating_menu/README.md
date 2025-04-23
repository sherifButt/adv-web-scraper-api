---
title: Floating Menu
path: config.json
description: Demonstrates scrolling the page and asserting that a floating menu remains visible.
tags: ["Navigation", "Scrolling", "Assert", "Visibility"]
difficulty: Beginner
related_steps: ["goto", "scroll", "assert"]
---

# Challenge: Floating Menu

This challenge involves a page with a menu that stays fixed at the top of the viewport even when the page is scrolled.

## Approach

The `config.json` for this challenge verifies the floating behavior:

1.  **`goto`**: Navigates to the `/floating_menu` page.
2.  **`scroll`**: Scrolls the page down by 1000 pixels.
3.  **`assert`**: Asserts that the menu element (`#menu`) is still visible (`assertionType: "isVisible"`) after scrolling.

## Configuration (`config.json`)

(See the `config.json` file in this directory)

## Expected Outcome

The navigation flow should complete successfully, confirming that the menu remains visible after scrolling down the page.
