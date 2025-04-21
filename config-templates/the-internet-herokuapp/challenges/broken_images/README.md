---
title: Broken Images
path: broken_images/config.json
description: Navigates to a page with broken images and extracts the `src` attribute of all images, demonstrating handling of potentially missing resources.
tags: ["Navigation", "Images", "Extraction", "Error Handling"]
difficulty: Easy
related_steps: ["goto", "extract"]
---

# Challenge: Broken Images

This challenge involves navigating to a page that intentionally includes broken image links. The goal is to extract information about all images, including the broken ones.

## Approach

The `config.json` for this challenge performs the following:

1.  **`goto`**: Navigates to the `/broken_images` page.
2.  **`extract`**: Extracts the `src` attribute from all `<img>` elements found on the page. This demonstrates that the extraction process continues even if the resources linked (the images) are broken.

## Configuration (`config.json`)

(See the `config.json` file in this directory)

## Expected Outcome

The navigation flow should complete successfully. The `result` object in the final output should contain a `brokenImagesInfo` field, which is an array of objects, each containing the `src` attribute of an image found on the page. This list will include the URLs of both working and broken images.
