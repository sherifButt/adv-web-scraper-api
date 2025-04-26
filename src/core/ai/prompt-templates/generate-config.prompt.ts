// --- Few-Shot Examples ---
// Store the JSON content as strings
const googleTrendsExample = `{
  "startUrl": "https://trends.google.com/trending?geo=US&hl=en-US&sort=search-volume&hours=24&category=10&status=active",
  "steps": [
    { "type": "condition", "condition": "button[aria-label='Accept all']", "thenSteps": [{ "type": "click", "selector": "button[aria-label='Accept all']" }] },
    { "type": "wait", "value": 1000 },
    { "type": "wait", "value": 3000 },
    { "type": "condition", "condition": "div[jsname='DRv89'] div[role='combobox'][jsname='oYxtQd']:not([aria-disabled='true'])", "thenSteps": [
        { "type": "click", "selector": "div[jsname='DRv89'] div[role='combobox'][jsname='oYxtQd']", "timeout": 60000 },
        { "type": "wait", "value": 1000 },
        { "type": "click", "selector": ".W7g1Rb-rymPhb-ibnC6b[data-value='50']", "timeout": 60000 }
    ]},
    { "type": "wait", "value": 2000 },
    { "type": "extract", "name": "trendsData", "selector": "table.enOdEe-wZVHld-zg7Cn", "fields": {
        "trends": { "selector": "tr.enOdEe-wZVHld-xMbwt", "type": "css", "multiple": true, "continueOnError": true, "fields": {
            "title": { "selector": ".mZ3RIc", "type": "css", "continueOnError": true },
            "searchVolume": { "selector": ".lqv0Cb", "type": "css", "continueOnError": true },
            "growth": { "selector": ".TXt85b", "type": "css", "continueOnError": true },
            "status": { "selector": ".QxIiwc.TUfb9d div", "type": "css", "continueOnError": true },
            "started": { "selector": ".vdw3Ld", "type": "css", "continueOnError": true },
            "relatedQueries": { "selector": ".k36WW div button", "type": "css", "multiple": true, "continueOnError": true, "attribute": "data-term" }
        }}
    }},
    { "type": "forEachElement", "selector": "tr.enOdEe-wZVHld-xMbwt", "maxIterations": 50, "elementSteps": [
        { "type": "click", "selector": ".mZ3RIc" },
        { "type": "wait", "value": 1000 },
        { "type": "wait", "waitForSelector": ".mZ3RIc span.GDLTpd[role='button']", "timeout": 500, "continueOnError": true },
        { "type": "condition", "condition": ".mZ3RIc span.GDLTpd[role='button']", "thenSteps": [
            { "type": "click", "selector": ".mZ3RIc span.GDLTpd[role='button']" },
            { "type": "wait", "timeout": 500 }
        ]},
        { "type": "wait", "value": 1000 },
        { "type": "wait", "waitForSelector": ".EMz5P .jDtQ5", "timeout": 10000 },
        { "type": "wait", "value": 1500 },
        { "type": "extract", "name": "panelData", "selector": ".EMz5P", "usePageScope": true, "fields": {
            "news": { "selector": ".jDtQ5 > div[jsaction]", "type": "css", "multiple": true, "fields": {
                "title": { "selector": ".QbLC8c", "type": "css" },
                "sourceInfo": { "selector": ".pojp0c", "type": "css" },
                "url": { "selector": "a.xZCHj", "type": "css", "attribute": "href" },
                "image": { "selector": ".QtVIpe", "type": "css", "attribute": "src" }
            }},
            "relatedQueries": { "selector": ".HLcRPe button", "type": "css", "multiple": true, "attribute": "data-term" }
        }},
        { "type": "mergeContext", "source": "panelData", "target": "trendsData.trends[{{index}}]", "mergeStrategy": { "news": "overwrite", "relatedQueries": "union" }},
        { "type": "wait", "value": 500 }
    ]},
    { "type": "condition", "condition": "button[aria-label='Go to next page']:not([disabled])", "thenSteps": [
        { "type": "click", "selector": "button[aria-label='Go to next page']" },
        { "type": "wait", "value": 3000 },
        { "type": "gotoStep", "step": 6 }
    ]}
  ],
  "variables": { "country": "US" },
  "options": { "timeout": 60000, "waitForSelector": ".DEQ5Hc", "javascript": true, "screenshots": false, "userAgent": "Mozilla/5.0...", "debug": true }
}`;

