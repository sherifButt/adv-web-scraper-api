---
title: JQuery UI Menus
path: jquery_ui_menus/config.json
description: Demonstrates interacting with a JQuery UI menu involving multiple hover actions to reveal submenus and download a file.
tags: ["Navigation", "Menu", "Hover", "Click", "Wait", "JQuery UI"]
difficulty: Medium
related_steps: ["goto", "hover", "wait", "click"]
---

# Challenge: JQuery UI Menus

This challenge involves interacting with a multi-level menu built with JQuery UI. Accessing the final item requires hovering over intermediate menu items.

## Approach

The `config.json` simulates the user interaction needed to navigate the menu:

1.  **`goto`**: Navigates to the `/jqueryui/menu` page.
2.  **`hover`**: Hovers over the "Enabled" top-level menu item (`#ui-id-3`).
3.  **`wait`**: Waits for the submenu (`#ui-id-4`) to become visible.
4.  **`hover`**: Hovers over the "Downloads" submenu item (`#ui-id-4`).
5.  **`wait`**: Waits for the next level submenu (`#ui-id-5`) to become visible.
6.  **`click`**: Clicks the "PDF" item (`#ui-id-7`) within the final submenu. This action typically initiates a file download.

**Note:** Similar to the File Download challenge, this config only initiates the download by clicking the link. Actual download verification is outside the scope of this config.

## Configuration (`config.json`)

(See the `config.json` file in this directory)

## Expected Outcome

The navigation flow should complete successfully after navigating through the hover-activated submenus and clicking the final download link.
