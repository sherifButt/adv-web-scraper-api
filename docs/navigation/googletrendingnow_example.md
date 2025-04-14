# Google Trends Navigation Example

This example demonstrates how to scrape Google Trends data using the `forEachElement` and `mergeContext` step types to:
1. Loop through trending topics
2. Click each one to open its details panel
3. Extract news and related queries
4. Merge the data back into the main context

## Configuration Overview

```json
{
  "startUrl": "https://trends.google.com/trending?geo=EG&category=20&hours=24&sort=title",
  "steps": [
    // Initial setup steps (cookie acceptance, page loading, etc.)
    {
      "type": "extract",
      "name": "trendsData",
      "selector": "table.enOdEe-wZVHld-zg7Cn",
      "description": "Extract initial trends table data",
      "fields": {
        "trends": {
          "selector": "tr.enOdEe-wZVHld-xMbwt",
          "type": "css",
          "multiple": true,
          "fields": {
            "title": { "selector": ".mZ3RIc", "type": "css" },
            "searchVolume": { "selector": ".lqv0Cb", "type": "css" },
            "growth": { "selector": ".TXt85b", "type": "css" },
            "relatedQueries": {
              "selector": ".k36WW div button",
              "type": "css",
              "multiple": true,
              "attribute": "data-term"
            }
          }
        }
      }
    },
    // The key forEachElement section that processes each trend
    {
      "type": "forEachElement",
      "selector": "tr.enOdEe-wZVHld-xMbwt",
      "description": "Process each trend row to get detailed data",
      "maxIterations": 50,
      "elementSteps": [
        {
          "type": "click",
          "selector": ".mZ3RIc",
          "description": "Click trend title to open details panel"
        },
        {
          "type": "wait",
          "value": ".EMz5P .k44Spe",
          "timeout": 15000,
          "description": "Wait for panel content to load"
        },
        {
          "type": "extract",
          "name": "panelData",
          "selector": ".EMz5P",
          "description": "Extract panel details",
          "fields": {
            "news": {
              "selector": ".jDtQ5 .xZCHj",
              "type": "css",
              "multiple": true,
              "fields": {
                "title": { "selector": ".QbLC8c", "type": "css" },
                "sourceInfo": { "selector": ".pojp0c", "type": "css" },
                "url": { "attribute": "href" }
              }
            },
            "relatedQueries": {
              "selector": ".HLcRPe button",
              "type": "css",
              "multiple": true,
              "attribute": "data-term"
            }
          }
        },
        // Critical mergeContext step that combines the data
        {
          "type": "mergeContext",
          "source": "panelData",
          "target": "trendsData.trends[{{index}}]",
          "mergeStrategy": {
            "news": "overwrite",
            "relatedQueries": "union"
          },
          "description": "Merge panel data back into main trends array"
        },
        {
          "type": "click",
          "selector": ".EMz5P button[aria-label='Close']",
          "description": "Close panel",
          "optional": true
        },
        {
          "type": "wait",
          "value": 500,
          "description": "Brief pause before next iteration"
        }
      ]
    }
  ]
}
```

## Key Features Demonstrated

1. **forEachElement**:
   - Processes each trend row sequentially
   - Uses `maxIterations` to limit processing
   - Contains a complete workflow in `elementSteps`

2. **mergeContext**:
   - Combines extracted panel data with the main trends array
   - Uses `{{index}}` to target the correct array position
   - Implements different merge strategies:
     - `overwrite` for news (replaces existing data)
     - `union` for related queries (combines with existing data)

3. **Error Handling**:
   - Optional close button click (won't fail if panel is already closed)
   - Timeouts on critical waits
   - ContinueOnError flags in extraction

## Full Example

See the complete configuration file: [googletrendingnow-config.json](../googletrendingnow-config.json)

## Usage Notes

1. The configuration handles:
   - Cookie consent dialogs
   - Page loading waits
   - Dynamic content loading
   - Data merging

2. Selectors may need updating if Google Trends changes its UI

3. The mergeContext step is critical for combining data from multiple interactions

4. Consider adding:
   - More error handling
   - Additional data validation
   - Pagination support for more results
