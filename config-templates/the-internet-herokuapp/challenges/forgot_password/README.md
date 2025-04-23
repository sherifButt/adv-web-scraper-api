---
title: Forgot Password
path: config.json
description: Demonstrates filling an email field and submitting a form, simulating a password recovery request.
tags: ["Navigation", "Forms", "Input", "Click"]
difficulty: Beginner
related_steps: ["goto", "input", "click"]
---

# Challenge: Forgot Password

This challenge involves a simple form with an email input and a submit button, typical of a password recovery feature.

## Approach

The `config.json` for this challenge performs the following:

1.  **`goto`**: Navigates to the `/forgot_password` page.
2.  **`input`**: Enters a test email address into the email input field (`#email`).
3.  **`click`**: Clicks the "Retrieve password" button (`#form_submit`).

## Configuration (`config.json`)

(See the `config.json` file in this directory)

## Expected Outcome

The navigation flow should complete successfully after submitting the form. The page typically displays a "Your e-mail's been sent!" message (though this config doesn't explicitly assert it). No specific data is extracted.
