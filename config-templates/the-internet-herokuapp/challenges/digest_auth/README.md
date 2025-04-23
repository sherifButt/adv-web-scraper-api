---
title: Digest Authentication
path: config.json
description: Attempts to navigate to a page protected by HTTP Digest Authentication. Currently marked as optional as direct handling is not supported by the `goto` step.
tags: ["Navigation", "Authentication", "HTTP Digest Auth", "Goto", "Optional Step"]
difficulty: Advanced
related_steps: ["goto"]
---

# Challenge: Digest Authentication

This challenge involves accessing a page protected by HTTP Digest Authentication, a more secure challenge-response mechanism than Basic Auth. The required username and password are `admin`.

## Approach

Handling HTTP Digest Authentication typically requires intercepting the initial `401 Unauthorized` response, parsing the `WWW-Authenticate` header (containing nonce, realm, etc.), constructing the correct `Authorization` header with calculated responses, and retrying the request.

Currently, the `adv-web-scraper-api`'s `goto` step does not have built-in support for this complex flow. Embedding credentials in the URL (like `https://admin:admin@...`) does **not** work for Digest Auth.

Therefore, the `config.json` for this challenge simply attempts to navigate to the page:

1.  **`goto`**: Navigates to the `/digest_auth` page. This step is marked as `optional: true` because it is expected to fail with an authentication error (likely a 401 status code) without proper Digest Auth handling.

## Configuration (`config.json`)

(See the `config.json` file in this directory)

## Expected Outcome

The navigation flow will log a warning or error when the `goto` step fails due to the authentication requirement, but because the step is marked `optional`, the overall flow will still complete successfully. No data is extracted.

**Note:** Implementing full Digest Auth support would require enhancing the `goto` handler or creating a dedicated authentication step handler within the `adv-web-scraper-api` core.
