# Rightmove Property Search Navigation Example

This example demonstrates how to navigate Rightmove's property search and extract listing results using the Advanced Web Scraper API.

## Plain English Steps

1. Go to the Rightmove property for sale page
2. Enter a postcode in the location search field
3. Click the "For Sale" button
4. Wait for the search form to load
5. Set the search radius to 1/4 mile
6. Select a specific property type
7. Click the "Search properties" button
8. Wait for results to load
9. Extract property listings data

## Original JSON Configuration (With Timeout Issue)

```json
{
  "startUrl": "https://www.rightmove.co.uk/property-for-sale.html",
  "steps": [
    {
      "type": "input",
      "selector": "#ta_searchInput",
      "value": "{{postcode}}",
      "description": "Enter postcode in the location search field",
      "clearInput": true,
      "humanInput": true
    },
    {
      "type": "click",
      "selector": "button[data-testid='forSaleCta']",
      "description": "Click the 'For Sale' button",
      "waitFor": "#Search_propertySearchCriteria__Wn7r_"
    },
    {
      "type": "wait",
      "value": 5000,
      "description": "Wait for 5 seconds"
    },
    {
      "type": "wait",
      "value": "#Search_propertySearchCriteria__Wn7r_",
      "description": "Wait until the search form loads",
      "timeout": 10000
    },
    {
      "type": "input",
      "selector": "#radius",
      "value": "0.25",
      "description": "Set search radius to within 1/4 mile"
    },
    {
      "type": "input",
      "selector": "#propertyTypes",
      "value": "{{type}}",
      "description": "Select property type based on variable"
    },
    {
      "type": "click",
      "selector": "button#submit.Search_searchCriteriaSubmitButton__ITSMz",
      "description": "Click the 'Search properties' button",
      "waitFor": ".ResultsList_resultsList__NiUEu"
    },
    {
      "type": "wait",
      "value": 3000,
      "description": "Wait for 3 seconds for results to fully load"
    },
    {
      "type": "extract",
      "name": "propertyResults",
      "selector": ".ResultsList_resultsList__NiUEu#l-searchResults",
      "description": "Extract property search results",
      "fields": {
        "properties": {
          "selector": ".PropertyCard_propertyCard__3TbZ4",
          "type": "css",
          "multiple": true,
          "fields": {
            "title": {
              "selector": ".PropertyCard_propertyCardTitle__DzZ7P",
              "type": "css"
            },
            "address": {
              "selector": ".PropertyCard_propertyCardAddress__osDlz",
              "type": "css"
            },
            "price": {
              "selector": ".PropertyCard_priceValue__oPszp",
              "type": "css"
            },
            "description": {
              "selector": ".PropertyCard_propertyCardDescription__pD_NV",
              "type": "css"
            },
            "agentName": {
              "selector": ".PropertyCard_propertyCardAgent__1-u1P span",
              "type": "css"
            },
            "propertyImage": {
              "selector": ".PropertyCard_propertyCardImage__GePiE img",
              "type": "css",
              "attribute": "src"
            },
            "propertyUrl": {
              "selector": "a.PropertyCard_propertyCardLink__fWAlL",
              "type": "css",
              "attribute": "href"
            }
          }
        },
        "pagination": {
          "selector": ".Pagination_pagination__hj83W",
          "type": "css"
        }
      }
    }
  ],
  "options": {
    "timeout": 30000,
    "waitForSelector": ".ResultsList_resultsList__NiUEu",
    "javascript": true,
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  }
}
```

## Error Response

```json
{
    "success": true,
    "message": "Navigation flow executed successfully",
    "data": {
        "id": "nav_1743939653565",
        "startUrl": "https://www.rightmove.co.uk/property-for-sale.html",
        "status": "failed",
        "stepsExecuted": 1,
        "error":"page.waitForSelector: Timeout 30000ms exceeded.\nCall log:\n[2m  - waiting for locator('#Search_propertySearchCriteria__Wn7r_') to be visible[22m\n",
        "timestamp": "2025-04-06T11:40:53.565Z"
    },
    "timestamp": "2025-04-06T11:40:53.567Z"
}
```

## Improved JSON Configuration

The original configuration had issues with waiting for specific elements that might have dynamic IDs or might not be immediately visible. The improved version uses more reliable selectors and a more robust approach to handling the navigation flow:

