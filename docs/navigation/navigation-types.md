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

Clicks an element with mouse or keyboard.

```typescript
{
  type: 'click',
  selector: '#button',
  triggerType: 'mouse', // 'mouse' (default) or 'keyboard'
  waitFor: '#next-page' // optional
}
```

**Trigger Types:**

1. **mouse** (default): Standard mouse click
2. **keyboard**: Simulates spacebar key press on element (useful for accessibility testing)

**Example Keyboard Click:**

```typescript
{
  type: 'click',
  selector: 'button.submit',
  triggerType: 'keyboard',
  waitFor: 1000 // wait after key press
}
```

### `mousemove`

Moves mouse to element or coordinates with optional actions.

```typescript
{
  type: 'mousemove',
  selector: '#menu', // either selector
  x: 100, y: 200,    // or coordinates
  duration: 1000,     // movement time in ms
  humanLike: true,    // enable human-like movement
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

## Advanced

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
