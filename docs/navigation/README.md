# Navigation Engine Documentation

This section provides detailed documentation for the Advanced Web Scraper API's Navigation Engine. The engine allows you to define complex, multi-step browser interactions to navigate websites, interact with elements, and extract data dynamically.

## Table of Contents

- **[Navigation Step Types](./navigation-types.md)**: Comprehensive reference guide detailing all available step types (`goto`, `click`, `input`, `extract`, `condition`, `forEachElement`, `mergeContext`, etc.) and their configuration options. This is the core reference for building navigation flows.
- **[General Navigation Examples](./navigation_examples.md)**: Practical examples covering common scenarios like form filling, pagination handling, conditional logic, and data extraction patterns.
- **[Screenshot Feature](./screenshot_feature.md)**: Learn how to enable and use the built-in screenshot capability for debugging and monitoring navigation flows.

## Specific Examples

These documents provide in-depth walkthroughs for specific websites or advanced features:

- **[Google Trends Example](./googletrendingnow_example.md)**: Demonstrates scraping dynamic content using `forEachElement` to loop through items and `mergeContext` to combine extracted data.
- **[Rightmove Example](./rightmove_example.md)**: Shows how to handle a real-world property search site, including dealing with dynamic selectors, cookie consent, and debugging timeout issues.

## Advanced / Internal

- **[System Prompt for AI Generation](./system_prompt_generate_config_json.md)**: (Internal) Details the system prompt used to guide Large Language Models (LLMs) in generating navigation configuration JSON.

---

Start with **[Navigation Step Types](./navigation-types.md)** to understand the building blocks, then explore the **[General Navigation Examples](./navigation_examples.md)** for common patterns. Refer to the specific examples for more complex scenarios.