```json
{
  "startUrl": "https://www.rightmove.co.uk/property-for-sale.html",
  "steps": [
    {
      "type": "wait",
      "value": 3000,
      "description": "Wait for initial page load"
    },
    {
      "type": "condition",
      "condition": ".cookie-policy-banner__button--accept",
      "description": "Check if cookie consent banner appears",
      "thenSteps": [
        {
          "type": "click",
          "selector": ".cookie-policy-banner__button--accept",
          "description": "Accept cookies if banner appears",
          "waitFor": 2000
        }
      ]
    },
    {
      "type": "input",
      "selector": "input#ta_searchInput",
      "value": "{{postcode}}",
      "description": "Enter postcode in the location search field",
      "clearInput": true,
      "waitFor": 1000
    },
    {
      "type": "wait",
      "value": 2000,
      "description": "Wait for location suggestions to appear"
    },
    {
      "type": "click",
      "selector": "button[data-testid='forSaleCta']",
      "description": "Click the 'For Sale' button",
      "waitFor": "networkidle"
    },
    {
      "type": "wait",
      "value": 5000,
      "description": "Wait for page to stabilize after navigation"
    },
    {
      "type": "condition",
      "condition": "select#radius",
      "description": "Check if search form has loaded",
      "thenSteps": [
        {
          "type": "select",
          "selector": "select#radius",
          "value": "0.25",
          "description": "Set search radius to within 1/4 mile"
        },
        {
          "type": "select",
          "selector": "select#propertyTypes",
          "value": "{{type}}",
          "description": "Select property type based on variable"
        },
        {
          "type": "click",
          "selector": "button#submit[type='submit']",
          "description": "Click the 'Search properties' button",
          "waitFor": "networkidle"
        },
        {
          "type": "wait",
          "value": 5000,
          "description": "Wait for results to fully load"
        }
      ],
      "elseSteps": [
        {
          "type": "wait",
          "value": 10000,
          "description": "Wait longer for form to appear"
        },
        {
          "type": "condition",
          "condition": "select#radius",
          "description": "Check again if search form has loaded",
          "thenSteps": [
            {
              "type": "select",
              "selector": "select#radius",
              "value": "0.25",
              "description": "Set search radius to within 1/4 mile"
            },
            {
              "type": "select",
              "selector": "select#propertyTypes",
              "value": "{{type}}",
              "description": "Select property type based on variable"
            },
            {
              "type": "click",
              "selector": "button#submit[type='submit']",
              "description": "Click the 'Search properties' button",
              "waitFor": "networkidle"
            },
            {
              "type": "wait",
              "value": 5000,
              "description": "Wait for results to fully load"
            }
          ]
        }
      ]
    },
    {
      "type": "condition",
      "condition": "#l-searchResults, .ResultsList_resultsList__NiUEu",
      "description": "Check if results have loaded",
      "thenSteps": [
        {
          "type": "extract",
          "name": "propertyResults",
          "selector": "#l-searchResults, .ResultsList_resultsList__NiUEu",
          "description": "Extract property search results",
          "fields": {
            "properties": {
              "selector": "[data-test='propertyCard'], .PropertyCard_propertyCard__3TbZ4",
              "type": "css",
              "multiple": true,
              "fields": {
                "title": {
                  "selector": "h2, .PropertyCard_propertyCardTitle__DzZ7P",
                  "type": "css"
                },
                "address": {
                  "selector": "address, .PropertyCard_propertyCardAddress__osDlz",
                  "type": "css"
                },
                "price": {
                  "selector": ".propertyCard-priceValue, .PropertyCard_priceValue__oPszp",
                  "type": "css"
                },
                "description": {
                  "selector": ".propertyCard-description, .PropertyCard_propertyCardDescription__pD_NV",
                  "type": "css"
                },
                "agentName": {
                  "selector": ".propertyCard-branchLogo img, .PropertyCard_propertyCardAgent__1-u1P span",
                  "type": "css",
                  "attribute": "alt"
                },
                "propertyImage": {
                  "selector": ".propertyCard-img img, .PropertyCard_propertyCardImage__GePiE img",
                  "type": "css",
                  "attribute": "src"
                },
                "propertyUrl": {
                  "selector": ".propertyCard-link, a.PropertyCard_propertyCardLink__fWAlL",
                  "type": "css",
                  "attribute": "href"
                }
              }
            },
            "totalResults": {
              "selector": ".searchHeader-resultCount, .SearchHeader_searchHeaderResultsCount__UrFjY",
              "type": "css"
            },
            "pagination": {
              "selector": ".pagination, .Pagination_pagination__hj83W",
              "type": "css"
            }
          }
        }
      ],
      "elseSteps": [
        {
          "type": "extract",
          "name": "noResults",
          "selector": "body",
          "description": "Extract page content when no results are found",
          "attribute": "innerHTML"
        }
      ]
    }
  ],
  "options": {
    "timeout": 60000,
    "waitForSelector": "body",
    "javascript": true,
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "humanEmulation": true
  },
  "variables": {
    "postcode": "SW1A 1AA",
    "type": "house"
  }
}
```

## Key Improvements

1. **Added Cookie Consent Handling**: Checks for and handles cookie consent banners that might appear
2. **More Reliable Selectors**: Uses more generic and alternative selectors with commas to handle different versions of the site
3. **Better Wait Strategy**: Uses a combination of fixed waits and network idle detection
4. **Conditional Logic**: Uses conditions to check if elements are present before interacting with them
5. **Fallback Mechanisms**: Includes alternative steps if the primary approach fails
6. **Increased Timeout**: Extended the global timeout to 60 seconds
7. **Human Emulation**: Enabled human emulation for more natural interaction
8. **Example Variables**: Added example values for the variables
9. **Enhanced Error Handling**: Added extraction of page content when no results are found

## Usage Notes

To use this configuration:

1. Replace the example variables with your desired values:
   - `postcode`: The UK postcode to search for (e.g., "SW1A 1AA" for Buckingham Palace area)
   - `type`: The property type to filter by (e.g., "house", "flat", "bungalow", etc.)

2. If the site structure changes, you may need to update the selectors. The current configuration includes alternative selectors to handle different versions of the site.

3. For high-traffic periods or slow connections, you might need to increase the wait times or the global timeout.
