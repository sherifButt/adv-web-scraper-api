---
title: A/B Testing
path: ab_testing/config.json
description: Navigates to the A/B testing page and extracts the displayed heading text, which varies between visits.
tags: ["Navigation", "A/B Testing", "Extraction"]
difficulty: Easy
related_steps: ["goto", "extract"]
---

# Challenge: A/B Testing

This challenge involves navigating to a page where the heading text might change between visits due to A/B testing.

## Approach

The `config.json` for this challenge performs the following:

1.  **`goto`**: Navigates to the `/abtest` page.
2.  **`extract`**: Extracts the text content of the main heading (`h3`) element.

## Configuration (`config.json`)

(See the `config.json` file in this directory)

## Expected Outcome

The navigation flow should complete successfully, and the `result` object in the final output should contain a `abTestHeading` field with the text of the heading displayed during that specific run (e.g., "A/B Test Variation 1" or "A/B Test Control").
