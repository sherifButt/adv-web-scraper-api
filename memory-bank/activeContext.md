# Active Context: Advanced Web Scraper API

## Current Work Focus

### Session Management Implementation
- Implemented comprehensive session management and cookie handling:
  - Persistent storage of browser sessions for reuse
  - Automatic CAPTCHA bypass for previously solved domains
  - Cookie and localStorage preservation between sessions
  - Session expiration and cleanup mechanisms
  - API endpoints for session management
- This implementation significantly reduces CAPTCHA solving needs when scraping the same website multiple times

### Rightmove Selector Implementation
- Implemented resilient selector patterns for Rightmove property scraping:
  - Wildcard class matching: [class*="partial-name"]
  - Data attribute selectors: [data-test^='propertyCard-']
  - Content-based selectors: :contains('Market')
  - Structural relationships: div:has(>span:contains('£'))
  - Multiple fallback strategies for each field
- These patterns handle dynamic class names while maintaining accuracy

The project is currently in the **initial implementation phase**. We have successfully set up the project structure and implemented the core components of the Advanced Web Scraper API. The primary focus areas are:

1. **Core Component Refinement**
   - Refining the browser automation module
   - Enhancing the human behavior emulation system
   - Improving CAPTCHA detection and solving capabilities
   - Optimizing proxy management and rotation

2. **Data Extraction Development**
   - Implementing the data extraction engine
   - Creating schema-based validation for extracted data
   - Building transformation pipelines for data cleaning
   - Developing storage adapters for different destinations

3. **API Enhancement**
   - Completing the REST API implementation
   - Adding request validation with JSON schema
   - Implementing response formatting and pagination
   - Adding comprehensive error handling and reporting

## Recent Changes

The project has progressed from planning to implementation. Recent activities include:

1. **Proxy System Enhancement**
   - **Switched proxy source from `proxies.txt` to `proxies.json`**: Allows for richer proxy metadata.
   - **Updated `ProxyInfo` type**: Aligned type definition (`src/types/index.ts`) with the structure of `proxies.json`.
   - **Refactored `ProxyManager` (`src/core/proxy/proxy-manager.ts`)**:
     - Modified `loadProxiesFromJsonFile` to parse the new JSON format.
     - Updated internal logic to use `ip` instead of `host` and `protocols` array instead of `type`.
     - Enhanced filtering in `listProxies` and `getProxy` to use new metadata fields.
     - Improved sorting logic in `getProxy` using latency and uptime from JSON.
     - Updated `getProxyStats` to provide more detailed statistics based on JSON data.
     - Refined health checking (`checkProxyHealth`, `checkSingleProxy`).
     - Updated `testProxy`, `rotateProxy`, `validateAllProxies`, `cleanProxyList` to align with new structure.
   - **Updated API Endpoints (`src/api/routes/proxy.routes.ts`)**:
     - Enhanced `/list` endpoint with more filtering options based on JSON fields.
     - Updated `/stats` endpoint to return richer statistics.
     - Modified `/rotate` endpoint to accept more detailed criteria and return richer proxy info.
     - Updated `/clean` endpoint response structure.
   - **Updated Configuration (`src/config/index.ts`)**: Pointed file source to `proxies.json`.
   - **Fixed related errors** in `navigation.routes.ts`.

2. **Project Structure Implementation**
   - Set up TypeScript project with ESM modules
   - Configured ESLint and Prettier for code quality
   - Created directory structure following the planned architecture
   - Implemented type definitions for core components

3. **Core Component Implementation**
   - Implemented browser automation module with Playwright
   - Created human behavior emulation with realistic patterns
   - Developed CAPTCHA detection for multiple CAPTCHA types
   - Built proxy management system with rotation and health checking
   - Implemented initial navigation engine for multi-step flows
   - **Refactored Navigation Engine:** Migrated step execution logic into individual handler classes (Strategy pattern) managed by a `StepHandlerFactory`. This improves modularity and extensibility.

