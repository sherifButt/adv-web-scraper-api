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
Clicks an element.

```typescript
{
  type: 'click',
  selector: '#button',
  waitFor: '#next-page' // optional
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
    x: 100, y: 100,
    duration: 800,
    pathPoints: [
      { x: 50, y: 50 },
      { selector: '#menu-trigger' }
    ]
  },
  {
    type: 'mousemove',
    selector: '#menu-item',
    action: 'click',
    duration: 1200
  },
  {
    type: 'mousemove',
    selector: '#slider',
    action: 'drag',
    dragTo: { x: 500, y: 300 },
    duration: 2000
  }
]
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
Scrolls the page.

```typescript
{
  type: 'scroll',
  direction: 'down', // 'up'/'left'/'right'
  distance: 500      // pixels
}
```

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
    x: 100, y: 100,
    duration: 800
  },
  {
    type: 'mousemove', 
    selector: '#menu',
    duration: 1200
  },
  {
    type: 'hover',
    selector: '#submenu',
    duration: 2000
  }
]
