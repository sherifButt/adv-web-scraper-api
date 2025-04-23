# Template API Documentation

The Template API provides endpoints to discover and retrieve pre-defined configuration templates stored within the `config-templates` directory. These templates serve as examples and starting points for various scraping challenges.

Templates are organized by site and challenge: `config-templates/<site_name>/challenges/<challenge_name>/`. Each challenge directory is expected to contain:

- `README.md`: Contains YAML front matter with metadata (title, description, tags, etc.) and a description of the challenge.
- `config.json`: The actual scraping configuration file for the challenge.

## Endpoints

### List Templates

Retrieves a list of available configuration templates, optionally filtered by site or tag.

- **URL**: `/api/v1/templates`
- **Method**: `GET`
- **Query Parameters**:
  - `site` (optional, string): Filter templates by the site name (e.g., `the-internet-herokuapp`).
  - `tag` (optional, string): Filter templates by a specific tag (case-insensitive).
  - `difficulty` (optional, string): Filter templates by difficulty level (e.g., `Beginner`, `Intermediate`, `Advanced`, `Expert`).
  - `related_step` (optional, string): Filter templates by a specific related step (e.g., `goto`, `extract`, `click`).
  - `page` (optional, number): The page number to retrieve (1-based).
  - `limit` (optional, number): The maximum number of templates to return per page.
- **Success Response**:
  - **Code**: `200 OK`
  - **Content**: `Array<TemplateSummary>`
  
  ```json
    [
      {
        "site": "the-internet-herokuapp",
        "challenge": "basic_auth",
        "metadata": {
          "title": "Basic Authentication",
          "path": "config.json", // Path relative to challenge dir
          "description": "Demonstrates handling HTTP Basic Authentication...",
          "tags": ["Navigation", "Authentication", "HTTP Basic Auth"],
          "difficulty": "Beginner",
          "related_steps": ["goto", "wait", "extract"]
        },
        "configPath": "config-templates/the-internet-herokuapp/challenges/basic_auth/config.json" // Path relative to project root
      }
      // ... more templates
    ]
    ```

- **Error Response**:
  - **Code**: `500 Internal Server Error` (If scanning fails)

### Get Single Template Details

Retrieves the full details for a specific template, including the content of its `config.json` file.

- **URL**: `/api/v1/templates/:site/:challenge`
- **Method**: `GET`
- **URL Parameters**:
  - `site` (required, string): The name of the site directory.
  - `challenge` (required, string): The name of the challenge directory.
- **Success Response**:
  - **Code**: `200 OK`
  - **Content**: `DetailedTemplate`
  
    ```json
    {
      "site": "the-internet-herokuapp",
      "challenge": "basic_auth",
      "metadata": {
        "title": "Basic Authentication",
        "path": "config.json",
        "description": "Demonstrates handling HTTP Basic Authentication...",
        "tags": ["Navigation", "Authentication", "HTTP Basic Auth"],
        "difficulty": "Beginner",
        "related_steps": ["goto", "wait", "extract"]
      },
      "configPath": "config-templates/the-internet-herokuapp/challenges/basic_auth/config.json",
      "configContent": {
        // Parsed content of the config.json file
        "steps": [
          { "type": "goto", "url": "https://the-internet.herokuapp.com/basic_auth" },
          { "type": "wait", "selector": "body" },
          {
            "type": "extract",
            "fields": {
              "message": { "selector": ".example p" }
            }
          }
        ]
      }
    }
    ```

- **Error Response**:
  - **Code**: `404 Not Found` (If the specified template doesn't exist or its config file is missing/invalid)
  - **Code**: `500 Internal Server Error` (If reading/parsing fails unexpectedly)

## Metadata Schema (`README.md` Front Matter)

The YAML front matter in each challenge's `README.md` should adhere to the following structure:

```yaml
---
title: string (required) - Human-readable title for the challenge.
path: string (required) - The filename of the config JSON (e.g., "config.json"). Must end with .json.
description: string (required) - A brief description of the challenge or template purpose.
tags: string[] (required) - An array of relevant tags (e.g., ["Login", "Pagination", "JavaScript"]). Must have at least one tag.
difficulty: string (optional) - Estimated difficulty ('Beginner', 'Intermediate', 'Advanced', 'Expert').
related_steps: string[] (optional) - Array of relevant step types used in the config (e.g., ["goto", "click", "extract"]).
---
Markdown content explaining the challenge and the template follows here...
```

The `TemplateService` validates this metadata using a Zod schema. Templates with invalid or missing required metadata will be skipped and logged during the scan.
