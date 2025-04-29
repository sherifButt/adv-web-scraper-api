---
title: find-a-tradesperson
path: config.json
description: Demonstrates scraping data for find-a-tradesperson on niceic.com
tags: [
"data-extraction",
"table-scraping",
"dynamic-content",
"consent-handling",
"wait-steps",
"session-management",
"basic-navigation"
]
difficulty: Beginner
related_steps: [
"wait",
"press",
"extract",
"click",
"input",
"condition",
"mousemove",
"scroll",
"handleDialog",
"manageCookies"
]
---

#  Configuration Templates

These configurations demonstrate scraping data from the find-a-tradesperson website.

## Files

- `onfig.json`: A standard configuration for scraping find-a-tradesperson on niceic.com search results.

## Prompt

once the page is fully loaded, accept the terms and conditions, extract from  the table (first table)  with columns price, day, month ,year Date

## Features Demonstrated

-   Basic navigation (`goto`, `click`, `click`).
-   Handling dynamic content loading (potentially using `wait` steps).
-   Extracting data from data table.
-   Using session management (`config.json`).


## Usage

Copy the relevant JSON file (`config.json` for basic scraping, `config.json` for session-based scraping) and adapt it for your specific Gold Price Today data extraction needs.
