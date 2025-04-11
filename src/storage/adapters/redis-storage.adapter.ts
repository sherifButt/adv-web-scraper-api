// src/storage/adapters/redis-storage.adapter.ts

import { createClient, RedisClientType, SetOptions } from 'redis'; // Import SetOptions
import { ExtractionResult } from '../../types/extraction.types.js';
// Import StorableData and StorageAdapter interface
import {
  StorageAdapter,
  StorageAdapterOptions,
  StorableData,
} from './storage-adapter.interface.js';
// Import SessionData to check type
import { SessionData } from '../../core/session/session-manager.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

// Type guard to check if data is SessionData
function isSessionData(data: StorableData): data is SessionData {
  // Basic check, might need refinement based on actual SessionData structure
  return 'domain' in data && 'cookies' in data && 'expiresAt' in data;
}

// Type guard to check if data is ExtractionResult
function isExtractionResult(data: StorableData): data is ExtractionResult {
  // Basic check, might need refinement based on actual ExtractionResult structure
  return 'status' in data && 'url' in data && 'timestamp' in data;
}

/**
 * Redis storage adapter options
 */
export interface RedisStorageOptions extends StorageAdapterOptions {
  /**
   * Redis host
   * @default config.redis.host
   */
  host?: string;

  /**
   * Redis port
   * @default config.redis.port
   */
  port?: number;

  /**
   * Redis password
   */
  password?: string;

  /**
   * Redis database index
   * @default 0
   */
  db?: number;

  /**
   * Key prefix for extraction results
   * @default 'extraction:'
   */
  keyPrefix?: string; // Keep for backward compatibility / extraction default

  /**
   * Expiration time in seconds (0 for no expiration) - Used for extractions if TTL not passed to store
   * @default 0
   */
  expireTime?: number;

  /**
   * Key prefix for session data
   * @default 'session:'
   */
  sessionKeyPrefix?: string;
}

/**
 * Redis storage adapter
 * Stores extraction results and session data in Redis
 */
export class RedisStorageAdapter implements StorageAdapter {
  private host: string;
  private port: number;
  private password?: string;
  private db: number;
  private extractionKeyPrefix: string; // Renamed for clarity
  private sessionKeyPrefix: string;
  private expireTime: number; // Default expire time in seconds for extractions if TTL not provided
  private client: RedisClientType | null = null;

  /**
   * Create a new Redis storage adapter
   * @param options Options for the Redis storage adapter
   */
  constructor(options: RedisStorageOptions = {}) {
    this.host = options.host || config.redis.host;
    this.port = options.port || config.redis.port;
    this.password = options.password;
    this.db = options.db || 0;
    // Default prefixes
    this.extractionKeyPrefix = options.keyPrefix || 'extraction:';
    this.sessionKeyPrefix = options.sessionKeyPrefix || 'session:';
    // Default expire time for extractions (remains in seconds)
    this.expireTime = options.expireTime || 0;

    logger.info(`Redis storage adapter created with host: ${this.host}, port: ${this.port}`);
  }

  /**
   * Initialize the Redis storage adapter
   * Connects to Redis
   */
  public async initialize(): Promise<void> {
    try {
      const url = `redis://${this.host}:${this.port}`;

      this.client = createClient({
        url,
        password: this.password,
        database: this.db,
      });

      // Set up event handlers
      this.client.on('error', err => {
        logger.error(`Redis client error: ${err}`);
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected');
      });

      this.client.on('reconnecting', () => {
        logger.info('Redis client reconnecting');
      });

      // Connect to Redis
      await this.client.connect();

      logger.info(`Redis storage adapter initialized with database: ${this.db}`);
    } catch (error: any) {
      logger.error(`Error initializing Redis storage adapter: ${error.message}`);
      throw error;
    }
  }

