---
title: "Large & Deep DOM"
path: config.json
description: "Contains a very large and deeply nested DOM structure."
tags: ["performance", "dom", "selectors"]
difficulty: Intermediate
related_steps: ["goto", "extract"]
---

## Large & Deep DOM Challenge

This page features an extremely large and deeply nested Document Object Model (DOM).

### Goal
Navigate and extract specific data from within this complex structure efficiently. This tests the performance and robustness of selector strategies.

### Configuration (`config.json`)
The configuration should include steps to:
1. Navigate to the Large & Deep DOM page.
2. Potentially scroll to ensure specific elements are loaded or visible.
3. Use efficient selectors (e.g., direct child selectors, IDs if available) to extract data from specific locations within the deep structure. Avoid overly broad selectors (like `div div div...`) that can be slow.
