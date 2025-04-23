// src/storage/storage-service.ts

import { ExtractionResult } from '../types/extraction.types.js';
import { StorageFactory, StorageAdapterType } from './storage-factory.js';
import {
  StorageAdapter,
  StorageAdapterOptions,
  StorableData,
} from './adapters/storage-adapter.interface.js'; // Import StorableData
import { logger } from '../utils/logger.js';

/**
 * Storage service options
 */
export interface StorageServiceOptions {
  /**
   * Primary storage adapter type
   * @default 'memory'
   */
  primaryAdapter?: StorageAdapterType;

  /**
   * Primary storage adapter options
   */
  primaryAdapterOptions?: StorageAdapterOptions;

  /**
   * Backup storage adapter type
   */
  backupAdapter?: StorageAdapterType;

  /**
   * Backup storage adapter options
   */
  backupAdapterOptions?: StorageAdapterOptions;

  /**
   * Whether to use the backup adapter
   * @default false
   */
  useBackup?: boolean;
}

/**
 * Storage service
 * Provides a unified interface for storage operations
 */
export class StorageService {
  private static instance: StorageService;
  private storageFactory: StorageFactory;
  private primaryAdapter: StorageAdapter | null = null;
  private backupAdapter: StorageAdapter | null = null;
  private primaryAdapterType: StorageAdapterType;
  private primaryAdapterOptions: StorageAdapterOptions;
  private backupAdapterType?: StorageAdapterType;
  private backupAdapterOptions?: StorageAdapterOptions;
  private useBackup: boolean;
  private isInitialized = false;

  /**
   * Create a new storage service
   * @param options Storage service options
   */
  private constructor(options: StorageServiceOptions = {}) {
    this.storageFactory = StorageFactory.getInstance();
    this.primaryAdapterType = options.primaryAdapter || 'memory';
    this.primaryAdapterOptions = options.primaryAdapterOptions || {};
    this.backupAdapterType = options.backupAdapter;
    this.backupAdapterOptions = options.backupAdapterOptions;
    this.useBackup = options.useBackup || false;

    logger.info(`Storage service created with primary adapter: ${this.primaryAdapterType}`);
    if (this.useBackup && this.backupAdapterType) {
      logger.info(`Storage service using backup adapter: ${this.backupAdapterType}`);
    }
  }