  /**
   * Store data (ExtractionResult or SessionData)
   * @param data The data to store
   * @param ttl Optional Time-to-Live in milliseconds
   * @returns The ID of the stored data
   */
  public async store(data: StorableData, ttl?: number): Promise<string> {
    try {
      if (!this.client) {
        throw new Error('Redis storage adapter not initialized');
      }

      const key = this.getKey(data); // Determine key based on data type
      const value = JSON.stringify(data);
      const options: SetOptions = {};

      // Use PX for milliseconds TTL if provided
      if (ttl && ttl > 0) {
        options.PX = ttl;
      }

      // Store the data with optional TTL
      await this.client.set(key, value, options);

      // Handle extraction-specific indexing and default expiration
      if (isExtractionResult(data)) {
        // Set default expiration only if TTL wasn't provided via parameter
        if (!ttl && this.expireTime > 0) {
          await this.client.expire(key, this.expireTime); // expireTime is in seconds
        }
        // Store the ID in a set for listing extractions
        await this.client.sAdd(`${this.extractionKeyPrefix}ids`, data.id);
        // Store indexes for filtering extractions
        await this.client.sAdd(`${this.extractionKeyPrefix}status:${data.status}`, data.id);
        await this.client.sAdd(
          `${this.extractionKeyPrefix}url:${this.normalizeUrl(data.url)}`,
          data.id
        );
        // Use getTime() which returns milliseconds, compatible with Redis scores
        const score = new Date(data.timestamp).getTime();
        if (!isNaN(score)) {
          // Prevent NaN scores
          await this.client.zAdd(`${this.extractionKeyPrefix}timestamp`, {
            score: score,
            value: data.id,
          });
        } else {
          logger.warn(`Invalid timestamp for extraction result ${data.id}: ${data.timestamp}`);
        }
        logger.debug(`Stored extraction result with ID: ${data.id} in Redis`);
      } else if (isSessionData(data)) {
        logger.debug(`Stored session data with ID: ${data.id} in Redis`);
        // Potentially add session-specific indexing here if needed later
      } else {
        logger.warn(`Stored unknown data type with ID: ${data.id} in Redis`);
      }

      return data.id;
    } catch (error: any) {
      // Log specific error for float issue
      if (error instanceof Error && error.message.includes('ERR value is not a valid float')) {
        logger.error(
          `Redis float error storing data ID ${data.id}. Data: ${JSON.stringify(data)}`,
          error
        );
      } else {
        logger.error(
          `Error storing data in Redis (ID: ${data.id}): ${
            error instanceof Error ? error.message : error
          }`
        );
      }
      throw error;
    }
  }

  /**
   * Retrieve data by ID
   * @param id The ID of the data to retrieve
   * @returns The data object or null if not found
   */
  public async retrieve(id: string): Promise<StorableData | null> {
    try {
      if (!this.client) {
        throw new Error('Redis storage adapter not initialized');
      }

      // Determine key prefix based on ID structure (assuming 'session_' prefix for sessions)
      const key = this.getKeyById(id);

      const value = await this.client.get(key);

      if (value) {
        // Parse as generic StorableData first
        const result = JSON.parse(value) as StorableData;
        logger.debug(`Retrieved data with ID: ${id} from Redis`);
        return result;
      } else {
        logger.debug(`Data with ID: ${id} not found in Redis`);
        return null;
      }
    } catch (error: any) {
      logger.error(`Error retrieving data from Redis (ID: ${id}): ${error.message}`);
      throw error;
    }
  }