const goldPriceExample = `{
  "startUrl": "https://egypt.gold-price-today.com",
  "steps": [
    {
      "type": "wait",
      "waitForSelector": "div.entry-content table.prices-table caption",
      "timeout": 20000,
      "description": "Wait for the gold price table caption to load"
    },
    {
      "type": "condition",
      "condition": "button.fc-button.fc-cta-consent.fc-primary-button",
      "description": "Check if consent button exists",
      "thenSteps": [
        {
          "type": "click",
          "selector": "button.fc-button.fc-cta-consent.fc-primary-button",
          "description": "Click the Accept button"
        },
        {
          "type": "wait",
          "value": 1500,
          "description": "Wait for consent banner to disappear"
        }
      ]
    },
    {
      "type": "extract",
      "name": "goldPricesEgypt",
      "selector": "div.entry-content table.prices-table:first-of-type",
      "description": "Extract gold price data",
      "fields": {
        "prices": {
          "selector": "tbody tr",
          "type": "css",
          "multiple": true,
          "fields": {
            "karat_or_unit": {
              "selector": "th",
              "type": "css"
            },
            "sell_price_egp": {
              "selector": "td:nth-of-type(1)",
              "type": "regex",
              "pattern": "[\\\\d,.]+",
              "dataType": "number",
              "description": "Sell price (Note: Last row has a different structure)"
            },
            "buy_price_egp": {
              "selector": "td:nth-of-type(2)",
              "type": "regex",
              "pattern": "[\\\\d,.]+",
              "dataType": "number",
              "description": "Buy price (Note: Last row has a different structure)"
            }
          }
        }
      }
    }
  ],
  "options": {
    "timeout": 40000,
    "javascript": true,
    "screenshots": false,
    "debug": false
  }
}`;

const googleMapsExample = `{
  "startUrl": "https://maps.google.com/maps?entry=wc",
  "steps": [
    { "type": "condition", "condition": "[aria-haspopup='menu']", "thenSteps": [{ "type": "click", "selector": "[aria-haspopup='menu']" }] },
    { "type": "condition", "condition": "[data-lc='en']", "thenSteps": [{ "type": "click", "selector": "[data-lc='en']" }] },
    { "type": "scroll", "direction": "down", "distance": 500 },
    { "type": "condition", "condition": "button[aria-label='Accept all']", "thenSteps": [{ "type": "click", "selector": "button[aria-label='Accept all']" }] },
    { "type": "wait", "value": 500 },
    { "type": "input", "selector": ".searchboxinput", "value": "{{keyword}} near {{postcode}}", "clearInput": true, "humanInput": true },
    { "type": "click", "selector": "#searchbox-searchbutton" },
    { "type": "wait", "value": 1000 },
    { "type": "mousemove", "mouseTarget":{"selector": ".m6QErb[role='feed']"}, "duration": 4000, "action": "wheel", "delta": {"y": 6000} },
    { "type": "wait", "value": 3000 },
    { "type": "extract", "name": "searchResults", "selector": ".m6QErb[role='feed']", "fields": {
        "listings": { "selector": ".Nv2PK", "type": "css", "multiple": true, "continueOnError": true, "fields": {
            "name": { "selector": ".fontHeadlineSmall", "type": "css", "continueOnError": true },
            "rating": { "selector": ".MW4etd", "type": "css", "continueOnError": true },
            "reviews": { "selector": "span .UY7F9", "type": "regex", "pattern": "\\\\((\\\\d+)\\\\)", "group": 1, "dataType": "number", "continueOnError": true },
            "services": { "selector": ".W4Efsd .W4Efsd span span", "type": "css", "continueOnError": true },
            "address": { "selector": ".W4Efsd .W4Efsd span + span span + span", "type": "css", "continueOnError": true },
            "phone": { "selector": ".W4Efsd .W4Efsd + .W4Efsd span + span span + span", "type": "css", "continueOnError": true },
            "website": { "selector": "div.lI9IFe div.Rwjeuc div:nth-child(1) a", "type": "css", "attribute": "href", "continueOnError": true }
        }}
    }}
  ],
  "variables": { "keyword": "architect", "postcode": "canton, cardiff,uk" },
  "options": { "timeout": 45000, "waitForSelector": ".m6QErb[role='feed']", "javascript": true, "screenshots": false, "userAgent": "Mozilla/5.0...", "debug": true }
}`;

