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
-   Use the `mousemove` step with `action: 'click'` when you need fine-grained control over the *mouse movement path* leading up to the click (e.g., for human-like emulation involving complex paths) or when you specifically need the lower-level `mouse.down`/`mouse.up` behavior instead of `elementHandle.click()`.

### `mousemove`

Moves mouse to element or coordinates with optional actions.

```typescript
{
  type: 'mousemove',
  selector: '#menu', // either selector
  x: 100, y: 200,    // or coordinates
  duration: 1000,     // movement time in ms
  humanLike: true,    // enable human-like movement (default: true)
  action: 'move',     // 'move' (default), 'click', 'drag', 'wheel'
  pathPoints: [       // optional intermediate points
    { x: 50, y: 50 },
    { selector: '#intermediate' }
  ],
  // For drag action:
  dragTo: { x: 200, y: 200 }, // or selector
  // For wheel action:
  deltaX: 0, deltaY: 100,     // wheel scroll deltas
  waitFor: '#tooltip' // optional
}
```

**Advanced Mouse Movement Features:**

1. **Path Points**: Define intermediate points for complex movement paths
2. **Actions**:
   - `move`: Just move the cursor (default)
   - `click`: Move then click
   - `drag`: Move, press down, move to target, release
   - `wheel`: Move then scroll wheel
3. **Human-like Movement**: Uses Bezier curves with random variations
4. **Coordinate Precision**: Exact pixel positioning when needed
5. **Element Targeting**: Works with both selectors and raw coordinates

**Example Complex Mouse Flow:**

```typescript
[
  {
    type: 'mousemove',
    x: 100,
    y: 100,
    duration: 800,
    pathPoints: [{ x: 50, y: 50 }, { selector: '#menu-trigger' }],
  },
  {
    type: 'mousemove',
    selector: '#menu-item',
    action: 'click',
    duration: 1200,
  },
  {
    type: 'mousemove',
    selector: '#slider',
    action: 'drag',
    dragTo: { x: 500, y: 300 },
    duration: 2000,
  },
];
```

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

## Data Extraction

### `extract`

Extracts data from elements.

```typescript
{
  type: 'extract',
  selector: '.product',
  name: 'products', // stored in context
  fields: {
    title: { selector: '.title', type: 'css' },
    price: { selector: '.price', type: 'css' }
  }
}
```

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
-   `name` (string, optional): The name of the cookie to target for `delete` or filter by for `get`/`clear`. Required for `delete`.
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
    x: 100,
    y: 100,
    duration: 800,
  },
  {
    type: 'mousemove',
    selector: '#menu',
    duration: 1200,
  },
  {
    type: 'hover',
    selector: '#submenu',
    duration: 2000,
  },
];
```
