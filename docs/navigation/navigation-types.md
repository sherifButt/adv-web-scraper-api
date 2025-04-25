# Navigation Step Types

This document describes all available navigation step types that can be used in the navigation engine.

## Basic Navigation

### `goto`

Navigates to a URL.

```typescript
{
  type: 'goto',
  value: 'https://example.com',
  waitFor: 'networkidle' // optional
}
```

### `wait`

Waits for a condition.

```typescript
{
  type: 'wait',
  value: 5000 // ms
  // OR
  value: '#element' // selector
  // OR
  waitFor: 'navigation' // 'networkidle'
}
```

## Mouse Interactions

### `click`

Clicks an element using various methods (single, double, keyboard) and options. This step uses Playwright's robust `elementHandle.click()` or `elementHandle.dblclick()` methods, which handle scrolling the element into view and performing actionability checks.

```typescript
{
  type: 'click',
  selector: '#button',
  clickMethod: 'single', // 'single' (default), 'double', 'keyboard'
  button: 'left',      // 'left' (default), 'right', 'middle'
  modifiers: ['Shift'], // Optional: ['Alt', 'Control', 'Meta', 'Shift']
  position: { x: 10, y: 10 }, // Optional: Click offset within element
  force: false,        // Optional: Bypass actionability checks (default: false)
  waitFor: '#next-page', // Optional: Wait condition after click
  timeout: 30000       // Optional: Timeout for the click action itself
}
```

**Parameters:**

-   `selector`: CSS selector for the target element.
-   `clickMethod` (optional): The method used for clicking.
    -   `'single'` (default): Performs a standard single click.
    -   `'double'`: Performs a double click.
    -   `'keyboard'`: Focuses the element and simulates a Spacebar press.
-   `button` (optional): The mouse button to use. Defaults to `'left'`.
    -   `'left'`
    -   `'right'`
    -   `'middle'`
-   `modifiers` (optional): An array of modifier keys to hold during the click (e.g., `['Shift', 'Control']`).
-   `position` (optional): An object `{ x: number, y: number }` specifying the click coordinates relative to the top-left corner of the element's bounding box.
-   `force` (optional): If `true`, bypasses Playwright's actionability checks. Use with caution. Defaults to `false`.
-   `waitFor` (optional): A condition (selector, timeout in ms, 'navigation', 'networkidle') to wait for after the click action completes.
-   `timeout` (optional): Maximum time in milliseconds for the click action itself (finding the element and performing the click/dblclick). Defaults to 30000ms.
-   `optional` (optional): If `true`, failure to find or click the element will not halt the flow.

**Examples:**

```typescript
// Right-click an element
{
  type: 'click',
  selector: '#context-menu-trigger',
  button: 'right'
}

// Double-click an item
{
  type: 'click',
  selector: '.list-item',
  clickMethod: 'double'
}

// Shift-click a link
{
  type: 'click',
  selector: 'a.special-link',
  modifiers: ['Shift']
}

// Force click a potentially obscured button
{
  type: 'click',
  selector: '#tricky-button',
  force: true
}
```

**Note on `click` vs. `mousemove` with `action: 'click'`:**

-   Use the `click` step for most standard click interactions. It's simpler and leverages Playwright's built-in checks for visibility and actionability.
-   Use the `mousemove` step with `action: 'click'` when you need fine-grained control over the *mouse movement path* leading up to the click, or when precise offsets, randomization, or delays around the click are required.

### `mousemove`

Moves the mouse cursor to a target element or specific coordinates, with options for intermediate points and subsequent actions like clicking, dragging, or scrolling the wheel. Uses a structured approach for defining targets and parameters.

**Parameters:**

-   `type`: Must be `'mousemove'`.
-   `action` (optional): The action to perform after moving. Defaults to `'move'`.
    -   `'move'`: Just move the cursor.
    -   `'click'`: Move then perform a simple click (mouse down/up).
    -   `'drag'`: Move, press mouse down, move again to a target, release mouse up.
    -   `'wheel'`: Move then scroll the mouse wheel.
-   `duration` (optional): Time in milliseconds for the mouse movement (initial move, drag movement, or scroll). Defaults vary by action (e.g., 500ms for move/drag, 100ms for scroll).
-   `humanLike` (optional): If `true` (default), uses Bezier curves for more natural movement. If `false`, moves in a straight line.
-   `waitFor` (optional): A condition (selector, timeout in ms, 'navigation', 'networkidle') to wait for after the entire step completes.
-   `timeout` (optional): Maximum time in milliseconds for any internal `waitForSelector` calls (e.g., waiting for the target element). Defaults to 30000ms.
-   `optional` (optional): If `true`, failure during the step will not halt the flow.

**Targeting:**

-   `mouseTarget`: An object defining the destination. Must contain either:
    -   `selector` (string): CSS selector for the target element.
    -   `x` (number) and `y` (number): Target coordinates.
    -   `offsetX` (number, optional, only with `selector`): Pixel offset horizontally from the element's center.
    -   `offsetY` (number, optional, only with `selector`): Pixel offset vertically from the element's center.

**Movement Path (Optional):**