  /**
   * Update existing data
   * @param id The ID of the data to update
   * @param data The partial data object with updates
   * @returns True if the update was successful, false otherwise
   */
  public async update(id: string, data: Partial<StorableData>): Promise<boolean> {
    try {
      if (!this.client) {
        throw new Error('Redis storage adapter not initialized');
      }

      const key = this.getKeyById(id); // Helper to get key based on ID prefix
      const existingValue = await this.client.get(key);

      if (!existingValue) {
        logger.debug(`Data with ID: ${id} not found in Redis for update`);
        return false;
      }

      const existingData = JSON.parse(existingValue) as StorableData;
      // Ensure ID from the original object is preserved, not overwritten by partial data if 'id' is present there
      const updatedData = { ...existingData, ...data, id: existingData.id };

      // Handle extraction-specific index updates
      if (isExtractionResult(existingData) && isExtractionResult(updatedData)) {
        const existingResult = existingData; // Alias for clarity
        const updatedResult = updatedData; // Alias for clarity

        // If status changed, update the status index
        if (data.status && data.status !== existingResult.status) {
          await this.client.sRem(`${this.extractionKeyPrefix}status:${existingResult.status}`, id);
          await this.client.sAdd(`${this.extractionKeyPrefix}status:${updatedResult.status}`, id);
        }

        // If URL changed, update the URL index
        if (data.url && data.url !== existingResult.url) {
          await this.client.sRem(
            `${this.extractionKeyPrefix}url:${this.normalizeUrl(existingResult.url)}`,
            id
          );
          await this.client.sAdd(
            `${this.extractionKeyPrefix}url:${this.normalizeUrl(updatedResult.url)}`,
            id
          );
        }

        // If timestamp changed, update the timestamp index
        if (data.timestamp && data.timestamp !== existingResult.timestamp) {
          const score = new Date(updatedResult.timestamp).getTime();
          if (!isNaN(score)) {
            // Prevent NaN scores
            await this.client.zRem(`${this.extractionKeyPrefix}timestamp`, id);
            await this.client.zAdd(`${this.extractionKeyPrefix}timestamp`, {
              score: score,
              value: id,
            });
          } else {
            logger.warn(
              `Invalid updated timestamp for extraction result ${id}: ${updatedResult.timestamp}`
            );
          }
        }
      }
      // Add similar logic for session index updates if needed later

      // Store the updated result (Note: TTL is not automatically re-applied here)
      // If TTL needs to be preserved/updated, retrieve TTL before SET or pass TTL to update
      await this.client.set(key, JSON.stringify(updatedData));

      // Optionally re-apply expiration if it's an extraction result and had a default expireTime
      if (isExtractionResult(updatedData) && this.expireTime > 0) {
        await this.client.expire(key, this.expireTime);
      }

      logger.debug(`Updated data with ID: ${id} in Redis`);
      return true;
    } catch (error: any) {
      logger.error(`Error updating data in Redis (ID: ${id}): ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete data by ID
   * @param id The ID of the data to delete
   * @returns True if the deletion was successful, false otherwise
   */
  public async delete(id: string): Promise<boolean> {
    try {
      if (!this.client) {
        throw new Error('Redis storage adapter not initialized');
      }

      const key = this.getKeyById(id); // Helper to get key based on ID prefix
      const existingValue = await this.client.get(key);

      if (!existingValue) {
        logger.debug(`Data with ID: ${id} not found in Redis for deletion`);
        return false;
      }

      // Check type to remove from correct indexes
      const existingData = JSON.parse(existingValue) as StorableData;
      if (isExtractionResult(existingData)) {
        // Remove from extraction indexes
        await this.client.sRem(`${this.extractionKeyPrefix}ids`, id);
        await this.client.sRem(`${this.extractionKeyPrefix}status:${existingData.status}`, id);
        await this.client.sRem(
          `${this.extractionKeyPrefix}url:${this.normalizeUrl(existingData.url)}`,
          id
        );
        await this.client.zRem(`${this.extractionKeyPrefix}timestamp`, id);
      }
      // Add similar logic for session indexes if created later

      // Delete the main data key
      const deletedCount = await this.client.del(key);

      if (deletedCount > 0) {
        logger.debug(`Deleted data with ID: ${id} from Redis`);
        return true;
      } else {
        // Should not happen if existingValue was found, but handle defensively
        logger.warn(`DEL command returned 0 for key ${key} which should have existed.`);
        return false;
      }
    } catch (error: any) {
      logger.error(`Error deleting data from Redis (ID: ${id}): ${error.message}`);
      throw error;
    }
  }

  /**
   * List extraction results with optional filtering and pagination
   * (Remains specific to ExtractionResult as per interface)
   * @param options Options for filtering and pagination
   * @returns An array of extraction results
   */
  public async list(
    options: {
      limit?: number;
      offset?: number;
      status?: string;
      url?: string;
      fromDate?: Date;
      toDate?: Date;
    } = {}
  ): Promise<ExtractionResult[]> {
    try {
      if (!this.client) {
        throw new Error('Redis storage adapter not initialized');
      }

      const prefix = this.extractionKeyPrefix; // Use extraction prefix

      // Get all IDs from the extraction set
      let ids: string[] = [];

      // Filter by status if provided
      if (options.status) {
        ids = await this.client.sMembers(`${prefix}status:${options.status}`);
      } else {
        ids = await this.client.sMembers(`${prefix}ids`);
      }

      // Filter by URL if provided
      if (options.url && ids.length > 0) {
        const urlIds = await this.client.sMembers(`${prefix}url:${this.normalizeUrl(options.url)}`);
        ids = ids.filter(id => urlIds.includes(id));
      }

      // Filter by date range if provided
      if ((options.fromDate || options.toDate) && ids.length > 0) {
        const min = options.fromDate ? new Date(options.fromDate).getTime() : '-inf';
        const max = options.toDate ? new Date(options.toDate).getTime() : '+inf';

        const rangeIds = await this.client.zRangeByScore(`${prefix}timestamp`, min, max);
        ids = ids.filter(id => rangeIds.includes(id));
      }

      // Sort by timestamp (newest first)
      if (ids.length > 0) {
        const timestampIds = await this.client.zRange(`${prefix}timestamp`, 0, -1, { REV: true });
        // Filter ids to only include those present in the timestamp sorted set
        const existingIds = ids.filter(id => timestampIds.includes(id));
        existingIds.sort((a, b) => {
          const indexA = timestampIds.indexOf(a);
          const indexB = timestampIds.indexOf(b);
          // Handle cases where an ID might be missing from the timestamp set unexpectedly
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
        ids = existingIds;
      }

      // Apply pagination
      const offset = options.offset || 0;
      const limit = options.limit || ids.length;
      const paginatedIds = ids.slice(offset, offset + limit);

      // Retrieve results
      const results: ExtractionResult[] = [];
      for (const id of paginatedIds) {
        // Retrieve as StorableData first
        const resultData = await this.retrieve(id);
        // Ensure it's actually an ExtractionResult before adding
        if (resultData && isExtractionResult(resultData)) {
          results.push(resultData);
        } else if (resultData) {
          logger.warn(
            `Retrieved data with ID ${id} during list, but it was not an ExtractionResult.`
          );
        }
      }

      logger.debug(`Listed ${results.length} extraction results from Redis`);
      return results;
    } catch (error: any) {
      logger.error(`Error listing extraction results from Redis: ${error.message}`);
      throw error;
    }
  }

  /**
   * Close the Redis storage adapter
   * Disconnects from Redis
   */
  public async close(): Promise<void> {
    try {
      if (this.client) {
        await this.client.quit();
        this.client = null;
        logger.info('Redis storage adapter closed');
      }
    } catch (error: any) {
      logger.error(`Error closing Redis storage adapter: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get the Redis key based on the data type
   * @param data The data object
   * @returns The Redis key
   */
  private getKey(data: StorableData): string {
    if (isSessionData(data)) {
      // Ensure session IDs start with 'session_' for getKeyById consistency
      const id = data.id.startsWith('session_') ? data.id : `session_${data.id}`;
      return `${this.sessionKeyPrefix}${id}`;
    } else if (isExtractionResult(data)) {
      return `${this.extractionKeyPrefix}${data.id}`;
    }
    // Fallback or throw error for unknown types
    logger.warn(`Generating key for unknown data type with ID: ${data.id}`);
    return `unknown:${data.id}`;
  }

  /**
   * Get the Redis key based on the ID prefix
   * @param id The ID string
   * @returns The Redis key
   */
  private getKeyById(id: string): string {
    // Simple check based on common session ID pattern
    if (id.startsWith('session_')) {
      return `${this.sessionKeyPrefix}${id}`;
    }
    // Assume extraction otherwise (might need refinement if IDs aren't distinct)
    return `${this.extractionKeyPrefix}${id}`;
  }

  /**
   * Normalize a URL for indexing (specific to ExtractionResult)
   * @param url The URL to normalize
   * @returns The normalized URL
   */
  private normalizeUrl(url: string): string {
    try {
      // Remove protocol and www
      let normalized = url.replace(/^https?:\/\//, '').replace(/^www\./, '');

      // Remove query parameters and hash
      normalized = normalized.split('?')[0].split('#')[0];

      // Remove trailing slash
      normalized = normalized.replace(/\/$/, '');

      // Convert to lowercase
      normalized = normalized.toLowerCase();

      return normalized;
    } catch (error) {
      return url;
    }
  }
}
