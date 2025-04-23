---
title: "Multiple Windows"
path: config.json
description: "Demonstrates opening a new browser window."
tags: ["interaction", "windows", "tabs"]
difficulty: Intermediate
related_steps: ["goto", "click", "switchTab", "extract"]
---

## Multiple Windows Challenge

This page contains a link that opens a new browser window (or tab).

### Goal
Click the link, switch to the new window/tab, extract content from it, and potentially switch back. This tests the ability to manage multiple browser contexts.

### Configuration (`config.json`)
The configuration should include steps to:
1. Navigate to the Multiple Windows page.
2. Click the link that opens the new window.
3. Use the `switchTab` step (or similar mechanism if implemented differently) to change focus to the new window/tab.
4. Extract content from the new window/tab.
5. Optionally, switch back to the original window/tab.

*Note: The exact implementation might depend on how tab/window switching is handled in the navigation engine (e.g., using a dedicated `switchTab` step or managing contexts implicitly).*