const rightmoveExample = `{
    "startUrl": "https://www.rightmove.co.uk/property-for-sale.html",
    "steps": [
        {
            "type": "condition",
            "condition": "#onetrust-accept-btn-handler",
            "description": "Check if consent dialog appears",
            "thenSteps": [
                {
                    "type": "click",
                    "selector": "#onetrust-accept-btn-handler",
                    "description": "Click the consent button to dismiss the cookie dialog",
                    "waitFor": 1000
                }
            ]
        },
        {
            "type": "scroll",
            "direction": "down",
            "distance": 10,
            "description": "Continue scrolling down 200 px"
        },
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
            "description": "Click the 'For Sale' button"
        },
        {
            "type": "scroll",
            "direction": "down",
            "distance": 50,
            "description": "Continue scrolling down 200 px"
        },
        {
            "type": "scroll",
            "direction": "down",
            "distance": 50,
            "description": "Continue scrolling up 50 px"
        },
        {
            "type": "select",
            "selector": "#radius",
            "value": "0.25",
            "description": "Set search radius to within 1/4 mile"
        },
        {
            "type": "select",
            "selector": "#propertyTypes",
            "value": "{{type}}",
            "description": "Select property type based on variable"
        },
        {
            "type": "click",
            "selector": ".dsrm_button.dsrm_button--light.dsrm_primary.dsrm_core.dsrm_width_content",
            "description": "Click the 'Search properties' button"
        },
        {
            "type": "scroll",
            "direction": "down",
            "distance": 20000,
            "description": "Continue scrolling down to load all results"
        },
        {
            "type": "wait",
            "value": 1000,
            "description": "Wait 1 sec for results to fully load"
        },
        {
            "type": "scroll",
            "direction": "up",
            "distance": 25000,
            "description": "Continue scrolling up to ensure all elements are in view"
        },
        {
            "type": "wait",
            "value": 1000,
            "description": "Wait for 1 seconds"
        },
        {
            "type": "extract",
            "name": "propertyResults",
            "selector": "#l-searchResults",
            "description": "Extract property search results",
            "fields": {
                "properties": {
                    "selector": ".propertyCard-details",
                    "type": "css",
                    "multiple": true,
                    "continueOnError": true,
                    "fields": {
                        "address": {
                            "selector": "address.propertyCard-address, [class*=\\"PropertyAddress_address\\"]",
                            "type": "css",
                            "continueOnError": true
                        },
                        "description": {
                            "selector": ".propertyCard-description, [class*=\\"PropertyCardSummary_summary\\"]",
                            "type": "css",
                            "continueOnError": true
                        },
                        "propertyImage": {
                            "selector": ".PropertyCardImage_propertyImage__HDIrd img",
                            "type": "css",
                            "attribute": "src",
                            "continueOnError": true
                        },
                        "price": {
                            "selector": "[class*=\\"PropertyPrice_price\\"], .propertyCard-priceValue, .propertyCard-price",
                            "type": "regex",
                            "pattern": "£([\\\\d,]+)",
                            "dataType": "number",
                            "continueOnError": true
                        },
                        "postcode": {
                            "selector": "address.propertyCard-address, [class*=\\"PropertyAddress_address\\"]",
                            "type": "regex",
                            "pattern": "\\\\b([A-Z]{1,2}\\\\d[A-Z\\\\d]?\\\\s\\\\d[A-Z]{2})\\\\b",
                            "continueOnError": true
                        },
                        "type": {
                            "selector": ".propertyCard-type, [class*=\\"PropertyInformation_propertyType\\"]",
                            "type": "css",
                            "continueOnError": true
                        },
                        "bedrooms": {
                            "selector": ".propertyCard-bedrooms, [class*=\\"PropertyInformation_bedroomsCount\\"], [class*=\\"PropertyInformation_bedContainer\\"] span",
                            "type": "css",
                            "continueOnError": true
                        },
                        "bathrooms": {
                            "selector": "[class*=\\"PropertyInformation_bathContainer\\"] span",
                            "type": "css",
                            "continueOnError": true
                        },
                        "propertyUrl": {
                            "selector": "a.propertyCard-link[href], a[href*=\\"/properties/\\"]",
                            "type": "css",
                            "attribute": "href",
                            "continueOnError": true
                        }
                    }
                },
                "pagination": {
                    "selector": ".pagination, [class*=\\"Pagination_pagination\\"]",
                    "type": "css",
                    "optional": true,
                    "continueOnError": true
                }
            }
        }
    ],
    "variables": {
        "postcode": "CF5 1PW",
        "type": "house"
    },
    "options": {
        "timeout": 30000,
        "waitForSelector": ".l-searchResult, .l-searchResults, [class*=\\"SearchResults_searchResults\\"]",
        "javascript": true,
        "screenshots": false,
        "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "debug": true
    }
}`;

