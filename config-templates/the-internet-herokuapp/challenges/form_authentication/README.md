---
title: Form Authentication (Login)
path: form_authentication/config.json
description: Demonstrates logging into a secure area using username/password fields and a submit button. Uses the dedicated `login` step type.
tags: ["Navigation", "Forms", "Login", "Authentication", "Input", "Click", "Assert"]
difficulty: Easy
related_steps: ["goto", "login", "assert"]
---

# Challenge: Form Authentication (Login)

This challenge involves a standard login form requiring a username and password to access a secure area. The valid credentials are `tomsmith` / `SuperSecretPassword!`.

## Approach

The `config.json` uses the specialized `login` step type for clarity and conciseness:

1.  **`goto`**: Navigates to the `/login` page.
2.  **`login`**:
    *   Identifies the username (`#username`), password (`#password`), and submit (`button[type='submit']`) elements using their selectors.
    *   Provides the username and password values (using variables defined in the config).
    *   Specifies `waitFor: "#flash.success"` to wait for the success message element to appear after submission, confirming successful login. `waitForNavigation` is set to `false` because the success message appears on the same logical page load, just after a redirect.
3.  **`assert`**: Confirms the success message is displayed and contains the expected text.

## Configuration (`config.json`)

(See the `config.json` file in this directory)

## Expected Outcome

The navigation flow should complete successfully, demonstrating a successful login and assertion of the success message.
