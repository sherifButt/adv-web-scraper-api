// src/storage/adapters/mongodb-storage.adapter.ts

import { MongoClient, Collection, Db } from 'mongodb';
import { ExtractionResult } from '../../types/extraction.types.js';
import { StorageAdapter, StorageAdapterOptions } from './storage-adapter.interface.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

/**
 * MongoDB storage adapter options
 */
export interface MongoDBStorageOptions extends StorageAdapterOptions {
  /**
   * MongoDB connection URI
   * @default config.mongodb.uri
   */
  uri?: string;

  /**
   * Database name
   * @default 'web-scraper'
   */
  database?: string;

  /**
   * Collection name
   * @default 'extraction-results'
   */
  collection?: string;

  /**
   * Connection options
   */
  options?: any;
}

/**
 * MongoDB storage adapter
 * Stores extraction results in MongoDB
 */
export class MongoDBStorageAdapter implements StorageAdapter {
  private uri: string;
  private database: string;
  private collectionName: string;
  private options: any;
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private collection: Collection | null = null;

  /**
   * Create a new MongoDB storage adapter
   * @param options Options for the MongoDB storage adapter
   */
  constructor(options: MongoDBStorageOptions = {}) {
    this.uri = options.uri || config.mongodb.uri;
    this.database = options.database || 'web-scraper';
    this.collectionName = options.collection || 'extraction-results';
    this.options = options.options || {};

    logger.info(`MongoDB storage adapter created with URI: ${this.uri}`);
  }

  /**
   * Initialize the MongoDB storage adapter
   * Connects to MongoDB and creates the collection if it doesn't exist
   */
  public async initialize(): Promise<void> {
    try {
      this.client = new MongoClient(this.uri, this.options);
      await this.client.connect();
      this.db = this.client.db(this.database);
      this.collection = this.db.collection(this.collectionName);

      // Create indexes for better query performance
      await this.collection.createIndex({ id: 1 }, { unique: true });
      await this.collection.createIndex({ status: 1 });
      await this.collection.createIndex({ url: 1 });
      await this.collection.createIndex({ timestamp: -1 });

      logger.info(
        `MongoDB storage adapter initialized with database: ${this.database}, collection: ${this.collectionName}`
      );
    } catch (error: any) {
      logger.error(`Error initializing MongoDB storage adapter: ${error.message}`);
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
      if (!this.collection) {
        throw new Error('MongoDB storage adapter not initialized');
      }

      // Check if the result already exists
      const existingResult = await this.collection.findOne({ id: result.id });
      if (existingResult) {
        // Update the existing result
        await this.collection.replaceOne({ id: result.id }, result);
        logger.debug(`Updated extraction result with ID: ${result.id} in MongoDB`);
      } else {
        // Insert the new result
        await this.collection.insertOne(result);
        logger.debug(`Stored extraction result with ID: ${result.id} in MongoDB`);
      }

      return result.id;
    } catch (error: any) {
      logger.error(`Error storing extraction result in MongoDB: ${error.message}`);
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
      if (!this.collection) {
        throw new Error('MongoDB storage adapter not initialized');
      }

      const result = await this.collection.findOne<ExtractionResult>({ id });
      if (result) {
        logger.debug(`Retrieved extraction result with ID: ${id} from MongoDB`);
      } else {
        logger.debug(`Extraction result with ID: ${id} not found in MongoDB`);
      }

      return result;
    } catch (error: any) {
      logger.error(`Error retrieving extraction result from MongoDB: ${error.message}`);
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
      if (!this.collection) {
        throw new Error('MongoDB storage adapter not initialized');
      }

      const updateResult = await this.collection.updateOne({ id }, { $set: result });

      if (updateResult.matchedCount > 0) {
        logger.debug(`Updated extraction result with ID: ${id} in MongoDB`);
        return true;
      } else {
        logger.debug(`Extraction result with ID: ${id} not found in MongoDB for update`);
        return false;
      }
    } catch (error: any) {
      logger.error(`Error updating extraction result in MongoDB: ${error.message}`);
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
      if (!this.collection) {
        throw new Error('MongoDB storage adapter not initialized');
      }

      const deleteResult = await this.collection.deleteOne({ id });
      if (deleteResult.deletedCount > 0) {
        logger.debug(`Deleted extraction result with ID: ${id} from MongoDB`);
        return true;
      } else {
        logger.debug(`Extraction result with ID: ${id} not found in MongoDB for deletion`);
        return false;
      }
    } catch (error: any) {
      logger.error(`Error deleting extraction result from MongoDB: ${error.message}`);
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
      if (!this.collection) {
        throw new Error('MongoDB storage adapter not initialized');
      }

      // Build the query
      const query: any = {};

      if (options.status) {
        query.status = options.status;
      }

      if (options.url) {
        query.url = { $regex: options.url, $options: 'i' };
      }

      if (options.fromDate || options.toDate) {
        query.timestamp = {};

        if (options.fromDate) {
          query.timestamp.$gte = options.fromDate.toISOString();
        }

        if (options.toDate) {
          query.timestamp.$lte = options.toDate.toISOString();
        }
      }

      // Execute the query with pagination
      const results = (await this.collection
        .find(query)
        .sort({ timestamp: -1 })
        .skip(options.offset || 0)
        .limit(options.limit || 100)
        .toArray()) as unknown as ExtractionResult[];

      logger.debug(`Listed ${results.length} extraction results from MongoDB`);
      return results;
    } catch (error: any) {
      logger.error(`Error listing extraction results from MongoDB: ${error.message}`);
      throw error;
    }
  }

  /**
   * Close the MongoDB storage adapter
   * Closes the MongoDB connection
   */
  public async close(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close();
        this.client = null;
        this.db = null;
        this.collection = null;
        logger.info('MongoDB storage adapter closed');
      }
    } catch (error: any) {
      logger.error(`Error closing MongoDB storage adapter: ${error.message}`);
      throw error;
    }
  }
}