4. **API Implementation**
   - Set up Express.js server with middleware
   - Created API routes for core functionality
   - Implemented navigation routes connected to the navigation engine
   - Implemented error handling middleware
   - Added logging infrastructure
   - Developed configuration management system
   - Connected storage service to API routes for result persistence.
   - Implemented job status endpoint (`/api/v1/jobs/:id`) with logic to retrieve results from storage or fallback to `job.returnvalue`.
   - Added detailed logging to `navigation-worker.ts` and `job.routes.ts` to debug result storage/retrieval issues.
   - Modified `navigation-worker.ts` to explicitly return results.
   - Adjusted `QueueService` to handle worker functions returning values.
   - **Fixed Proxy Integration in Worker**: Updated `navigation-worker.ts` to correctly fetch a proxy from `ProxyManager` (if enabled) and pass it to `BrowserPool` when requesting a browser instance. This ensures navigation jobs use the configured proxies.

5. **AI Configuration Generation (Refactored & Enhanced)**
   - Created types for AI generation requests, options, status, and results (`src/types/ai-generation.types.ts`).
   - Added AI configuration section to main config (`src/config/index.ts`).
   - **Refactored `AiService` (`src/core/ai/ai-service.ts`)**:
     - Separated concerns into distinct modules.
     - Extracted prompt templates (including few-shot examples) into `src/core/ai/prompt-templates/`.
     - Created `AdapterFactory` (`src/core/ai/factories/`) for LLM adapter instantiation.
     - Moved model configuration (costs, provider mapping) to `src/core/ai/config/model-config.ts`.
     - Created `CostCalculator` service (`src/core/ai/services/`) for cost estimation.
     - Removed unused few-shot example constants from `AiService`.
   - **Added Cost Tracking**:
     - Updated `generate-config-worker.ts` to accumulate AI costs and store the final `estimatedCost` with the result.
     - Updated `job.routes.ts` (`GET /api/v1/jobs/:id`) to retrieve and return the `estimatedCost` for completed jobs.
   - **Added Model Cost Placeholder**: Added placeholder costs for `gpt-4.1-mini` in `model-config.ts` to prevent calculation warnings.
   - Implemented `generate-config-worker.ts` (`src/core/queue/`) to handle asynchronous job processing, including the generate-validate-test-fix loop and status updates.
   - Integrated the `config-generation-jobs` queue and worker into `QueueService` (`src/core/queue/queue-service.ts`).
   - Created the `POST /api/v1/ai/generate-config` endpoint (`src/api/routes/ai.routes.ts`).
   - Mounted the AI routes in the main API router (`src/api/routes/index.ts`).

## Next Steps

The immediate next steps for the project are:

1.  **Verify Job Result Retrieval**:
    *   Analyze logs generated after recent changes to confirm if results are being generated, stored, and retrieved correctly.
    *   Address any remaining issues identified in the logs (e.g., storage failures, incorrect data format).

2.  **Worker Implementation (Scraping)**:
    *   Implement the worker process for handling scraping jobs queued via `/api/v1/scrape`.
    *   Ensure scraping results are stored and retrieved similarly to navigation jobs.

3.  **AI Feature Completion**:
    *   Implement actual LLM API calls in adapters (replace placeholder).
    *   Refine prompt engineering for better configuration generation and fixing.
    *   Refine the testing logic and success criteria within `generate-config-worker.ts`.
    *   Add more robust schema validation (Zod) for generated configurations.

4.  **API Completion**:
    *   Add request validation (e.g., using Zod) for all endpoints, including AI generation.
    *   Implement consistent response formatting and pagination.
    *   Add rate limiting.

5.  **Testing and Validation**:
    *   Implement unit tests for `QueueService`, `StorageService`, `AiService`, and worker functions.
    *   Create integration tests for job submission (`/navigate`, `/scrape`, `/ai/generate-config`) and status retrieval (`/jobs/:id`).
    *   Develop end-to-end tests for representative scraping scenarios, including AI generation.

6.  **Documentation**:
    *   Update `docs/api/queue-system.md` with final details on job status response and result retrieval.
    *   Update `techContext.md` with worker implementation details (including AI worker).
    *   Create documentation for the AI configuration generation feature (`docs/ai/README.md` or similar).
    *   Update `docs/README.md` Table of Contents.

## Active Decisions and Considerations

Several key decisions have been implemented, while others are being refined:

1. **Data Extraction Implementation**
   - **Decision**: Strategy pattern for different selector types
   - **Current Status**:
     - CSS, XPath, regex, and function selector strategies implemented
     - Extraction engine with flexible configuration options
     - Schema-based validation for extracted data
     - Transformation pipeline for data cleaning
   - **Refinement Needed**: None - Storage adapters fully implemented