  /**
   * Get the storage service instance
   * @param options Storage service options
   * @returns The storage service instance
   */
  public static getInstance(options: StorageServiceOptions = {}): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService(options);
      StorageService.instance.initialize();
    }
    return StorageService.instance;
  }

  /**
   * Initialize the storage service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize primary adapter
      this.primaryAdapter = await this.storageFactory.getAdapter(
        this.primaryAdapterType,
        this.primaryAdapterOptions
      );
      logger.info(`Primary storage adapter initialized: ${this.primaryAdapterType}`);

      // Initialize backup adapter if configured
      if (this.useBackup && this.backupAdapterType) {
        this.backupAdapter = await this.storageFactory.getAdapter(
          this.backupAdapterType,
          this.backupAdapterOptions
        );
        logger.info(`Backup storage adapter initialized: ${this.backupAdapterType}`);
      }

      this.isInitialized = true;
    } catch (error: any) {
      logger.error(`Error initializing storage service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Store data
   * @param data The data to store (must have an 'id' property)
   * @param ttl Optional Time-to-Live in milliseconds
   * @returns The ID of the stored data
   */
  public async store(data: StorableData, ttl?: number): Promise<string> {
    try {
      if (!this.primaryAdapter) {
        await this.initialize();
      }

      // Store in primary adapter
      const id = await this.primaryAdapter!.store(data, ttl); // Pass ttl
      logger.debug(`Stored data with ID: ${id} in primary storage`);

      // Store in backup adapter if configured
      if (this.useBackup && this.backupAdapter) {
        try {
          await this.backupAdapter.store(data, ttl); // Pass ttl
          logger.debug(`Stored data with ID: ${id} in backup storage`);
        } catch (error: any) {
          logger.error(`Error storing data in backup storage: ${error.message}`);
          // Continue even if backup storage fails
        }
      }

      return id;
    } catch (error: any) {
      logger.error(`Error storing data: ${error.message}`);
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
      if (!this.primaryAdapter) {
        await this.initialize();
      }

      // Try to retrieve from primary adapter
      let data = await this.primaryAdapter!.retrieve(id);

      // If not found in primary and backup is configured, try backup
      if (!data && this.useBackup && this.backupAdapter) {
        try {
          data = await this.backupAdapter.retrieve(id);

          if (data) {
            logger.debug(`Retrieved data with ID: ${id} from backup storage`);

            // Sync back to primary storage (Note: TTL is not preserved here)
            await this.primaryAdapter!.store(data);
            logger.debug(`Synced data with ID: ${id} from backup to primary storage`);
          }
        } catch (error: any) {
          logger.error(`Error retrieving data from backup storage: ${error.message}`);
          // Continue with null result
        }
      } else if (data) {
        logger.debug(`Retrieved data with ID: ${id} from primary storage`);
      }

      return data;
    } catch (error: any) {
      logger.error(`Error retrieving data: ${error.message}`);
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
      if (!this.primaryAdapter) {
        await this.initialize();
      }

      // Update in primary adapter
      const success = await this.primaryAdapter!.update(id, data);

      if (success) {
        logger.debug(`Updated data with ID: ${id} in primary storage`);

        // Update in backup adapter if configured
        if (this.useBackup && this.backupAdapter) {
          try {
            await this.backupAdapter.update(id, data);
            logger.debug(`Updated data with ID: ${id} in backup storage`);
          } catch (error: any) {
            logger.error(`Error updating data in backup storage: ${error.message}`);
            // Continue even if backup storage fails
          }
        }
      }

      return success;
    } catch (error: any) {
      logger.error(`Error updating data: ${error.message}`);
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
      if (!this.primaryAdapter) {
        await this.initialize();
      }

      // Delete from primary adapter
      const success = await this.primaryAdapter!.delete(id);

      if (success) {
        logger.debug(`Deleted data with ID: ${id} from primary storage`);

        // Delete from backup adapter if configured
        if (this.useBackup && this.backupAdapter) {
          try {
            await this.backupAdapter.delete(id);
            logger.debug(`Deleted data with ID: ${id} from backup storage`);
          } catch (error: any) {
            logger.error(`Error deleting data from backup storage: ${error.message}`);
            // Continue even if backup storage fails
          }
        }
      }

      return success;
    } catch (error: any) {
      logger.error(`Error deleting data: ${error.message}`);
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
      if (!this.primaryAdapter) {
        await this.initialize();
      }

      // List from primary adapter
      const results = await this.primaryAdapter!.list(options);
      logger.debug(`Listed ${results.length} extraction results from primary storage`);

      return results;
    } catch (error: any) {
      logger.error(`Error listing extraction results: ${error.message}`);
      throw error;
    }
  }

  /**
   * Close the storage service
   */
  public async close(): Promise<void> {
    try {
      await this.storageFactory.closeAll();
      this.primaryAdapter = null;
      this.backupAdapter = null;
      logger.info('Storage service closed');
    } catch (error: any) {
      logger.error(`Error closing storage service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Change the primary storage adapter
   * @param type Storage adapter type
   * @param options Storage adapter options
   */
  public async changePrimaryAdapter(
    type: StorageAdapterType,
    options?: StorageAdapterOptions
  ): Promise<void> {
    try {
      // Get the new adapter
      const newAdapter = await this.storageFactory.getAdapter(type, options);

      // If we already have a primary adapter, migrate data
      if (this.primaryAdapter) {
        logger.info(`Migrating data from ${this.primaryAdapterType} to ${type}`);

        // Get all data from current adapter
        const results = await this.primaryAdapter.list();

        // Store all data in new adapter
        for (const result of results) {
          await newAdapter.store(result);
        }

        logger.info(`Migrated ${results.length} extraction results to ${type}`);
      }

      // Update adapter references
      this.primaryAdapterType = type;
      this.primaryAdapterOptions = options || {};
      this.primaryAdapter = newAdapter;

      logger.info(`Changed primary storage adapter to ${type}`);
    } catch (error: any) {
      logger.error(`Error changing primary storage adapter: ${error.message}`);
      throw error;
    }
  }

  /**
   * Change the backup storage adapter
   * @param type Storage adapter type
   * @param options Storage adapter options
   * @param useBackup Whether to use the backup adapter
   */
  public async changeBackupAdapter(
    type: StorageAdapterType,
    options?: StorageAdapterOptions,
    useBackup = true
  ): Promise<void> {
    try {
      if (useBackup) {
        // Get the new adapter
        const newAdapter = await this.storageFactory.getAdapter(type, options);

        // If we already have a primary adapter, sync data
        if (this.primaryAdapter) {
          logger.info(`Syncing data from primary adapter to ${type}`);

          // Get all data from primary adapter
          const results = await this.primaryAdapter.list();

          // Store all data in new adapter
          for (const result of results) {
            await newAdapter.store(result);
          }

          logger.info(`Synced ${results.length} extraction results to ${type}`);
        }

        // Update adapter references
        this.backupAdapterType = type;
        this.backupAdapterOptions = options;
        this.backupAdapter = newAdapter;
        this.useBackup = true;

        logger.info(`Changed backup storage adapter to ${type}`);
      } else {
        // Disable backup adapter
        this.backupAdapter = null;
        this.useBackup = false;

        logger.info('Disabled backup storage adapter');
      }
    } catch (error: any) {
      logger.error(`Error changing backup storage adapter: ${error.message}`);
      throw error;
    }
  }
}
