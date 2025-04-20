# Configuration Templates for Advanced Web Scraper API

This directory contains a collection of example JSON configuration files for the Advanced Web Scraper API. These templates demonstrate various features and scraping strategies for different websites.

## Purpose

- **Examples:** Provide practical examples of how to structure scraping configurations.
- **Starting Points:** Serve as a base for creating your own custom configurations.
- **Feature Showcase:** Demonstrate different step types, selectors, extraction methods, and other API features.
- **Reference:** Offer quick references for common scraping patterns.

## How to Use

1.  **Browse:** Navigate into the subdirectory corresponding to the website you are interested in (e.g., `rightmove/`, `googlemaps/`).
2.  **Review:** Examine the `config.json` (and any other relevant JSON files) to understand the scraping logic. Check the `README.md` within the subdirectory (if present) for specific explanations.
3.  **Copy & Adapt:** Copy the template JSON file(s) to your own workspace.
4.  **Modify:** Edit the configuration to suit your specific data extraction needs. Adjust selectors, steps, variables, and options as required.
5.  **Execute:** Use the modified configuration with the Advanced Web Scraper API endpoints (e.g., `/api/v1/navigate` or `/api/v1/scrape`).

## Contributing

If you develop a useful configuration for a new website or improve an existing one, consider contributing it back to this library. (Details TBD)

## Available Templates

*   `gassaferegister/`: Example for Gas Safe Register.
*   `googlemaps/`: Examples for Google Maps (including session handling).
*   `googletrendingnow/`: Examples for Google Trending Now.
*   `rightmove/`: Example for Rightmove property listings.
*   `the-internet-herokuapp/`: Examples for various scenarios on the-internet.herokuapp.com.
*   `zoopla/`: Example for Zoopla property listings.

*(More templates may be added over time)*
