---
title: "Nested Frames"
path: "/nested_frames"
description: "Demonstrates interacting with content within nested iframes."
tags: ["interaction", "frames", "iframes"]
difficulty: "medium"
related_steps: ["switchToFrame", "extract"]
---

## Nested Frames Challenge

This page contains multiple nested iframes (frames within frames).

### Goal
Navigate into the nested frames, extract content from the innermost frame, and return to the main page context. This tests the ability to handle complex frame structures.

### Configuration (`config.json`)
The configuration should include steps to:
1. Navigate to the Nested Frames page.
2. Use the `switchToFrame` step to enter the top-level frame (e.g., `frame-top`).
3. Within the `frame-top` context, use another `switchToFrame` step to enter a nested frame (e.g., `frame-middle`).
4. Extract content from within the `frame-middle`.
5. Ensure the context is switched back to the main page after the nested operations (usually handled by `switchToFrame`'s default behavior).
