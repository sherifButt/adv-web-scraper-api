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
  "variables": { "country": "EG" },
  "options": { "timeout": 60000, "waitForSelector": ".DEQ5Hc", "javascript": true, "screenshots": false, "userAgent": "Mozilla/5.0...", "debug": true }
}`;

const googleMapsExample = `{
  "startUrl": "https://maps.google.com/maps?entry=wc",
  "steps": [
    { "type": "condition", "condition": "[aria-haspopup='menu']", "thenSteps": [{ "type": "click", "selector": "[aria-haspopup='menu']" }] },
    { "type": "condition", "condition": "[data-lc='en']", "thenSteps": [{ "type": "click", "selector": "[data-lc='en']" }] },
    { "type": "scroll", "distance": 500 },
    { "type": "condition", "condition": "button[aria-label='Accept all']", "thenSteps": [{ "type": "click", "selector": "button[aria-label='Accept all']" }] },
    { "type": "wait", "value": 500 },
    { "type": "input", "selector": ".searchboxinput", "value": "{{keyword}} near {{postcode}}", "clearInput": true, "humanInput": true },
    { "type": "click", "selector": "#searchbox-searchbutton" },
    { "type": "wait", "value": 1000 },
    { "type": "mousemove", "selector": ".m6QErb[role='feed']", "duration": 4000, "action": "wheel", "deltaY": 6000 },
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

export const GENERATE_CONFIG_SYSTEM_PROMPT = `You are an expert web scraping assistant. Your task is to generate a JSON configuration object that defines the steps to scrape data from a given URL based on a user's prompt.

The JSON configuration MUST follow this structure:
{
  "startUrl": "string (The target URL)",
  "steps": [ NavigationStep ],
  "variables": { /* Optional key-value pairs */ },
  "options": { /* Optional scraping options like timeout, userAgent, debug, etc. */ }
}

// ... (rest of the structure definition) ...

Here are a few examples of well-structured configuration JSON objects:

**Example 1: Google Trends**
\`\`\`json
${googleTrendsExample}
\`\`\`

**Example 2: Google Maps**
\`\`\`json
${googleMapsExample}
\`\`\`

**Example 3: Rightmove Property Search**
\`\`\`json
${rightmoveExample}
\`\`\`
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
    userPrompt += `\n\nRelevant HTML context (cleaned, truncated):\n\`\`\`html\n${truncatedHtml}\n\`\`\``;
  } else {
    userPrompt += `\n\n(No HTML content provided, generate based on URL structure and common patterns if possible)`;
  }

  // Append interaction hints if provided
  if (interactionHints && interactionHints.length > 0) {
    userPrompt += `\n\nUser Interaction Hints (Consider these when generating steps, especially for dynamic content like pagination or load more buttons):`;
    interactionHints.forEach(hint => {
      userPrompt += `\n- ${hint}`;
    });
  }

  return userPrompt;
};