-   `startPoint` (optional): An object `{ x: number, y: number }` defining the starting coordinates for the movement (overrides default starting from current position). _Note: Cannot be a selector._
-   `pathPoints` (optional): An array defining intermediate points for the movement path. Each element can be:
    -   An object `{ x: number, y: number }`.
    -   An object `{ selector: string }` (coordinates resolved during execution).
    _(If `startPoint` is defined, it takes precedence over the first element in `pathPoints` if provided)_

**Action-Specific Parameters:**

-   **For `action: 'drag'`:**
    -   `endPoint`: An object defining the drag destination. Must contain either:
        -   `selector` (string): CSS selector for the target element.
        -   `x` (number) and `y` (number): Target coordinates.
        -   `offsetX` (number, optional, only with `selector`): Pixel offset horizontally from the element's center.
        -   `offsetY` (number, optional, only with `selector`): Pixel offset vertically from the element's center.

-   **For `action: 'wheel'`:**
    -   `delta`: An object `{ x?: number, y?: number }` specifying the scroll amount in pixels. Requires `x` or `y` or both.

**Enhancements (Optional):**

-   `randomizeOffset` (boolean | number): If `true`, applies a small random offset (default up to 5px) when targeting an element via `selector` in `mouseTarget` or `endPoint`. If a number, specifies the maximum random offset in pixels.
-   `delayBeforeAction` ({ min: number, max: number } | number, optional): Adds a random delay (between min/max ms, or a fixed ms if number) *after* the initial move but *before* the specified `action` (click, drag start, wheel).
-   `delayAfterAction` ({ min: number, max: number } | number, optional): Adds a random delay *after* the entire `action` (click, drag end, wheel) completes.

**Example:**

```typescript
{
  type: 'mousemove',
  action: 'drag',
  mouseTarget: { selector: '#draggable-item', offsetY: -10 }, // Start drag 10px above center
  endPoint: { x: 300, y: 400 }, // Where to drop it
  startPoint: { x: 10, y: 10 }, // Start movement from specific coords
  duration: 1500, // Duration for the drag movement
  humanLike: true,
  randomizeOffset: 3, // Randomize start/end points within 3px radius if selectors used
  delayAfterAction: { min: 100, max: 300 } // Pause 100-300ms after dropping
}

{
  type: 'mousemove',
  action: 'click',
  mouseTarget: { selector: '#button', randomizeOffset: true }, // Click near button center
  delayBeforeAction: 50 // Wait 50ms before clicking
}

{
  type: 'mousemove',
  action: 'wheel',
  mouseTarget: { selector: '#scrollable-div' }, // Move mouse over div first
  delta: { y: 200 }, // Scroll down by 200px
  duration: 300 // Duration for the scroll action
}
```

**Note on `click` vs. `mousemove` with `action: 'click'`:**

-   Use the dedicated `click` step for most standard click interactions. It's simpler and leverages Playwright's built-in checks for visibility and actionability.
-   Use the `mousemove` step with `action: 'click'` when you need fine-grained control over the *mouse movement path* leading up to the click, or when precise offsets, randomization, or delays around the click are required.

### `hover`

Hovers over an element.

```typescript
{
  type: 'hover',
  selector: '.tooltip-trigger',
  duration: 1500, // hover time in ms
  waitFor: '.tooltip' // optional
}
```

### Selecting within Shadow DOM

Playwright's locators can pierce Shadow DOM boundaries using standard CSS selectors. You don't need a special step type. Simply chain `.locator()` calls or use CSS descendant combinators that pierce the shadow root.

**Example:**

Assume the following structure:
```html
<host-element>
  #shadow-root (open)
    <div id="inner-element">Click Me</div>
    <nested-component>
      #shadow-root (open)
        <button>Nested Button</button>
    </nested-component>
</host-element>
```

You can target elements inside the shadow roots like this:

```typescript
// Target #inner-element directly using standard CSS
{
  type: 'click',
  selector: 'host-element #inner-element'
}

// Target the nested button
{
  type: 'click',
  selector: 'host-element nested-component button'
}

// Alternative using Playwright's text selector (also pierces shadow DOM)
{
  type: 'click',
  selector: 'text="Nested Button"'
}
```

**Key Points:**

-   Standard CSS selectors (like descendant ` ` or child `>`) work across shadow boundaries in Playwright locators.
-   No special syntax (like the deprecated `>>>` or `/deep/`) is needed.
-   This applies to all steps that use selectors (`click`, `input`, `extract`, `assert`, etc.).

## Input Operations

### `input`

Enters text into an input field.

```typescript
{
  type: 'input',
  selector: '#search',
  value: 'query',
  clearInput: true, // optional
  humanInput: true // enable human-like typing
}
```

### `select`

Selects an option from a dropdown.

```typescript
{
  type: 'select',
  selector: '#country',
  value: 'US'
}
```

### `login`

Handles common login flows involving username, password, and submit button.

