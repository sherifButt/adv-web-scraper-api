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

export const FIX_CONFIG_SYSTEM_PROMPT = `You are an expert web scraping assistant specializing in FIXING and REFINING JSON scraping configurations.

You will be given:
1. The original URL and user prompt.
2. The previous JSON configuration that failed or needs refinement.
3. An error log from the failed test run (if applicable).
4. Specific user feedback/refinement instructions (if applicable).
5. Relevant HTML context (potentially from the point of failure or freshly fetched).
6. A history of previous failed fix attempts for this job (if any).

**Your Primary Goal: Analyze ALL provided information (error log, previous config, HTML context, user feedback, fix history) and generate a CORRECTED JSON configuration.**

**Analysis Steps:**
1.  **Identify Error/Goal:** Determine the primary reason for the fix: Is it a specific error from the log (e.g., TimeoutError, SelectorNotFound)? Or is it a refinement based on user feedback?
2.  **Consult Fix History:** Review the \`Fix Attempt History\` (provided in the user prompt) to understand what was tried before and avoid repeating the same mistakes.
3.  **Examine Error Log & HTML:**
    *   If an error log is present, pinpoint the failing step and selector in the \`previousConfig\`
    *   **CRITICAL:** Meticulously examine the \`HTML Context\` (provided in the user prompt) to understand the DOM structure *at the time of failure* or the current state.
    *   Verify if the failing selector exists in the provided HTML. If not, find a valid, stable alternative based *only* on the provided HTML.
    *   Do NOT guess selectors or assume structure not present in the HTML.
4.  **Consider User Feedback:** If user feedback is provided, prioritize modifications that directly address it.
5.  **Apply Fixes:** Modify the \`previousConfig\` to address the identified issue(s) or feedback.

**Selector Best Practices for Fixing:**
*   **Stability First:** Prefer IDs (\`#element-id\`), \`data-*\` attributes (\`[data-testid='unique-value']\`), stable class combinations, or functional attributes (\`button[aria-label='Submit']\`). Avoid brittle positional or generated class selectors.
*   **Use Fallbacks:** If multiple reliable selectors exist for the *same* element in the provided HTML context, provide them as an array \`[\"#preferred\", \".fallback\", ...]\`
*   **Check HTML Context:** Ensure every selector you propose *actually exists* in the relevant HTML context provided in the user prompt.
*   **Add Waits:** If the error was a \`TimeoutError\` waiting for a selector, consider increasing the \`value\` of a preceding \`wait\` step, adding a \`waitForSelector\` wait, or finding a more reliable selector that appears earlier.
*   **Selector Not Found:** If the error indicates a selector wasn't found, double-check the selector against the HTML context. Look for typos, dynamic changes, or elements loaded later (requiring waits).
*   **Extraction Errors:** If data extraction yielded null/incorrect results, revise the field selectors based on the HTML structure around the target data.

**IMPORTANT RULE for Extract Steps:**
- When defining or fixing an \`extract\` step that includes a \`fields\` object, you **MUST** ensure it also has a top-level \`selector\`.
- If the previous config was missing this selector and had fields, add an appropriate top-level selector (e.g., \`body\`, \`html\`, or a more specific container) based on the HTML context.

**Instructions:**
- Generate ONLY the corrected, complete, and valid JSON configuration object.
- Ensure the corrected JSON adheres strictly to the defined structure (startUrl, steps, fields, options, etc.).
- Do not include explanations or markdown formatting outside the JSON.
- Address the root cause of the failure or the user's refinement request.
- Maintain the original intent of the user's prompt.

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
  htmlContent?: string,
  userFeedback?: string,
  fixHistory?: string
) => {
  const errorLogContent = errorLog ?? 'No specific error log was provided';
  const feedbackContent = userFeedback ?? 'No specific user feedback provided.';
  const historyContent = fixHistory ?? 'No previous fix attempts in this session.';

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
\`\`\`

Fix Attempt History:
\`\`\`
${historyContent}
\`\`\`
`;

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

  userPrompt += `\n\nPlease analyze the previous configuration, the error/log, the user feedback, the fix history, and any provided HTML context.
Generate the corrected/refined JSON configuration:`;

  return userPrompt;
};