2. **Browser Automation Implementation**
   - **Decision**: Playwright implementation with browser pool
   - **Current Status**:
     - Browser pool management implemented
     - Context isolation working as expected
     - Support for different browser types added
     - Resource management functioning properly
   - **Refinement Needed**: Better error handling for browser crashes

3. **CAPTCHA Solving Implementation**
   - **Decision**: Multi-strategy approach with framework
   - **Current Status**:
     - CAPTCHA detection for multiple types implemented
     - Framework for solving strategies in place
     - Token application working for solved CAPTCHAs
     - Basic solving capabilities implemented
   - **Refinement Needed**: Complete external service integration and audio solving

4. **Human Emulation Implementation**
   - **Decision**: Sophisticated behavior patterns
   - **Current Status**:
     - Bezier curves for mouse movements implemented
     - Variable typing speeds with typos working
     - Natural scrolling behavior functioning
     - Configurable behavior profiles added
   - **Refinement Needed**: More randomization in timing patterns

5. **Proxy Management Implementation**
   - **Decision**: Comprehensive proxy management system using detailed JSON source.
   - **Current Status**:
     - Proxy loading from `proxies.json` implemented.
     - `ProxyManager` refactored to utilize rich metadata (protocols, latency, uptime, etc.).
     - API endpoints (`/list`, `/stats`, `/rotate`, `/test`, `/clean`) updated to leverage new data and functionality.
     - Internal success rate and response time tracking (EMA) implemented.
     - Health checking and proxy rotation logic updated.
     - Session-based proxy assignment working.
   - **Refinement Needed**: Consider adding more proxy sources (API); further refine error recovery and health checking heuristics.

6. **AI Configuration Generation**
   - **Decision**: Use LLM via API call within an asynchronous worker, implement iterative test-and-fix loop. Refactor service for modularity. Track costs.
   - **Current Status**:
     - Backend foundation implemented (types, worker, queue, API endpoint).
     - `AiService` refactored into modular components (prompts, factory, config, calculator).
     - Cost tracking implemented in worker and exposed via job status API.
     - Placeholder costs added for `gpt-4.1-mini`.
     - Few-shot examples integrated into prompt templates.
     - Uses Zod for basic schema validation. Iterative loop logic is in place.
   - **Refinement Needed**: Implement actual LLM API calls in adapters. Improve prompt engineering. Enhance testing logic and success criteria within the worker. Add more detailed Zod schema validation. Update placeholder costs when available.

## Important Patterns and Preferences

The following patterns and preferences have been implemented:

1. **Code Organization**
   - Modular architecture with clear separation of concerns
   - Feature-based directory structure implemented as planned
   - Interface-driven design with dependency injection
   - Strategy pattern for algorithm selection
   - Singleton pattern for resource managers
   - Factory pattern for browser and context creation

2. **Error Handling**
   - Custom error classes for different failure scenarios
   - Retry mechanisms with exponential backoff
   - Detailed logging with context information
   - Graceful degradation for non-critical failures
   - Consistent error response format across the API

3. **Configuration Management**
   - Environment-based configuration with dotenv
   - Type-safe configuration with TypeScript interfaces
   - Sensible defaults with override capabilities
   - Configuration validation on startup

4. **TypeScript Usage**
   - Strong typing for all components
   - Interface-based design for flexibility
   - Generic types for reusable components
   - Type guards for runtime type checking
   - Utility types for common patterns

## Learnings and Project Insights

As implementation has progressed, we've gained several insights:

1. **TypeScript Implementation**
   - TypeScript provides excellent type safety but requires careful interface design
   - Generic types are essential for flexible component interactions
   - Type definitions should be centralized for consistency
   - TypeScript's type system can model complex relationships effectively

2. **Browser Automation Challenges**
   - Browser resource management is more complex than anticipated
   - Playwright offers superior capabilities but requires careful handling
   - Browser fingerprinting is essential for avoiding detection
   - Context isolation is critical for reliable operation

3. **Human Emulation Effectiveness**
   - Bezier curves provide remarkably natural mouse movements
   - Variable timing between actions significantly reduces detection
   - Occasional mistakes in typing make automation less detectable
   - Small pauses for "thinking" improve human-like appearance