```typescript
{
  type: 'login',
  usernameSelector: '#username', // Selector for username/email input
  passwordSelector: '#password', // Selector for password input
  submitSelector: 'button[type="submit"]', // Selector for submit button
  usernameValue: '{{secrets.username}}', // Username (use context/secrets)
  passwordValue: '{{secrets.password}}', // Password (use context/secrets)
  waitForNavigation: true, // Optional: Wait for navigation after submit (default: true). Can be selector or timeout (ms).
  // strategy: 'standard', // Optional: For future complex flows (e.g., SSO)
  description: 'Log into the application' // Optional description
}
```

**Parameters:**

-   `usernameSelector`: CSS selector for the username or email input field.
-   `passwordSelector`: CSS selector for the password input field.
-   `submitSelector`: CSS selector for the login submission button.
-   `usernameValue`: The username or email to enter. Can use context variables (e.g., `{{username}}`).
-   `passwordValue`: The password to enter. Can use context variables (e.g., `{{secrets.password}}`). **Note:** Be cautious about storing sensitive data directly in configurations. Use environment variables or a secure context source.
-   `waitForNavigation` (optional): Determines what to wait for after clicking the submit button.
    -   `true` (default): Waits for a page navigation to complete (using `networkidle`).
    -   `false`: Does not wait for navigation.
    -   `string` (selector): Waits for the specified selector to become visible.
    -   `number` (ms): Waits for the specified number of milliseconds.
-   `description` (optional): Custom description for logging purposes.

**Functionality:**

1.  Locates and fills the username field.
2.  Locates and fills the password field.
3.  Locates and clicks the submit button.
4.  Handles waiting based on the `waitForNavigation` parameter.

This step simplifies common login sequences compared to using separate `input` and `click` steps.

### `uploadFile`

Uploads a file to an `<input type="file">` element.

```typescript
{
  type: 'uploadFile',
  selector: 'input#file-upload', // Selector for the file input element
  filePath: './data/my-document.pdf', // Path to the file to upload
  description: 'Upload the user document' // Optional description
}
```

**Parameters:**

-   `selector`: CSS selector for the `<input type="file">` element.
-   `filePath`: The path to the file that should be uploaded. This path is resolved relative to the current working directory of the worker process executing the job, or it can be an absolute path. Ensure the file exists and is accessible to the worker.
-   `description` (optional): Custom description for logging purposes.
-   `timeout` (optional): Maximum time in milliseconds to wait for the file input element to become visible/enabled before attempting the upload (default: 10000ms).
-   `optional` (optional): If `true`, failure to find the element or upload the file will not halt the entire navigation flow (default: `false`).

**Functionality:**

1.  Locates the file input element specified by the `selector`.
2.  Uses Playwright's `setInputFiles` method to set the value of the input to the specified `filePath`.

**Security Note:** Be cautious when allowing arbitrary file paths. The implementation includes a basic check (`fs.existsSync`) but consider adding more robust validation based on allowed base directories if the `filePath` can be influenced by external input.

### `press`

Simulates keyboard key presses, including single keys, modifiers, and sequences using Playwright's `keyboard.press`, `keyboard.down`, and `keyboard.up` methods.

```typescript
{
  type: 'press',
  key: 'Enter', // Key to press (e.g., 'A', 'Enter', 'ArrowDown', '$', see Playwright key names)
  modifiers: ['Shift', 'Meta'], // Optional: ['Alt', 'Control', 'Meta', 'Shift']
  action: 'press', // Optional: 'press' (default, combines down+up), 'down', 'up'
  delay: 100, // Optional: Delay (ms) between down/up for 'press' action
  selector: '#myInput', // Optional: CSS selector to focus before pressing
  waitFor: '#result', // Optional: Wait condition after pressing
  description: 'Press Shift+Command+Enter in the input field' // Optional
}
```

**Parameters:**

