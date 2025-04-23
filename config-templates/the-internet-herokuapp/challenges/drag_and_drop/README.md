---
title: Drag and Drop
path: config.json
description: Demonstrates performing a drag-and-drop operation using the `mousemove` step with the `drag` action.
tags: ["Navigation", "Drag and Drop", "Mouse Interaction", "mousemove"]
difficulty: Intermediate
related_steps: ["goto", "mousemove"]
---

# Challenge: Drag and Drop

This challenge involves dragging one element (Box A) and dropping it onto another element (Box B).

## Approach

The `config.json` for this challenge uses the `mousemove` step to simulate the drag-and-drop action:

1.  **`goto`**: Navigates to the `/drag_and_drop` page.
2.  **`mousemove`**:
    *   Targets the source element (`#column-a`).
    *   Sets the `action` to `drag`.
    *   Specifies the target element using `dragTo` with a selector (`#column-b`).
    *   Sets a `duration` for the mouse movement.

## Configuration (`config.json`)

(See the `config.json` file in this directory)

## Expected Outcome

The navigation flow should complete successfully. Visually (or through subsequent assertions not included in this basic example), Box A and Box B should have swapped positions on the page. No specific data is extracted.
