# The Internet (Herokuapp) - Configuration Templates

This directory contains example navigation configuration files for the website [https://the-internet.herokuapp.com/](https://the-internet.herokuapp.com/). This site provides a safe environment to practice web scraping and automation against various common web elements and scenarios.

## Challenge-Based Structure

The configurations are organized into individual challenges within the `challenges/` subdirectory. Each challenge folder corresponds to a specific example page on the-internet.herokuapp.com and contains:

-   **`README.md`**: Explains the specific challenge, the approach taken in the configuration, expected outcomes, and relevant metadata (title, description, tags).
-   **`config.json`**: A focused navigation configuration (`steps` array) demonstrating how to interact with and potentially extract data from that specific challenge page.
-   **`test.js`**: A simple test script (using Node.js and the `adv-web-scraper-api` library) to execute the corresponding `config.json`.

This structure allows for modular, focused examples that are easy to understand, test, and adapt.

## Challenge Index

*(This index will be populated with details from each challenge's README.md once they are created.)*

## Running Tests

Each challenge folder contains a `test.js` file. To run a specific test:

1.  Ensure you have Node.js installed.
2.  Navigate to the root directory of the `adv-web-scraper-api` project in your terminal.
3.  Run the test using Node:
    ```bash
    node config-templates/the-internet-herokuapp/challenges/<challenge_folder_name>/test.js
    ```
    (Replace `<challenge_folder_name>` with the actual folder name, e.g., `add_remove_elements`).

*(Note: The original, simpler config files like `the-internet-herokuapp-config.json` and `test-the-internet-herokuapp-config.js` may be removed once the challenge-based structure is fully populated.)*