-   `key` (string): The main key to press. Must match a valid Playwright key name (e.g., `'a'`, `'Enter'`, `'ArrowLeft'`, `'F1'`, `'$'`). See [Playwright Keyboard Docs](https://playwright.dev/docs/api/class-keyboard#keyboard-press) for a full list.
-   `modifiers` (optional, array of strings): An array of modifier keys (`'Alt'`, `'Control'`, `'Meta'`, `'Shift'`) to hold down during a `'press'` action. For `'down'` and `'up'` actions, modifiers should typically be pressed/released using separate `press` steps with `action: 'down'` or `action: 'up'`.
-   `action` (optional, string): Specifies the exact keyboard action. Defaults to `'press'`.
    -   `'press'`: Simulates a full key press (down event, then up event). This is the most common action. It correctly handles modifiers specified in the `modifiers` array.
    -   `'down'`: Simulates pressing a key down and holding it. Use this to start holding a modifier key (like `Shift`) before other presses.
    -   `'up'`: Simulates releasing a key that was previously held down. Use this to release modifier keys.
-   `delay` (optional, number): Time in milliseconds to wait between the `down` and `up` actions when `action` is `'press'`. Defaults to 0.
-   `selector` (optional, string): A CSS selector for an element to focus before the key press action occurs. Useful for ensuring key presses happen in the context of a specific input field or element.
-   `waitFor` (optional): A condition (selector, timeout in ms, 'navigation', 'networkidle') to wait for after the key press action completes.
-   `description` (optional): Custom description for logging purposes.
-   `timeout` (optional): Maximum time in milliseconds for associated waits (like `waitForSelector` if `selector` is used, or the `waitFor` condition). Defaults to 30000ms.
-   `optional` (optional): If `true`, failure during the step (e.g., element not found for focus) will not halt the flow (default: `false`).

**Functionality:**

1.  If `selector` is provided, waits for the element and focuses it.
2.  Performs the specified keyboard `action` (`press`, `down`, or `up`) using the `key`.
3.  For the `'press'` action, it correctly combines the `key` with any specified `modifiers` (e.g., `Shift+A`).
4.  Handles the optional `delay` for the `'press'` action.
5.  Handles the optional `waitFor` condition after the action.

**Examples:**

```typescript
// Press Enter key
{
  type: 'press',
  key: 'Enter'
}

// Type 'A' (Shift + a)
{
  type: 'press',
  key: 'A', // Playwright handles Shift+a as 'A'
  // OR explicitly:
  // key: 'a',
  // modifiers: ['Shift']
}

// Press Ctrl+C (Cmd+C on Mac)
{
  type: 'press',
  key: 'C',
  modifiers: ['Control'] // Playwright maps Control to Meta on macOS automatically for shortcuts
  // OR explicitly for Mac:
  // key: 'C',
  // modifiers: ['Meta']
}

// Sequence: Hold Shift, press 'a', release Shift
[
  { type: 'press', key: 'Shift', action: 'down' },
  { type: 'press', key: 'a' }, // 'a' is pressed while Shift is down
  { type: 'press', key: 'Shift', action: 'up' }
]

// Focus input and press Tab
{
  type: 'press',
  selector: '#username',
  key: 'Tab'
}
```
**EXAMPLE: :** `Shift + Option + Command + S (Chord Press)`

- This is a standard chord press where multiple modifier keys are held down while a primary key is pressed.

- You would configure this using the key and modifiers properties. Remember that on macOS, Option maps to Alt and Command maps to Meta in Playwright.

The configuration step would look like this:
```json
{
  "type": "press",
  "key": "S",
  "modifiers": ["Shift", "Alt", "Meta"],
  "description": "Press Shift + Option + Command + S"
}
```
**EXAMPLE: :** `Shift + Command + s + d (Sequence Press)`:

- This looks more like a sequence: holding down Shift and Command, pressing s, then pressing d (presumably while still holding the modifiers), and finally releasing the modifiers.

- The press handler, using the action property (down, up, press), allows you to build such sequences step-by-step:

```json
[
  {
    "type": "press",
    "key": "Shift",
    "action": "down",
    "description": "Hold Shift down"
  },
  {
    "type": "press",
    "key": "Meta", // Command key on macOS
    "action": "down",
    "description": "Hold Command down"
  },
  {
    "type": "press",
    "key": "s",
    // Modifiers are implicitly active due to 'down' actions above
    "description": "Press 's' while holding Shift+Command"
  },
  {
    "type": "press",
    "key": "d",
    // Modifiers are still active
    "description": "Press 'd' while holding Shift+Command"
  },
  {
    "type": "press",
    "key": "Meta", // Release Command
    "action": "up",
    "description": "Release Command"
  },
  {
    "type": "press",
    "key": "Shift", // Release Shift
    "action": "up",
    "description": "Release Shift"
  }
]
```

**Note:** While page.keyboard.press() can sometimes handle simple combinations like Shift+A directly in the key property (e.g., key: "Shift+A"), complex chords and sequences are more reliably handled using the modifiers array and the down/up/press actions as shown above. The planned handler focuses on the explicit modifiers and action approach for clarity and robustness.




## Data Extraction

### `extract`

Extracts data from elements.

```typescript
{
  type: 'extract',
  selector: '.product', // Can be omitted if running within forEachElement context
  name: 'products', // stored in context
  multiple: true, // Optional: Extract from multiple elements matching selector
  fields: {
    title: { selector: '.title', type: 'css' },
    price: { selector: '.price', type: 'css' },
    // Example using "self": Get the element's own text
    productText: { selector: 'self', type: 'css' },
    // Example using "self": Get an attribute from the element itself
    productId: { selector: 'self', type: 'css', attribute: 'data-product-id' }
  },
  continueOnError: false, // Optional: Continue if an error occurs (default: false)
  defaultValue: null, // Optional: Default value if extraction fails and continueOnError is true
  usePageScope: false // Optional: Force using page scope even if inside forEachElement (default: false)
}
```
example:
```json
  "type": "extract",
            "name": "newsData",
            "selector": "div.card-header:text('News') + div",
            "description": "Extract news items from the right sidebar News box",
            "fields": {
                "newsItems": {
                    "selector": "a",
                    "type": "css",
                    "multiple": true,
                    "fields": {
                        "title": {
                            "selector": "self",
                            "type": "css"
                        },
                        "url": {
                            "selector": "self",
                            "type": "css",
                            "attribute": "href"
                        }
                    }
                }
            }
        }
```

**Parameters:**

-   `selector`: CSS selector for the parent element(s) containing the data. Can often be omitted when this step runs inside `forEachElement` if extracting from the current element.
-   `name`: The key under which the extracted data will be stored in the navigation context.
-   `multiple` (optional, boolean): If `true` and `selector` is provided, extracts data from *all* elements matching the `selector`. The result stored in `context[name]` will be an array. If `false` or omitted, extracts from the first matching element. Requires `fields` to define the structure of each item in the array.
-   `fields` (optional, object): Defines the structure of the data to be extracted. Keys are the names of the data points, values are `SelectorConfig` objects.
    -   **Using `selector: "self"`**: Within the `fields` definition, if the `selector` is set to the string `"self"`, it refers to the *current element* being processed (either the single element matched by the parent `selector`, or the current element in a `forEachElement` loop). This is useful for extracting the text content or attributes directly from the element itself.
    -   `SelectorConfig`: Can be a CSS or Regex selector configuration (see `Extraction Types` documentation).
-   `type` (string, optional, if `fields` is *not* used): Specifies the type of basic extraction if not using `fields`. Can be `'css'` (default) or `'regex'`. Used with `attribute` for CSS or `pattern`/`group` for Regex.
-   `attribute` (string, optional, if `fields` is *not* used): The attribute name to extract if using basic CSS extraction.
-   `source` (string, optional, if `fields` is *not* used): If set to `'html'`, extracts the `innerHTML` of the matched element(s).
-   `continueOnError` (boolean, optional): If `true`, the step will not throw an error if the main selector doesn't find an element or if a sub-field extraction fails. Defaults to `false`.
-   `defaultValue` (any, optional): The value to store if `continueOnError` is `true` and an error occurs during extraction. Defaults to `null`.
-   `usePageScope` (boolean, optional): If `true`, all selectors (the main `selector` and those within `fields`) are evaluated from the page's top-level scope, even if the `extract` step is nested within a `forEachElement` step. Defaults to `false`, meaning selectors are evaluated relative to the current element scope when inside `forEachElement`.

## Flow Control

### `condition`

Conditional step execution.

```typescript
{
  type: 'condition',
  condition: '#next-page', // selector or function
  thenSteps: [...],       // steps if true
  elseSteps: [...]        // steps if false
}
```

### `gotoStep`

Jumps execution to a specific step index (1-based). Useful for creating loops, especially in combination with `condition`.

```typescript
{
  type: 'gotoStep',
  step: 5 // Jump back to step 5
}
```

### `paginate`

Handles pagination.

```typescript
{
  type: 'paginate',
  selector: '.next-page',
  maxPages: 5,
  extractSteps: [...] // steps to repeat per page
}
```

## Validation

### `assert`

Performs an assertion check on an element's state. If the assertion fails and the step is not marked as `optional`, the navigation flow will halt with an error.

```typescript
{
  type: 'assert',
  selector: '#status-message', // Selector for the element to check
  assertionType: 'containsText', // Type of check to perform
  expectedValue: 'Success', // Value to check against (for text/attribute checks)
  attributeName: 'class', // Attribute name (for attribute checks)
  timeout: 10000, // Optional: Max time (ms) to wait for condition (default: 5000)
  optional: false, // Optional: If true, failure won't stop the flow (default: false)
  description: 'Verify success message appears' // Optional description
}
```

**Assertion Types (`assertionType`):**

1.  **`exists`**: Checks if at least one element matching the selector exists in the DOM.
2.  **`isVisible`**: Checks if the element is visible (i.e., not `display: none`, `visibility: hidden`, etc.). Waits for the element to become visible within the timeout.
3.  **`isHidden`**: Checks if the element is hidden. Waits for the element to become hidden within the timeout. An element that doesn't exist is considered hidden.
4.  **`containsText`**: Checks if the element's text content includes the `expectedValue` (string or RegExp). Waits for the condition within the timeout.
5.  **`hasAttribute`**: Checks if the element possesses the attribute specified by `attributeName`. Waits for the condition within the timeout.
6.  **`attributeEquals`**: Checks if the element's attribute (`attributeName`) matches the `expectedValue` (string or RegExp). Waits for the condition within the timeout.

**Use Cases:**

-   Verify that a specific element appears after an action (e.g., login success message).
-   Confirm that an element contains the expected data before extraction.
-   Check if an element is disabled or enabled (e.g., `assert` `hasAttribute` 'disabled').
-   Ensure loading indicators disappear (`assert` `isHidden` '#spinner').

**Difference from `wait` and `condition`:**

-   `wait`: Primarily pauses execution until a condition is met (element exists, time passes, navigation occurs). It doesn't inherently fail the flow if the condition isn't met within a reasonable time (though Playwright might timeout).
-   `condition`: Branches the execution flow (`then`/`else`) based on a boolean result (currently element existence or function result). It doesn't typically fail the flow if the condition is false.
-   `assert`: Explicitly validates a state. Its primary purpose is to *confirm* an expectation, and it *will* fail the flow by default if the expectation isn't met within the timeout.

## Advanced

### `switchToFrame`

Switches the execution context to an iframe and executes a series of steps within it. Optionally switches back to the parent frame afterwards.

```typescript
{
  type: 'switchToFrame',
  selector: '#ad-iframe', // Option 1: Selector for the iframe element
  // frameId: 'user-form-frame', // Option 2: ID of the iframe
  // frameName: 'formTarget', // Option 3: Name of the iframe
  steps: [ // Steps to execute within the frame's context
    {
      type: 'input',
      selector: '#email-in-frame',
      value: 'test@example.com'
    },
    {
      type: 'click',
      selector: 'button.submit-in-frame'
    }
  ],
  switchToDefault: true, // Optional: Switch back to parent frame (default: true)
  description: 'Interact with elements inside the ad iframe' // Optional
}
```

**Parameters:**

-   One of the following is required to identify the frame:
    -   `selector`: CSS selector for the `<iframe>` element.
    -   `frameId`: The `id` attribute of the `<iframe>` element.
    -   `frameName`: The `name` attribute of the `<iframe>` element.
-   `steps`: An array of `NavigationStep` objects to be executed within the context of the identified frame. Selectors within these steps will be evaluated relative to the frame's document.
-   `switchToDefault` (optional): A boolean indicating whether to switch the context back to the parent frame after executing the `steps`. Defaults to `true`. If set to `false`, subsequent steps in the main flow will continue to operate within the frame's context (which is generally not recommended unless the entire remaining flow is within that frame).
-   `description` (optional): Custom description for logging purposes.
-   `timeout` (optional): Maximum time in milliseconds to wait for the iframe element to be attached to the DOM (default: 10000ms).
-   `optional` (optional): If `true`, failure to find the frame or errors within the frame's steps will not halt the entire navigation flow (default: `false`).

**Functionality:**

1.  Locates the specified iframe using the provided `selector`, `frameId`, or `frameName`.
2.  Switches the execution context to the found frame.
3.  Executes the nested `steps` array sequentially within the frame's context.
4.  If `switchToDefault` is `true`, implicitly restores the execution context to the parent frame upon completion or error.

**Important Note:** The current implementation passes the Playwright `Frame` object to the `execute` method of the handlers for the nested steps. This relies on the handlers being able to correctly use the `Frame` object (e.g., using `frame.locator()`) instead of the `Page` object. This might require adjustments to other handlers if they strictly expect a `Page` object.

### `handleDialog`

Sets up a handler for the *next* browser dialog (`alert`, `confirm`, `prompt`) that appears on the page. This step should be placed *before* the action that triggers the dialog.

```typescript
{
  type: 'handleDialog',
  action: 'accept', // 'accept' or 'dismiss'
  promptText: 'Optional text for prompt dialogs', // Only used if action is 'accept' and dialog is a prompt
  description: 'Accept the confirmation dialog' // Optional
}

// Example Usage:
[
  {
    type: 'handleDialog', // Set up listener first
    action: 'accept'
  },
  {
    type: 'click', // This click triggers the dialog
    selector: '#delete-button'
  }
]
```

**Parameters:**

-   `action`: Specifies how to handle the dialog.
    -   `'accept'`: Clicks the 'OK' or equivalent button. If the dialog is a `prompt`, it accepts with the optional `promptText`.
    -   `'dismiss'`: Clicks the 'Cancel' or equivalent button, or closes the dialog.
-   `promptText` (optional): The text to enter into a `prompt` dialog before accepting it. Ignored for `alert` and `confirm` dialogs, or if `action` is `'dismiss'`.
-   `description` (optional): Custom description for logging purposes.
-   `optional` (optional): If `true`, an error setting up the listener itself will not halt the flow (default: `false`). Note: This does not make the *handling* of the dialog optional if one appears.

**Functionality:**

1.  Registers a one-time listener for the `dialog` event on the current page.
2.  When a dialog appears, the listener automatically performs the specified `action` (accepting or dismissing).
3.  The `handleDialog` step itself completes immediately after setting up the listener; it does not wait for a dialog to appear.

**Use Cases:**

-   Automatically accepting confirmation popups (e.g., "Are you sure you want to delete?").
-   Dismissing alert messages.
-   Entering text into and accepting prompt dialogs.

**Important:** Place this step immediately before the action step (like `click`) that is expected to trigger the dialog. The listener only applies to the *next* dialog that appears after this step is executed.

### `manageCookies`

Allows for adding, deleting, clearing, or retrieving browser cookies for the current context.

```typescript
// Example: Add a cookie
{
  type: 'manageCookies',
  action: 'add',
  cookies: [
    {
      name: 'session_id',
      value: '{{context.sessionId}}', // Use value from context
      domain: '.example.com',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax'
    }
  ],
  description: 'Add session cookie'
}

// Example: Get specific cookies and store in context
{
  type: 'manageCookies',
  action: 'get',
  domain: '.example.com', // Filter by domain
  contextKey: 'exampleCookies', // Store result in context.exampleCookies
  description: 'Get example.com cookies'
}

// Example: Clear all cookies
{
  type: 'manageCookies',
  action: 'clear',
  description: 'Clear all cookies'
}

// Example: Delete a specific cookie
{
  type: 'manageCookies',
  action: 'delete', // Note: 'clear' with filters achieves the same
  name: 'tracking_id',
  domain: '.example.com', // Optional filter
  description: 'Delete tracking cookie'
}
```

**Parameters:**

-   `action`: The operation to perform:
    -   `'add'`: Adds one or more cookies. Requires the `cookies` parameter.
    -   `'delete'`: Deletes cookies matching the specified `name` and optional `domain`/`path`. Requires the `name` parameter. (Functionally similar to `clear` with filters).
    -   `'clear'`: Clears cookies. If `name`, `domain`, or `path` are provided, only matching cookies are cleared. If no filters are provided, all cookies for the current context are cleared.
    -   `'get'`: Retrieves cookies matching the optional `name`, `domain`, or `path` filters. Stores the result (an array of cookie objects) in the navigation context under the key specified by `contextKey` (defaults to `'retrievedCookies'`).
-   `cookies` (for `action: 'add'`): An array of cookie objects to add. Each object can have the following properties (matching Playwright's `Cookie` type):
    -   `name` (string): Cookie name.
    -   `value` (string): Cookie value.
    -   `url` (string, optional): URL to associate the cookie with.
    -   `domain` (string, optional): Cookie domain (e.g., `.example.com`).
    -   `path` (string, optional): Cookie path (e.g., `/`).
    -   `expires` (number, optional): Expiration date as a Unix timestamp in seconds.
    -   `httpOnly` (boolean, optional): HTTP-only flag.
    -   `secure` (boolean, optional): Secure flag.
    -   `sameSite` ('Strict' | 'Lax' | 'None', optional): SameSite attribute.
-   `name` (string, optional): The name of the cookie to target for `delete` or filter by for `get`/`clear`.
-   `domain` (string, optional): Filter cookies by domain for `delete`, `clear`, or `get`.
-   `path` (string, optional): Filter cookies by path for `delete`, `clear`, or `get`.
-   `contextKey` (string, optional, for `action: 'get'`): The key under which the retrieved cookies array will be stored in the navigation context. Defaults to `'retrievedCookies'`.
-   `description` (optional): Custom description for logging purposes.
-   `optional` (optional): If `true`, errors during cookie management will not halt the flow (default: `false`).

**Functionality:**

-   Interacts with the browser context's cookie store using Playwright's `browserContext.addCookies()`, `browserContext.clearCookies()`, and `browserContext.cookies()` methods.
-   Allows explicit control over cookies beyond the implicit session management.

### `manageStorage`

Allows for interacting with the browser's `localStorage` or `sessionStorage`.

```typescript
// Example: Set an item in localStorage
{
  type: 'manageStorage',
  storageType: 'local', // 'local' or 'session'
  action: 'setItem',
  key: 'userPreferences',
  value: { theme: 'dark', notifications: false }, // Value will be JSON.stringified
  description: 'Save user preferences to localStorage'
}

// Example: Get an item from sessionStorage and store in context
{
  type: 'manageStorage',
  storageType: 'session',
  action: 'getItem',
  key: 'sessionToken',
  contextKey: 'retrievedSessionToken', // Store result here
  description: 'Get session token from sessionStorage'
}

// Example: Remove an item from localStorage
{
  type: 'manageStorage',
  storageType: 'local',
  action: 'removeItem',
  key: 'tempData',
  description: 'Remove temporary data from localStorage'
}

// Example: Clear all sessionStorage
{
  type: 'manageStorage',
  storageType: 'session',
  action: 'clear',
  description: 'Clear all sessionStorage'
}
```

**Parameters:**

-   `storageType`: Specifies which storage to target:
    -   `'local'`: Targets `window.localStorage`.
    -   `'session'`: Targets `window.sessionStorage`.
-   `action`: The operation to perform:
    -   `'setItem'`: Sets an item. Requires `key` and `value`. The `value` will be automatically `JSON.stringify`-ed before storing.
    -   `'getItem'`: Retrieves an item by `key`. Requires `key`. The retrieved value will be automatically `JSON.parse`-ed (if possible) and stored in the navigation context under the key specified by `contextKey` (defaults to `'retrievedStorageItem'`). If parsing fails, the raw string is stored.
    -   `'removeItem'`: Removes an item by `key`. Requires `key`.
    -   `'clear'`: Removes all items from the specified storage type.
-   `key` (string, optional): The key for the storage item. Required for `setItem`, `getItem`, and `removeItem`. Can use context variables.
-   `value` (any, optional): The value to store for `setItem`. Can be any JSON-serializable type (including objects/arrays) or use context variables. Required for `setItem`.
-   `contextKey` (string, optional, for `action: 'getItem'`): The key under which the retrieved item will be stored in the navigation context. Defaults to `'retrievedStorageItem'`.
-   `description` (optional): Custom description for logging purposes.
-   `optional` (optional): If `true`, errors during storage management will not halt the flow (default: `false`).

**Functionality:**

-   Executes JavaScript within the page context (`page.evaluate`) to interact with `window.localStorage` or `window.sessionStorage`.
-   Handles JSON serialization (`setItem`) and deserialization (`getItem`) automatically.

### `scroll`

Scrolls the page or to a specific element with advanced options.

```typescript
{
  type: 'scroll',
  // Either use directional scrolling:
  direction: 'down', // 'up'/'left'/'right'
  distance: 500,     // pixels

  // OR scroll to an element:
  selector: '#element',
  scrollIntoView: true, // use native scrollIntoView (default: false)
  scrollMargin: 50,     // additional margin in pixels
  behavior: 'smooth',   // 'smooth' or 'auto'
  timeout: 5000,       // maximum wait time in ms

  // Common options:
  waitFor: '#next-section' // optional selector to wait for
}
```

**Scroll Features:**

1. **Directional Scrolling**: Scroll by fixed amount in any direction
2. **Element Scrolling**: Scroll to bring element into view with configurable margin
3. **Scroll Behavior**: Control smoothness with 'smooth' or instant with 'auto'
4. **Timeout Handling**: Set maximum wait time for scroll operations
5. **Native vs Custom**: Choose between browser-native or human-like scrolling
6. **Wait Conditions**: Optionally wait for elements after scrolling

**Implementation Details:**

- Uses Playwright's scroll functionality with human-like emulation
- Supports both absolute pixel scrolling and element-based scrolling
- Automatically handles edge cases like scroll containers
- Includes intelligent waiting for scroll completion

**Examples:**

```typescript
// Directional scrolling with smooth behavior
{
  type: 'scroll',
  direction: 'down',
  distance: 1000,
  behavior: 'smooth',
  timeout: 3000
}

// Scroll to element with margin and wait
{
  type: 'scroll',
  selector: '#footer',
  scrollMargin: 100,
  waitFor: '#content-loaded'
}

// Native browser scrollIntoView with timeout
{
  type: 'scroll',
  selector: '#header',
  scrollIntoView: true,
  timeout: 5000
}

// Horizontal scrolling
{
  type: 'scroll',
  direction: 'right',
  distance: 300
}
```

### `forEachElement`

Loops through elements matching a selector and executes steps for each one.

```typescript
{
  type: 'forEachElement',
  selector: 'tr.items', // CSS selector for elements to loop through
  description: 'Optional description',
  maxIterations: 50, // Optional limit on number of elements to process
  elementSteps: [ // Steps to execute for each matched element
    {
      type: 'click',
      selector: '.details-btn', // Relative to current element
      description: 'Click details button'
    },
    {
      type: 'wait',
      value: '.details-panel',
      timeout: 5000
    },
    {
      type: 'extract',
      name: 'panelData',
      selector: '.details-panel',
      fields: {
        // Extraction fields
      }
    },
    {
      type: 'mergeContext', // Special step to merge data back
      source: 'panelData',
      target: 'results[{{index}}]', // {{index}} is available in elementSteps
      mergeStrategy: {
        // Define how to merge fields
      }
    }
  ]
}
```

**Key Features:**
- Processes each matched element sequentially
- Provides `{{index}}` variable (0-based) in elementSteps
- Supports all standard step types within elementSteps
- Includes special `mergeContext` step for combining data
- Optional maxIterations to limit processing

**Example with Data Merging:**

```typescript
{
  type: 'forEachElement',
  selector: 'tr.products',
  elementSteps: [
    {
      type: 'click',
      selector: 'button.more-info'
    },
    {
      type: 'wait',
      value: '.product-details',
      timeout: 5000
    },
    {
      type: 'extract',
      name: 'productDetails',
      selector: '.product-details',
      fields: {
        name: { selector: '.name', type: 'css' },
        price: { selector: '.price', type: 'css' }
      }
    },
    {
      type: 'mergeContext',
      source: 'productDetails',
      target: 'products[{{index}}]',
      mergeStrategy: {
        name: 'overwrite',
        price: 'overwrite'
      }
    }
  ]
}
```

**Real-world Example:**
For a complete implementation showing how to use `forEachElement` and `mergeContext` to scrape Google Trends data, see:  
[Google Trends Navigation Example](./googletrendingnow_example.md)

This example demonstrates:
- Clicking through multiple items to reveal details
- Extracting nested data structures
- Merging data back into the main context
- Handling dynamic content loading

### `executeScript`

Executes custom JavaScript.

```typescript
{
  type: 'executeScript',
  script: 'window.scrollTo(0, document.body.scrollHeight)'
}
```

## Mouse Movement Details

The mouse movement system provides:

1. Human-like movement patterns using Bezier curves
2. Adjustable speed via duration parameter
3. Both element-based and coordinate-based targeting
4. Smooth transitions between points
5. Random delays to simulate human behavior

Example complex mouse flow:

```typescript
[
  {
    type: 'mousemove',
    endPoint: { x: 100, y: 100 },
    duration: 800,
  },
  {
    type: 'mousemove',
    mouseTarget: { selector: '#menu'},
    duration: 1200,
  },
  {
    type: 'hover',
    mouseTarget: { selector: '#submenu'},
    duration: 2000,
  },
];
```
