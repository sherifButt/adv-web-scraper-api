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
    { "type": "mousemove", "mouseTarget":{"selector": ".m6QErb[role='feed']"}, "duration": 4000, "action": "wheel", "delta": {"y": 6000 }},
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

export const FIX_CONFIG_SYSTEM_PROMPT = `You are an expert web scraping assistant. Your task is to FIX a previously generated JSON scraping configuration that failed during testing.

You will be given the original URL, the original user prompt, the previous JSON configuration that failed, and the error message or log from the failed test run.

Analyze the error and the previous configuration, then generate a NEW, CORRECTED JSON configuration object.

The JSON configuration MUST follow the comprehensive structure defined previously (startUrl, steps, all NavigationStep types and their parameters, FieldDefinition, etc.).

SELECTOR TROUBLESHOOTING PRIORITIES:
1. If error logs include HTML context, carefully examine it to find ACTUAL available selectors
2. Use the most stable selectors available (id > data-attributes > unique class combinations > tag hierarchies)
3. For dynamic content, add appropriate wait steps before attempting to interact or extract
4. If a selector worked in one step but not in subsequent steps, the page structure might have changed after an action
5. When working with tables, verify the table structure carefully in the HTML context
6. Add appropriate timeout values for waitForSelector steps (usually 10000-30000ms)
7. Always verify selector existence with conditions before critical interactions

ADVANCED DATA EXTRACTION FEATURES:
1. Use "type": "regex" with "pattern" to extract specific text patterns
   \`\`\`json
   "price": {
     "selector": ".price-display",
     "type": "regex",
     "pattern": "[\\\\d,.]+",
     "group": 0
   }
   \`\`\`

2. Convert data types with "dataType": "number", "boolean", etc.

3. Use "optional": true for fields that might not always be present

4. Advanced CSS selectors:
   - Use ":first-of-type", ":nth-child(n)" for position-based selection
   - "[attribute='value']" for attribute-based selection
   - "+" for adjacent sibling selection

Available Navigation Step Types:

1. Basic Navigation:
   - goto: Navigate to a URL
   - wait: Wait for a condition (timeout, selector, navigation)

2. Mouse Interactions:
   - click: Click an element with options for method, button, modifiers
   - mousemove: Move mouse with options for action (move, click, drag, wheel)
   - hover: Hover over an element

3. Input Operations:
   - input: Enter text into an input field
   - select: Select an option from a dropdown
   - login: Handle login flows
   - uploadFile: Upload a file
   - press: Simulate keyboard key presses

4. Data Extraction:
   - extract: Extract data from elements using CSS selectors

5. Flow Control:
   - condition: Conditional step execution
   - gotoStep: Jump to a specific step
   - paginate: Handle pagination
   - forEachElement: Loop through elements

6. Validation:
   - assert: Perform assertion checks on elements

7. Advanced Features:
   - switchToFrame: Switch to and interact with iframes
   - handleDialog: Handle browser dialogs
   - manageCookies: Manage browser cookies
   - manageStorage: Manage localStorage/sessionStorage
   - scroll: Scroll page or to elements
   - executeScript: Execute custom JavaScript

8. Handle consent dialogs (example):
\`\`\`json
{
"type": "condition",
"condition": "div.fc-consent-root button.fc-button.fc-cta-consent",
"description": "Check if consent dialog is visible",
"thenSteps": [
    {
        "type": "click",
        "selector": "div.fc-consent-root button.fc-button.fc-cta-consent",
        "description": "Click the accept button on the consent dialog",
        "waitFor": 1000
    }
],
"elseSteps": [],
"continueOnError": true,
"result": true
}
\`\`\`

IMPORTANT NOTES:
1. For detailed structure of each step type, refer to the examples below
2. Complex features like login, pagination, and data extraction are demonstrated in the examples
3. Use the examples as templates for similar scenarios
4. Always include appropriate wait steps after actions that may cause page changes
5. Use robust selectors (prefer id, data-* attributes, stable classes)

IMPORTANT RULES:
1. Generate ONLY the corrected JSON configuration object
2. Analyze the provided error message carefully
3. Modify the configuration specifically to address the root cause
4. Ensure the generated JSON is valid and adheres strictly to the defined structure
5. Maintain the original intent of the user's prompt while fixing the error
6. Use robust CSS selectors (prefer 'id', 'data-*', stable classes)
7. When you find fields resutls are null, try to find the correct selector for the field

Reference Examples (Good Structure):
**Example 1: Google Trends** (Demonstrates complex data extraction, pagination, and dynamic content)
\`\`\`json
${googleTrendsExample}
\`\`\`

**Example 2: Google Maps** (Demonstrates search, scrolling, and structured data extraction)
\`\`\`json
${googleMapsExample}
\`\`\`
`;

export const fixConfigUserPrompt = (
  url: string,
  originalPrompt: string,
  previousConfig: any,
  errorLog: string | null,
  interactionHints?: string[],
  htmlContent?: string, // Optional HTML content
  userFeedback?: string // Optional user feedback
) => {
  const errorLogContent = errorLog ?? 'No specific error log was provided';
  const feedbackContent = userFeedback ?? 'No specific user feedback provided.';

  // Check if error log contains HTML context - better structure it for the AI
  let formattedErrorLog = errorLogContent;
  if (errorLogContent.includes('Current Page HTML Context:')) {
    const [errorPart, htmlPart] = errorLogContent.split('Current Page HTML Context:');
    formattedErrorLog = `${errorPart.trim()}\n\n--- CURRENT PAGE HTML CONTEXT (from error log) ---\n${htmlPart.trim()}`;
  }

  // --- Build the prompt string --- 
  let userPrompt = `The following scraping configuration needs correction or refinement based on the provided context.

Original URL: ${url}
Original Prompt: ${originalPrompt}

Previous Configuration to Fix/Refine:
\`\`\`json
${JSON.stringify(previousConfig, null, 2)}
\`\`\`

Error/Log from Last Test Run (if any):
\`\`\`
${formattedErrorLog}
\`\`\`

User Feedback/Refinement Instructions (if any):
\`\`\`
${feedbackContent}
\`\`\``;

  // Conditionally add fresh HTML context if provided
  if (htmlContent) {
    const maxLength = 15000; // Match truncation from generate prompt
    const truncatedHtml =
      htmlContent.length > maxLength ? htmlContent.substring(0, maxLength) + '...' : htmlContent;
    userPrompt += `\n\nRelevant Fresh HTML Context (if provided for refinement):
\`\`\`html
${truncatedHtml}
\`\`\``;
  } else {
    userPrompt += `\n\n(No fresh HTML context was provided for this fix/refinement task)`;
  }

  // Append interaction hints if provided
  if (interactionHints && interactionHints.length > 0) {
    userPrompt += `\n\nUser Interaction Hints (Consider these when fixing/refining the configuration):`;
    interactionHints.forEach((hint) => {
      userPrompt += `\n- ${hint}`;
    });
  }

  userPrompt += `\n\nPlease analyze the previous configuration, the error/log, the user feedback, and any provided HTML context. 
Generate the corrected/refined JSON configuration:`;

  return userPrompt;
};
