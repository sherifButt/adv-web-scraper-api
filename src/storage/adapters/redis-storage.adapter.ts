// src/storage/adapters/redis-storage.adapter.ts

import { createClient, RedisClientType } from 'redis';
import { ExtractionResult } from '../../types/extraction.types.js';
import { StorageAdapter, StorageAdapterOptions } from './storage-adapter.interface.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

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
  keyPrefix?: string;

  /**
   * Expiration time in seconds (0 for no expiration)
   * @default 0
   */
  expireTime?: number;
}

/**
 * Redis storage adapter
 * Stores extraction results in Redis
 */
export class RedisStorageAdapter implements StorageAdapter {
  private host: string;
  private port: number;
  private password?: string;
  private db: number;
  private keyPrefix: string;
  private expireTime: number;
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
    this.keyPrefix = options.keyPrefix || 'extraction:';
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
      this.client.on('error', (err) => {
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
   * Store an extraction result
   * @param result The extraction result to store
   * @returns The ID of the stored result
   */
  public async store(result: ExtractionResult): Promise<string> {
    try {
      if (!this.client) {
        throw new Error('Redis storage adapter not initialized');
      }

      const key = this.getKey(result.id);
      const value = JSON.stringify(result);

      // Store the result
      await this.client.set(key, value);

      // Set expiration if configured
      if (this.expireTime > 0) {
        await this.client.expire(key, this.expireTime);
      }

      // Store the ID in a set for listing
      await this.client.sAdd('extraction:ids', result.id);

      // Store indexes for filtering
      await this.client.sAdd(`extraction:status:${result.status}`, result.id);
      await this.client.sAdd(`extraction:url:${this.normalizeUrl(result.url)}`, result.id);
      await this.client.zAdd('extraction:timestamp', {
        score: new Date(result.timestamp).getTime(),
        value: result.id,
      });

      logger.debug(`Stored extraction result with ID: ${result.id} in Redis`);
      return result.id;
    } catch (error: any) {
      logger.error(`Error storing extraction result in Redis: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retrieve an extraction result by ID
   * @param id The ID of the extraction result to retrieve
   * @returns The extraction result or null if not found
   */
  public async retrieve(id: string): Promise<ExtractionResult | null> {
    try {
      if (!this.client) {
        throw new Error('Redis storage adapter not initialized');
      }

      const key = this.getKey(id);
      const value = await this.client.get(key);

      if (value) {
        const result = JSON.parse(value) as ExtractionResult;
        logger.debug(`Retrieved extraction result with ID: ${id} from Redis`);
        return result;
      } else {
        logger.debug(`Extraction result with ID: ${id} not found in Redis`);
        return null;
      }
    } catch (error: any) {
      logger.error(`Error retrieving extraction result from Redis: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update an existing extraction result
   * @param id The ID of the extraction result to update
   * @param result The updated extraction result
   * @returns True if the update was successful, false otherwise
   */
  public async update(id: string, result: Partial<ExtractionResult>): Promise<boolean> {
    try {
      if (!this.client) {
        throw new Error('Redis storage adapter not initialized');
      }

      const key = this.getKey(id);
      const existingValue = await this.client.get(key);

      if (!existingValue) {
        logger.debug(`Extraction result with ID: ${id} not found in Redis for update`);
        return false;
      }

      const existingResult = JSON.parse(existingValue) as ExtractionResult;
      const updatedResult = { ...existingResult, ...result };

      // If status changed, update the status index
      if (result.status && result.status !== existingResult.status) {
        await this.client.sRem(`extraction:status:${existingResult.status}`, id);
        await this.client.sAdd(`extraction:status:${result.status}`, id);
      }

      // If URL changed, update the URL index
      if (result.url && result.url !== existingResult.url) {
        await this.client.sRem(`extraction:url:${this.normalizeUrl(existingResult.url)}`, id);
        await this.client.sAdd(`extraction:url:${this.normalizeUrl(result.url)}`, id);
      }

      // If timestamp changed, update the timestamp index
      if (result.timestamp && result.timestamp !== existingResult.timestamp) {
        await this.client.zRem('extraction:timestamp', id);
        await this.client.zAdd('extraction:timestamp', {
          score: new Date(result.timestamp).getTime(),
          value: id,
        });
      }

      // Store the updated result
      await this.client.set(key, JSON.stringify(updatedResult));

      // Reset expiration if configured
      if (this.expireTime > 0) {
        await this.client.expire(key, this.expireTime);
      }

      logger.debug(`Updated extraction result with ID: ${id} in Redis`);
      return true;
    } catch (error: any) {
      logger.error(`Error updating extraction result in Redis: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete an extraction result by ID
   * @param id The ID of the extraction result to delete
   * @returns True if the deletion was successful, false otherwise
   */
  public async delete(id: string): Promise<boolean> {
    try {
      if (!this.client) {
        throw new Error('Redis storage adapter not initialized');
      }

      const key = this.getKey(id);
      const existingValue = await this.client.get(key);

      if (!existingValue) {
        logger.debug(`Extraction result with ID: ${id} not found in Redis for deletion`);
        return false;
      }

      const existingResult = JSON.parse(existingValue) as ExtractionResult;

      // Remove from indexes
      await this.client.sRem('extraction:ids', id);
      await this.client.sRem(`extraction:status:${existingResult.status}`, id);
      await this.client.sRem(`extraction:url:${this.normalizeUrl(existingResult.url)}`, id);
      await this.client.zRem('extraction:timestamp', id);

      // Delete the result
      await this.client.del(key);

      logger.debug(`Deleted extraction result with ID: ${id} from Redis`);
      return true;
    } catch (error: any) {
      logger.error(`Error deleting extraction result from Redis: ${error.message}`);
      throw error;
    }
  }

  /**
   * List extraction results with optional filtering and pagination
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

      // Get all IDs
      let ids: string[] = [];

      // Filter by status if provided
      if (options.status) {
        ids = await this.client.sMembers(`extraction:status:${options.status}`);
      } else {
        ids = await this.client.sMembers('extraction:ids');
      }

      // Filter by URL if provided
      if (options.url && ids.length > 0) {
        const urlIds = await this.client.sMembers(`extraction:url:${this.normalizeUrl(options.url)}`);
        ids = ids.filter(id => urlIds.includes(id));
      }

      // Filter by date range if provided
      if ((options.fromDate || options.toDate) && ids.length > 0) {
        const min = options.fromDate ? new Date(options.fromDate).getTime() : '-inf';
        const max = options.toDate ? new Date(options.toDate).getTime() : '+inf';
        
        const rangeIds = await this.client.zRangeByScore('extraction:timestamp', min, max);
        ids = ids.filter(id => rangeIds.includes(id));
      }

      // Sort by timestamp (newest first)
      if (ids.length > 0) {
        const timestampIds = await this.client.zRange('extraction:timestamp', 0, -1, { REV: true });
        ids.sort((a, b) => {
          const indexA = timestampIds.indexOf(a);
          const indexB = timestampIds.indexOf(b);
          return indexA - indexB;
        });
      }

      // Apply pagination
      const offset = options.offset || 0;
      const limit = options.limit || ids.length;
      const paginatedIds = ids.slice(offset, offset + limit);

      // Retrieve results
      const results: ExtractionResult[] = [];
      for (const id of paginatedIds) {
        const result = await this.retrieve(id);
        if (result) {
          results.push(result);
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
   * Get the Redis key for an extraction result
   * @param id The ID of the extraction result
   * @returns The Redis key
   */
  private getKey(id: string): string {
    return `${this.keyPrefix}${id}`;
  }

  /**
   * Normalize a URL for indexing
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
