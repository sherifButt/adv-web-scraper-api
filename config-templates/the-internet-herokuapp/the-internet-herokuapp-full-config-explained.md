# Explained: The Internet Herokuapp - Full Config

This document explains the `the-internet-herokuapp-full-config.json` navigation configuration file step-by-step.

## Overall Structure

The configuration defines a navigation flow for the website `https://the-internet.herokuapp.com/`. It includes:
- Initial setup (adding cookies, setting localStorage).
- Navigation to and basic interaction with *all* example challenge pages listed on the site's homepage.
- More detailed interaction flows for specific challenges (Login, JS Alerts, File Upload, iFrame, Multiple Windows).
- Final steps to retrieve the initially set cookie and localStorage item.
- Global options and variables for the flow.

## Configuration JSON with Comments

```json
{
  // The starting URL for the navigation flow.
  "startUrl": "https://the-internet.herokuapp.com/",

  // The sequence of steps to be executed by the navigation engine.
  "steps": [
    // --- Initial Setup Steps ---
    {
      "type": "manageCookies", // Step type for cookie operations.
      "action": "add", // Action: Add cookies.
      "cookies": [ // Array of cookies to add.
        {
          "name": "myTestCookie", // Cookie name.
          "value": "ClineWasHere-{{Date.now()}}", // Cookie value using a dynamic timestamp.
          "domain": ".the-internet.herokuapp.com", // Cookie domain.
          "path": "/" // Cookie path.
        }
      ],
      "description": "Add a custom test cookie" // Description for logging.
    },
    {
      "type": "manageStorage", // Step type for localStorage/sessionStorage operations.
      "storageType": "local", // Target localStorage.
      "action": "setItem", // Action: Set an item.
      "key": "myTestData", // Key for the item.
      "value": { "framework": "adv-web-scraper-api", "timestamp": "{{Date.now()}}" }, // Value (will be JSON stringified).
      "description": "Set a test item in localStorage" // Description.
    },

    // --- New Challenge Navigation & Interaction Steps ---
    // Visit A/B Testing page.
    {
      "type": "goto", // Step type for navigation.
      "value": "https://the-internet.herokuapp.com/abtest", // URL to navigate to.
      "description": "Navigate to A/B Testing page"
    },
    // Visit Add/Remove Elements page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/add_remove_elements/",
      "description": "Navigate to Add/Remove Elements page"
    },
    // Click the 'Add Element' button.
    {
      "type": "click", // Step type for clicking elements.
      "selector": "button[onclick='addElement()']", // CSS selector for the button.
      "description": "Click Add Element button"
    },
    // Assert that a new element was added.
    {
      "type": "assert", // Step type for validation checks.
      "selector": "#elements button.added-manually", // Selector for the added element.
      "assertionType": "exists", // Check if the element exists.
      "description": "Assert element was added"
    },
    // Click the added 'Delete' button.
    {
      "type": "click",
      "selector": "#elements button.added-manually",
      "description": "Click Delete button"
    },
    // Assert that the element is now hidden (removed).
    {
      "type": "assert",
      "selector": "#elements button.added-manually",
      "assertionType": "isHidden", // Check if the element is hidden or non-existent.
      "description": "Assert element was removed"
    },
    // Visit Basic Auth page (Note: Requires browser-level auth handling, not covered by config).
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/basic_auth",
      "description": "Navigate to Basic Auth page (Manual auth likely required)"
    },
    // Visit Broken Images page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/broken_images",
      "description": "Navigate to Broken Images page"
    },
    // Visit Challenging DOM page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/challenging_dom",
      "description": "Navigate to Challenging DOM page"
    },
    // Visit Checkboxes page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/checkboxes",
      "description": "Navigate to Checkboxes page"
    },
    // Click the first checkbox.
    {
      "type": "click",
      "selector": "#checkboxes input[type=checkbox]:first-of-type",
      "description": "Click the first checkbox"
    },
    // Click the second (last) checkbox.
    {
      "type": "click",
      "selector": "#checkboxes input[type=checkbox]:last-of-type",
      "description": "Click the last checkbox"
    },
    // Visit Context Menu page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/context_menu",
      "description": "Navigate to Context Menu page"
    },
    // Prepare to handle the JavaScript alert that will pop up.
    {
      "type": "handleDialog", // Step type to pre-configure dialog handling.
      "action": "accept", // Action: Accept the dialog (click OK).
      "description": "Set up listener to accept the next alert dialog"
    },
    // Right-click the target area to trigger the context menu and alert.
    {
      "type": "click",
      "selector": "#hot-spot", // Selector for the target area.
      "button": "right", // Specify a right-click.
      "description": "Right-click the hot spot"
    },
    // Visit Digest Auth page (Note: Requires browser-level auth handling).
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/digest_auth",
      "description": "Navigate to Digest Auth page (Manual auth likely required)"
    },
    // Visit Disappearing Elements page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/disappearing_elements",
      "description": "Navigate to Disappearing Elements page"
    },
    // Visit Drag and Drop page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/drag_and_drop",
      "description": "Navigate to Drag and Drop page"
    },
    // Perform a drag-and-drop operation using mousemove.
    {
      "type": "mousemove", // Step type for mouse movements.
      "selector": "#column-a", // Element to start dragging.
      "action": "drag", // Perform a drag action.
      "dragTo": { "selector": "#column-b" }, // Target element to drop onto.
      "duration": 1500, // Duration of the drag movement in ms.
      "description": "Drag element A to element B"
    },
    // Visit Dropdown page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/dropdown",
      "description": "Navigate to Dropdown page"
    },
    // Select an option from the dropdown by its 'value' attribute.
    {
      "type": "select", // Step type for selecting dropdown options.
      "selector": "#dropdown", // Selector for the <select> element.
      "value": "1", // Value attribute of the <option> to select.
      "description": "Select Option 1 from dropdown"
    },
    // Assert that the correct option is now selected.
    {
      "type": "assert",
      "selector": "#dropdown option[selected='selected']", // Selector for the selected option.
      "assertionType": "containsText", // Check if its text content contains...
      "expectedValue": "Option 1", // ...the expected text.
      "description": "Assert Option 1 is selected"
    },
    // Select another option, this time by its visible text.
    {
      "type": "select",
      "selector": "#dropdown",
      "value": "Option 2", // Visible text of the <option> to select.
      "description": "Select Option 2 from dropdown"
    },
    // Assert that the second option is now selected.
    {
      "type": "assert",
      "selector": "#dropdown option[selected='selected']",
      "assertionType": "containsText",
      "expectedValue": "Option 2",
      "description": "Assert Option 2 is selected"
    },
    // Visit Dynamic Content page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/dynamic_content",
      "description": "Navigate to Dynamic Content page"
    },
    // Visit Dynamic Controls page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/dynamic_controls",
      "description": "Navigate to Dynamic Controls page"
    },
    // Visit Dynamic Loading page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/dynamic_loading",
      "description": "Navigate to Dynamic Loading page"
    },
    // Visit Entry Ad page (Note: May require handling a modal popup).
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/entry_ad",
      "description": "Navigate to Entry Ad page"
    },
    // Visit Exit Intent page (Note: Triggering requires specific mouse actions).
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/exit_intent",
      "description": "Navigate to Exit Intent page"
    },
    // Visit File Download page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/download",
      "description": "Navigate to File Download page"
    },
    // Visit Floating Menu page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/floating_menu",
      "description": "Navigate to Floating Menu page"
    },
    // Scroll down the page.
    {
      "type": "scroll", // Step type for scrolling.
      "direction": "down", // Scroll direction.
      "distance": 1000, // Scroll distance in pixels.
      "description": "Scroll down to test floating menu"
    },
    // Assert that the floating menu is still visible after scrolling.
    {
      "type": "assert",
      "selector": "#menu", // Selector for the menu.
      "assertionType": "isVisible", // Check if it's visible.
      "description": "Assert floating menu is still visible after scroll"
    },
    // Visit Forgot Password page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/forgot_password",
      "description": "Navigate to Forgot Password page"
    },
    // Visit Frames page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/frames",
      "description": "Navigate to Frames page"
    },
    // Visit Geolocation page (Note: Requires browser permissions).
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/geolocation",
      "description": "Navigate to Geolocation page"
    },
    // Visit Horizontal Slider page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/horizontal_slider",
      "description": "Navigate to Horizontal Slider page"
    },
    // Visit Hovers page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/hovers",
      "description": "Navigate to Hovers page"
    },
    // Hover over the first image.
    {
      "type": "hover", // Step type for hovering over elements.
      "selector": ".figure:nth-of-type(1)", // Selector for the first figure.
      "description": "Hover over first image"
    },
    // Wait for the caption to appear (it appears on hover).
    {
      "type": "wait", // Step type for waiting.
      "selector": ".figure:nth-of-type(1) .figcaption", // Wait for this selector.
      "timeout": 2000 // Max wait time in ms.
    },
    // Assert the caption is now visible.
    {
      "type": "assert",
      "selector": ".figure:nth-of-type(1) .figcaption",
      "assertionType": "isVisible",
      "description": "Assert first caption is visible"
    },
    // Assert the text content of the caption.
    {
      "type": "assert",
      "selector": ".figure:nth-of-type(1) .figcaption h5",
      "assertionType": "containsText",
      "expectedValue": "name: user1",
      "description": "Assert first caption text"
    },
    // Hover over the second image.
    {
      "type": "hover",
      "selector": ".figure:nth-of-type(2)",
      "description": "Hover over second image"
    },
    // Wait for its caption.
    {
      "type": "wait",
      "selector": ".figure:nth-of-type(2) .figcaption",
      "timeout": 2000
    },
    // Assert the second caption is visible.
    {
      "type": "assert",
      "selector": ".figure:nth-of-type(2) .figcaption",
      "assertionType": "isVisible",
      "description": "Assert second caption is visible"
    },
    // Visit Infinite Scroll page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/infinite_scroll",
      "description": "Navigate to Infinite Scroll page"
    },
    // Visit Inputs page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/inputs",
      "description": "Navigate to Inputs page"
    },
    // Enter text into the number input field.
    {
      "type": "input", // Step type for text input.
      "selector": "input[type='number']", // Selector for the input field.
      "value": "12345", // Value to type.
      "description": "Enter numbers into the input field"
    },
    // Visit JQuery UI Menus page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/jqueryui/menu",
      "description": "Navigate to JQuery UI Menus page"
    },
    // Visit JavaScript onload error page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/javascript_error",
      "description": "Navigate to JavaScript onload error page"
    },
    // Visit Key Presses page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/key_presses",
      "description": "Navigate to Key Presses page"
    },
    // Simulate typing 'A' into the target input.
    {
      "type": "input",
      "selector": "#target",
      "value": "A",
      "description": "Simulate pressing 'A' key"
    },
    // Assert the result text reflects the key press.
    {
      "type": "assert",
      "selector": "#result",
      "assertionType": "containsText",
      "expectedValue": "You entered: A",
      "description": "Assert result after key press"
    },
    // Simulate pressing the Shift key using Playwright's special key syntax.
    {
      "type": "input",
      "selector": "#target",
      "value": "{Shift}", // Special key syntax.
      "description": "Simulate pressing 'Shift' key"
    },
    // Assert the result text reflects the Shift key press.
    {
      "type": "assert",
      "selector": "#result",
      "assertionType": "containsText",
      "expectedValue": "You entered: SHIFT",
      "description": "Assert result after Shift key press"
    },
    // Visit Large & Deep DOM page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/large",
      "description": "Navigate to Large & Deep DOM page"
    },
    // Visit Nested Frames page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/nested_frames",
      "description": "Navigate to Nested Frames page"
    },
    // Visit Notification Messages page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/notification_message_rendered",
      "description": "Navigate to Notification Messages page"
    },
    // Visit Redirect Link page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/redirector",
      "description": "Navigate to Redirect Link page"
    },
    // Visit Secure File Download page (Note: Requires prior login).
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/download_secure",
      "description": "Navigate to Secure File Download page (Requires Login)"
    },
    // Visit Shadow DOM page (Note: Interactions use standard selectors).
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/shadowdom",
      "description": "Navigate to Shadow DOM page"
    },
    // Visit Shifting Content page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/shifting_content",
      "description": "Navigate to Shifting Content page"
    },
    // Visit Slow Resources page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/slow",
      "description": "Navigate to Slow Resources page"
    },
    // Visit Sortable Data Tables page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/tables",
      "description": "Navigate to Sortable Data Tables page"
    },
    // Visit Status Codes page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/status_codes",
      "description": "Navigate to Status Codes page"
    },
    // Visit Typos page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/typos",
      "description": "Navigate to Typos page"
    },

    // --- Original Detailed Interaction Steps ---
    // Navigate back to the login page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/login",
      "description": "Navigate to login page (Original Step)"
    },
    // Perform login using the dedicated 'login' step type.
    {
      "type": "login", // Step type specifically for login flows.
      "usernameSelector": "#username", // Selector for username field.
      "passwordSelector": "#password", // Selector for password field.
      "submitSelector": "button[type='submit']", // Selector for submit button.
      "usernameValue": "{{username}}", // Username from variables.
      "passwordValue": "{{password}}", // Password from variables.
      "waitForNavigation": false, // Don't wait for full navigation...
      "waitFor": "#flash.success", // ...instead, wait for the success message element.
      "description": "Perform login using known credentials (Original Step)"
    },
    // Assert the login success message is displayed.
    {
      "type": "assert",
      "selector": "#flash",
      "assertionType": "containsText",
      "expectedValue": "You logged into a secure area!",
      "description": "Assert successful login message (Original Step)"
    },
    // Navigate to the JavaScript Alerts page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/javascript_alerts",
      "description": "Navigate to JS Alerts page (Original Step)"
    },
    // Prepare to handle the next confirmation dialog.
    {
      "type": "handleDialog",
      "action": "accept",
      "description": "Set up listener to accept the next confirm dialog (Original Step)"
    },
    // Click the button that triggers the confirmation dialog.
    {
      "type": "click",
      "selector": "button[onclick='jsConfirm()']",
      "description": "Click button to trigger confirm dialog (Original Step)"
    },
    // Assert the result text after accepting the dialog.
    {
      "type": "assert",
      "selector": "#result",
      "assertionType": "containsText",
      "expectedValue": "You clicked: Ok",
      "description": "Assert result text after accepting confirm (Original Step)"
    },
    // Navigate to the File Upload page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/upload",
      "description": "Navigate to File Upload page (Original Step)"
    },
    // Upload a file using the 'uploadFile' step type.
    {
      "type": "uploadFile", // Step type for file uploads.
      "selector": "#file-upload", // Selector for the <input type="file"> element.
      "filePath": "./test-upload.txt", // Path to the file (ensure it exists relative to CWD).
      "description": "Upload the test file (Original Step)"
    },
    // Click the submit button for the file upload.
    {
      "type": "click",
      "selector": "#file-submit",
      "waitFor": "#uploaded-files", // Wait for the element showing uploaded files.
      "description": "Submit the uploaded file (Original Step)"
    },
    // Assert that the uploaded file's name is displayed.
    {
      "type": "assert",
      "selector": "#uploaded-files",
      "assertionType": "containsText",
      "expectedValue": "test-upload.txt",
      "description": "Assert uploaded file name is displayed (Original Step)"
    },
    // Navigate to the iFrame page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/iframe",
      "description": "Navigate to iFrame page (Original Step)"
    },
    // Switch context to the WYSIWYG editor iframe and perform steps within it.
    {
      "type": "switchToFrame", // Step type to change execution context to an iframe.
      "selector": "#mce_0_ifr", // Selector for the iframe element.
      "description": "Switch to the WYSIWYG editor iframe (Original Step)",
      "optional": true, // If the frame isn't found, don't fail the whole flow.
      "steps": [ // Nested steps executed within the iframe context.
        {
          "type": "wait", // Wait briefly for potential frame initialization.
          "value": 500,
          "description": "Wait 0.5s after switching to frame for init"
        },
        {
          "type": "wait", // Wait for the editor element inside the frame to be visible.
          "selector": "#tinymce",
          "state": "visible", // Playwright state option.
          "timeout": 10000,
          "description": "Wait for iframe editor to be visible"
        },
        {
          "type": "input", // Type text into the editor within the iframe.
          "selector": "#tinymce",
          "value": "{{text}}", // Use text from variables.
          "clearInput": true, // Clear existing content first.
          "description": "Type text inside the iframe editor",
          "optional": true
        },
        {
          "type": "assert", // Assert the text was entered correctly within the iframe.
          "selector": "#tinymce",
          "assertionType": "containsText",
          "expectedValue": "{{text}}", // Assert against the variable value.
          "description": "Assert text within the iframe editor",
          "optional": true
        }
      ] // Context automatically switches back to the parent frame after these steps.
    },
    // Navigate to the Multiple Windows page.
    {
      "type": "goto",
      "value": "https://the-internet.herokuapp.com/windows",
      "description": "Navigate to Multiple Windows page (Original Step)"
    },
    // Click the link that opens a new browser window/tab.
    {
      "type": "click",
      "selector": "#content > div > a",
      "description": "Click link that opens a new window (Original Step)",
      "waitForPopup": true // Special flag indicating this click triggers a popup/new tab.
    },
    // Switch the execution context to the newly opened tab.
    {
      "type": "switchTab", // Step type for managing browser tabs/windows.
      "action": "switchToLast", // Action: Switch to the most recently opened tab.
      "contextKey": "newWindowPage", // Store the Playwright Page object for the new tab in context.
      "timeout": 10000,
      "description": "Switch context to the newest tab (Original Step)"
    },
    // Assert content within the new tab.
    {
      "type": "assert",
      "selector": "h3",
      "assertionType": "containsText",
      "expectedValue": "New Window",
      "description": "Assert content on the new tab (Original Step)",
      "pageContextKey": "newWindowPage" // Explicitly run this assertion on the page stored in context.
    },
    // Switch back to the original tab (index 0).
    {
       "type": "switchTab",
       "action": "switch", // Action: Switch to a specific target.
       "target": 0, // Target: The first tab (index 0).
       "description": "Switch back to the original tab (Original Step)"
    },
    // Assert content on the original tab after switching back.
    {
       "type": "assert",
       "selector": "h3",
       "assertionType": "containsText",
       "expectedValue": "Opening a new window",
       "description": "Assert content on the original tab after switching back (Original Step)"
    },

    // --- Final Retrieval Steps ---
    // Retrieve the test cookie added at the beginning.
    {
      "type": "manageCookies",
      "action": "get", // Action: Get cookies.
      "name": "myTestCookie", // Filter by name.
      "contextKey": "retrievedTestCookie", // Store the result in context.
      "description": "Get the test cookie we added earlier (Original Step)"
    },
    // Retrieve the test item set in localStorage at the beginning.
    {
      "type": "manageStorage",
      "storageType": "local",
      "action": "getItem", // Action: Get item.
      "key": "myTestData", // Key of the item.
      "contextKey": "retrievedTestData", // Store the result (JSON parsed) in context.
      "description": "Get the test item from localStorage (Original Step)"
    }
  ],

  // Global options for the navigation engine.
  "options": {
    "timeout": 20000, // Default timeout for steps in ms.
    "screenshots": false, // Disable screenshots.
    "screenshotsPath": "./screenshots/herokuapp-full-test" // Path if screenshots were enabled.
  },

  // Variables that can be used within steps using {{variableName}}.
  "variables": {
    "username": "tomsmith", // Username for login.
    "password": "SuperSecretPassword!", // Password for login.
    "text": "Hello from inside the iframe!" // Text for iframe input.
  }
}
```
