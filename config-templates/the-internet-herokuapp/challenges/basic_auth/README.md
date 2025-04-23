---
title: Basic Authentication
path: config.json
description: Demonstrates handling HTTP Basic Authentication by embedding credentials in the URL and extracting the success message.
tags: ["Navigation", "Authentication", "HTTP Basic Auth", "Goto", "Wait", "Extract"]
difficulty: Intermediate
related_steps: ["goto", "wait", "extract"]
---

# Challenge: Basic Authentication

This challenge involves accessing a page protected by HTTP Basic Authentication. The required username and password are `admin`.

## Approach

The `config.json` for this challenge uses the standard method for handling Basic Auth directly via the URL:

1.  **`goto`**: Navigates to the `/basic_auth` page, embedding the credentials (`admin:admin`) directly into the URL (`https://admin:admin@...`). This causes the browser to automatically send the required `Authorization` header.
2.  **`wait`**: Waits for the paragraph element containing the success message (`div.example > p`) to ensure the page has loaded correctly after authentication.
3.  **`extract`**: Extracts the text content of the success message paragraph.

## Configuration (`config.json`)

(See the `config.json` file in this directory)

## Expected Outcome

The navigation flow should complete successfully. The `result` object in the final output should contain a `basicAuthResult` field with the message "Congratulations! You must have the proper credentials." extracted from the page.