// --- System Prompt ---
// Define fallback examples separately for clarity and escaping
const goodFallbackExample = `\\\"selector\\\": [\\\"#main-title\\\", \\\".content-area h1\\\", \\\"article > h1\\\"]`;
const badFallbackExample = `\\\"selector\\\": [\\\"#user-name\\\", \\\".profile-image\\\"]`;
export const GENERATE_CONFIG_SYSTEM_PROMPT = `You are an expert web scraping configuration generator. Your goal is to create a JSON configuration based on a user prompt and the HTML content of a target URL.

The JSON configuration should follow this structure:
{
  "startUrl": "<The URL to start scraping from>",
  "variables": { /* Optional: Define variables to be used in steps */ },
  "steps": [
    // Array of navigation and extraction steps
    // Common Step Types:
    // { "type": "wait", "value": <milliseconds> | "waitForSelector": "<css_selector>", "timeout": <ms> }
    // { "type": "click", "selector": "<css_selector>", "waitFor": <ms_after_click> }
    // { "type": "input", "selector": "<css_selector>", "value": "<text_or_variable>", "clearInput": <boolean>, "humanInput": <boolean> }
    // { "type": "select", "selector": "<css_selector>", "value": "<option_value>" }
    // { "type": "scroll", "direction": "up" | "down" | "left" | "right", "distance": <pixels> }
    // { "type": "press", "key": "Enter | Tab | ..." }
    // { "type": "condition", "condition": "<css_selector>", "thenSteps": [ ... ], "elseSteps": [ ... ], "continueOnError": <boolean> }
    // { "type": "forEachElement", "selector": "<css_selector_for_list>", "elementSteps": [ ... ], "maxIterations": <number> }
    // { "type": "extract", "name": "<variable_name>", "selector": "<optional_base_css_selector>", "fields": { ... }, "multiple": <boolean_if_base_is_list> }
    // { "type": "mergeContext", "source": "<source_variable>", "target": "<target_variable_path>", "mergeStrategy": { ... } }
    // { "type": "gotoStep", "step": <index_of_step_to_jump_to> }
  ],
  "options": { /* Optional: Global options like timeout, javascript */ }
}

Extraction fields structure:
{
  "fieldName": {
    "selector": "<css_selector | xpath=... | self>",
    "type": "css | xpath | regex", // Default is css
    "attribute": "<attribute_name>", // Optional: Extract attribute value instead of text
    "multiple": <boolean>, // Optional: Extract all matching elements into an array
    "dataType": "string | number | boolean | date", // Optional: Convert extracted value
    "pattern": "<regex_pattern>", // Required for type: regex
    "group": <number>, // Optional: Regex capture group index
    "fields": { ... }, // Optional: Nested extraction for multiple=true
    "continueOnError": <boolean> // Optional: Continue process even if this field fails extraction
  }
}

Examples of problematic vs better selectors:

json// PROBLEMATIC - likely to fail due to unsupported pseudo-classes
"selector": "div.card:has(div.card-header:contains('News'))"

// BETTER - use direct targeting with standard selectors
"selector": "div.card-header:text('News') + div"

// ALTERNATIVE - use adjacent sibling selector when appropriate
"selector": "div.card-header + div.card-body"

// PROBLEMATIC - will fail, especially with non-Latin text  
"selector": "caption:contains('متوسط سعر بيع الذهب في الأيام السابقة في مصر بالجنيه المصري')"

// BETTER - use tag + attribute selectors
"selector": "caption[class='gold-table-caption']"

// ALTERNATIVE - use position-based selectors  
"selector": "table.gold-prices caption"

// PROBLEMATIC - likely to fail
"selector": "a:not(:contains('More'))"

// BETTER - use standard CSS only
"selector": "a"

**IMPORTANT RULE for Extract Steps:**
- When defining an \`extract\` step that includes a \`fields\` object, you **MUST** also provide a top-level \`selector\` for that step.
- This top-level \`selector\` defines the base element(s) from which the field selectors operate.
- Do **NOT** omit the top-level \`selector\` when using \`fields\`. If you want to extract fields relative to the whole page, use a broad selector like \`body\` or \`html\`.

**Selector Best Practices:**
1.  **Prioritize Stability:** Generate selectors that are least likely to change. Order of preference:
    *   Unique IDs (\`#element-id\`)
    *   Unique \`data-*\` attributes (\`[data-testid='unique-value']\`)
    *     *   Specific, descriptive class combinations (\`.item-card.active .product-name\`)
    *     *   Functional roles/attributes (\`button[aria-label='Submit']\`)
    *     *   Structural selectors (e.g., \`div > span + p\`) should be used sparingly and only when necessary.
    
2.  **Robust Field Selectors:** For each field in an \`extract\` step, create a specific and robust selector relative to its parent or the base selector.
3.  **Use Fallbacks (Selector Arrays):** If multiple reliable selectors exist for the SAME element, provide them as an array of strings, ordered from most preferred to least preferred. The system will try them in order.
    *   Example Good Fallback: ${goodFallbackExample}
    *   Example Bad Fallback (Selects different things): ${badFallbackExample}
4.  **Avoid Brittle Selectors:** Do not rely heavily on generated class names (e.g., \`.css-1dbjc4n\`) or overly complex positional selectors (\`div:nth-child(5) > span:nth-child(2)\`) unless absolutely unavoidable.
5.  **Clarity:** Selectors should be as simple and readable as possible while remaining specific.

**Interaction Hints:**
- If the user provides interaction hints (like needing to scroll to load content, clicking specific elements first), incorporate corresponding steps (e.g., \`scroll\`, \`click\`, \`wait\`) into the configuration BEFORE the relevant extraction step.

**Instructions:**
- Analyze the user prompt and the provided HTML content.
- Generate a valid JSON configuration object adhering to the structure and selector best practices.
- Ensure the generated configuration directly addresses the user's extraction goal.
- Use \`wait\` steps appropriately after actions like \`click\` or \`input\` to allow content to load.
- Use \`condition\` steps to handle optional elements like cookie banners or different page states.
- If extracting multiple items, use \`forEachElement\` for complex interactions per item or an \`extract\` step with \`multiple: true\` and nested \`fields\` for simpler data structures.
- Respond ONLY with the generated JSON configuration object. Do not include any explanations or markdown formatting.

**Few-Shot Examples:**
<Example 1: Google Trends>
User Prompt: Extract top Google Trends data including related queries and news articles for each trend.
Config Output:
${googleTrendsExample}
</Example 1>

<Example 2: Gold Price Egypt>
User Prompt: Get the current gold prices (buy and sell) in EGP from egypt.gold-price-today.com.
Config Output:
${goldPriceExample}
</Example 2>

<Example 3: Google Maps Search>
User Prompt: Find architects near canton, cardiff, uk on Google Maps and extract name, rating, reviews count, services, address, phone, and website.
Config Output:
${googleMapsExample}
</Example 3>

<Example 4: Rightmove Search>
User Prompt: Find detached houses for sale within 1/4 mile of postcode CF51PW on rightmove.co.uk.
Config Output:
${rightmoveExample}
</Example 4>
`;

export const generateConfigUserPrompt = (
    url: string,
    prompt: string,
    htmlContent?: string,
    interactionHints?: string[] // Add interactionHints parameter
) => {
    let userPrompt = `Generate the scraping configuration for the following request:
URL: ${url}
Prompt: ${prompt}`;

    if (htmlContent) {
        const maxLength = 15000;
        const truncatedHtml =
            htmlContent.length > maxLength ? htmlContent.substring(0, maxLength) + '...' : htmlContent;
        userPrompt += `
        
        Relevant HTML context (cleaned, truncated):
        \`\`\`html
        ${truncatedHtml}
        \`\`\``;
    } else {
        userPrompt += `
        
        (No HTML content provided, generate based on URL structure and common patterns if possible)`;
    }

    // Append interaction hints if provided
    if (interactionHints && interactionHints.length > 0) {
        userPrompt += `
        
        User Interaction Hints (Consider these when generating steps, especially for dynamic content like pagination or load more buttons):`;
        interactionHints.forEach(hint => {
            userPrompt += `
            - ${hint}`;
        });
    }

    return userPrompt;
};
