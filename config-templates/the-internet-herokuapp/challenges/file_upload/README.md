---
title: File Upload
path: file_upload/config.json
description: Demonstrates uploading a file using an input element and asserting the uploaded file name appears on the page.
tags: ["Navigation", "Forms", "File Upload", "Input", "Click", "Assert"]
difficulty: Medium
related_steps: ["goto", "uploadFile", "click", "assert"]
---

# Challenge: File Upload

This challenge involves uploading a file using a standard HTML file input element (`<input type="file">`).

## Approach

The `config.json` for this challenge performs the following:

1.  **`goto`**: Navigates to the `/upload` page.
2.  **`uploadFile`**: Selects the file input element (`#file-upload`) and sets its value to the path of the file to be uploaded (`./test-upload.txt`). **Note:** This requires a file named `test-upload.txt` to exist in the root directory of the project (`/Users/sherifbutt/DocumentsLocal/apps/adv-web-scraper-api`) when the test is run.
3.  **`click`**: Clicks the "Upload" button (`#file-submit`).
4.  **`wait`**: Waits for the element displaying the uploaded file name (`#uploaded-files`) to appear.
5.  **`assert`**: Asserts that the text content of the `#uploaded-files` element contains the name of the uploaded file (`test-upload.txt`).

## Configuration (`config.json`)

(See the `config.json` file in this directory)

## Expected Outcome

The navigation flow should complete successfully, demonstrating the file upload process and confirming the uploaded file's name is displayed on the subsequent page.