4. **Architecture Effectiveness**
   - The modular monolith approach has proven effective for development
   - Clear interfaces between components facilitate independent development
   - Strategy pattern is valuable for components with multiple implementation options
   - Singleton pattern works well for resource managers
   - Factory pattern provides flexibility for creating complex objects

5. **Data Extraction Insights**
   - Strategy pattern works well for different selector types
   - Declarative configuration simplifies complex extraction tasks
   - Type safety is crucial for complex extraction configurations
   - Browser context isolation is important for reliable extraction

6. **AI Integration** (Updated)
   - Prompt engineering is critical for consistent and accurate JSON output from LLMs. Few-shot examples in prompts are helpful.
   - Iterative testing and fixing loops are necessary to handle potential AI errors or suboptimal configurations.
   - Schema validation (like Zod) is essential for verifying AI output structure.
   - Managing state (last config, last error) within the worker job data is crucial for the fixing loop.
   - Separating AI concerns (prompts, adapter logic, cost calculation, configuration) into distinct modules improves maintainability.
   - Tracking AI costs per job provides valuable operational insight.

## Open Questions

As implementation progresses, several questions need to be addressed:

1. **Performance Optimization**
   - How can we further optimize browser resource usage?
   - What caching strategies should be implemented for repeated requests?
   - How can we improve the efficiency of human emulation without sacrificing realism?

2. **CAPTCHA Solving Enhancement**
   - What is the most effective approach for audio CAPTCHA solving?
   - How can we improve token harvesting for reCAPTCHA?
   - What fallback mechanisms should be implemented for solving failures?

3. **Data Extraction Design**
   - ✅ What is the optimal balance between flexibility and ease of use for the extraction API?
     - *Answer: A declarative configuration approach with strong typing provides both flexibility and ease of use*
   - ✅ How should we handle different data formats and structures?
     - *Answer: Support for CSS, XPath, regex, and custom functions covers most use cases*
   - ✅ What validation mechanisms are most appropriate for extracted data?
     - *Answer: Schema-based validation with data type conversion and transformation functions*
   - ✅ What storage adapters should be implemented first?
     - *Answer: Memory, File, MongoDB, Redis, and API endpoint adapters provide a comprehensive solution.*
   - How should we handle pagination for large datasets in storage listing? (Future consideration)

4. **Testing Strategy**
   - What is the most effective approach for testing browser automation? (Needs definition)
   - How can we simulate various CAPTCHA scenarios for testing? (Needs definition)
   - What metrics should we use to evaluate human emulation effectiveness? (Needs definition)
   - How can the AI-generated config testing be made more robust (beyond basic error/data checks)?

5. **Job Result Handling**
   - **Decision**: Retrieve results first from `StorageService`, fallback to `job.returnvalue`.
   - **Status**: Implemented in `/api/v1/jobs/:id`. Logging added to verify flow. Worker now explicitly returns results.
   - **Refinement Needed**: Confirm reliability based on log analysis. Decide on error handling if both methods fail.

6. **AI Generation Refinement**
    - Which LLM provides the best balance of cost and accuracy for config generation? (Ongoing evaluation)
    - How can prompt engineering be improved to handle more complex scraping scenarios? (Needs further refinement)
    - What are the best strategies for evaluating the success of an AI-generated test run? (Needs definition beyond basic checks)
    - When should the placeholder costs for `gpt-4.1-mini` be updated? (Requires monitoring OpenAI pricing)

## Current Blockers

Current implementation challenges include:

1.  **Job Result Reliability**: Need to confirm via logs that results are consistently generated, stored, and retrieved. The `result: null` issue reported by the user needs root cause analysis based on new logs.
2.  **Testing Infrastructure**: Lack of tests makes verifying changes difficult and regression-prone. Unit and integration tests are needed urgently.
3.  **Scraping Worker**: The worker for handling `/api/v1/scrape` jobs is not yet implemented.
4.  **CAPTCHA Solving Completion**: External service integration and advanced techniques are pending.
5.  **AI Service Implementation**: Placeholder logic in LLM adapters needs replacement with actual LLM API calls.
6.  **ESLint/TypeScript Issues**: Minor formatting and type issues still need cleanup (some persistent issues in worker and route files).

*Note: This document will be regularly updated as implementation progresses and new insights emerge.*
