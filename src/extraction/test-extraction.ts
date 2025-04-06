// src/extraction/test-extraction.ts

import { ExtractionEngine } from './index.js';
import {
  SelectorType,
  ExtractionConfig,
  CssSelectorConfig,
  XPathSelectorConfig,
  RegexSelectorConfig,
  NestedExtractionConfig,
} from '../types/extraction.types.js';
import { logger } from '../utils/logger.js';

/**
 * Test script for the extraction engine
 * This script demonstrates the usage of the extraction engine with different selector types
 */
async function testExtraction() {
  try {
    logger.info('Starting extraction test');

    // Create an extraction engine instance
    const extractionEngine = new ExtractionEngine();

    // Define the extraction configuration
    const config: ExtractionConfig = {
      url: 'https://news.ycombinator.com/',
      fields: {
        // Extract the title of the page using CSS selector
        title: {
          type: SelectorType.CSS,
          name: 'title',
          selector: 'title',
        } as CssSelectorConfig,
        // Extract the top stories using CSS selector
        stories: {
          selector: '.athing',
          type: SelectorType.CSS,
          multiple: true,
          fields: {
            // Extract the title of each story
            title: {
              type: SelectorType.CSS,
              name: 'title',
              selector: '.titleline > a',
            } as CssSelectorConfig,
            // Extract the URL of each story
            url: {
              type: SelectorType.CSS,
              name: 'url',
              selector: '.titleline > a',
              attribute: 'href',
            } as CssSelectorConfig,
            // Extract the score of each story using XPath
            score: {
              type: SelectorType.XPATH,
              name: 'score',
              selector: 'following-sibling::tr//span[@class="score"]',
            } as XPathSelectorConfig,
            // Extract the age of each story using regex
            age: {
              type: SelectorType.REGEX,
              name: 'age',
              pattern: '(\\d+)\\s+(minute|hour|day|month|year)s?\\s+ago',
              source: 'following-sibling::tr//span[@class="age"]',
            } as RegexSelectorConfig,
          },
        } as NestedExtractionConfig,
      },
      options: {
        timeout: 30000,
        waitForSelector: '.athing',
        javascript: true,
        proxy: false, // Disable proxy usage for the test
      },
    };

    // Execute the extraction
    logger.info('Executing extraction');
    const result = await extractionEngine.extract(config);

    // Log the result
    logger.info(`Extraction completed with ID: ${result.id}`);
    logger.info(`Extracted ${result.stats?.itemsExtracted} items`);
    logger.info(`Title: ${result.data.title}`);
    logger.info(`First story: ${result.data.stories[0].title}`);
    logger.info(`First story URL: ${result.data.stories[0].url}`);
    logger.info(`First story score: ${result.data.stories[0].score}`);
    logger.info(`First story age: ${result.data.stories[0].age}`);

    // Return the result
    return result;
  } catch (error) {
    logger.error(`Error in extraction test: ${error}`);
    throw error;
  }
}

// Run the test if this file is executed directly
if (process.argv[1].includes('test-extraction')) {
  testExtraction()
    .then(result => {
      logger.info('Test completed successfully');
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(error => {
      logger.error(`Test failed: ${error}`);
      process.exit(1);
    });
}

export { testExtraction };
