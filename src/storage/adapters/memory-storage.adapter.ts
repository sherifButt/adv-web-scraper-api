// src/storage/adapters/memory-storage.adapter.ts

import { ExtractionResult } from '../../types/extraction.types.js';
import { StorageAdapter, StorageAdapterOptions } from './storage-adapter.interface.js';
import { logger } from '../../utils/logger.js';

/**
 * In-memory storage adapter
 * Stores extraction results in memory
 * Note: This is not suitable for production use as data is lost when the server restarts
 */
export class MemoryStorageAdapter implements StorageAdapter {
  private storage: Map<string, ExtractionResult> = new Map();

  /**
   * Create a new memory storage adapter
   * @param options Options for the memory storage adapter
   */
  constructor(private options: StorageAdapterOptions = {}) {
    logger.info('Memory storage adapter created');
  }

  /**
   * Initialize the memory storage adapter
   */
  public async initialize(): Promise<void> {
    logger.info('Memory storage adapter initialized');
    return Promise.resolve();
  }

  /**
   * Store an extraction result
   * @param result The extraction result to store
   * @returns The ID of the stored result
   */
  public async store(result: ExtractionResult): Promise<string> {
    try {
      this.storage.set(result.id, result);
      logger.debug(`Stored extraction result with ID: ${result.id}`);
      return result.id;
    } catch (error: any) {
      logger.error(`Error storing extraction result: ${error.message}`);
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
      const result = this.storage.get(id) || null;
      if (result) {
        logger.debug(`Retrieved extraction result with ID: ${id}`);
      } else {
        logger.debug(`Extraction result with ID: ${id} not found`);
      }
      return result;
    } catch (error: any) {
      logger.error(`Error retrieving extraction result: ${error.message}`);
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
      const existingResult = this.storage.get(id);
      if (!existingResult) {
        logger.debug(`Extraction result with ID: ${id} not found for update`);
        return false;
      }

      const updatedResult = { ...existingResult, ...result };
      this.storage.set(id, updatedResult as ExtractionResult);
      logger.debug(`Updated extraction result with ID: ${id}`);
      return true;
    } catch (error: any) {
      logger.error(`Error updating extraction result: ${error.message}`);
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
      const result = this.storage.delete(id);
      if (result) {
        logger.debug(`Deleted extraction result with ID: ${id}`);
      } else {
        logger.debug(`Extraction result with ID: ${id} not found for deletion`);
      }
      return result;
    } catch (error: any) {
      logger.error(`Error deleting extraction result: ${error.message}`);
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
      let results = Array.from(this.storage.values());

      // Apply filters
      if (options.status) {
        results = results.filter(result => result.status === options.status);
      }

      if (options.url) {
        results = results.filter(result => result.url.includes(options.url || ''));
      }

      if (options.fromDate) {
        results = results.filter(result => {
          const timestamp = new Date(result.timestamp);
          return timestamp >= options.fromDate!;
        });
      }

      if (options.toDate) {
        results = results.filter(result => {
          const timestamp = new Date(result.timestamp);
          return timestamp <= options.toDate!;
        });
      }

      // Sort by timestamp (newest first)
      results.sort((a, b) => {
        const timestampA = new Date(a.timestamp).getTime();
        const timestampB = new Date(b.timestamp).getTime();
        return timestampB - timestampA;
      });

      // Apply pagination
      const offset = options.offset || 0;
      const limit = options.limit || results.length;
      results = results.slice(offset, offset + limit);

      logger.debug(`Listed ${results.length} extraction results`);
      return results;
    } catch (error: any) {
      logger.error(`Error listing extraction results: ${error.message}`);
      throw error;
    }
  }

  /**
   * Close the memory storage adapter
   */
  public async close(): Promise<void> {
    try {
      this.storage.clear();
      logger.info('Memory storage adapter closed');
      return Promise.resolve();
    } catch (error: any) {
      logger.error(`Error closing memory storage adapter: ${error.message}`);
      throw error;
    }
  }
}
