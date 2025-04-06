// src/storage/storage-factory.ts

import { StorageAdapter, StorageAdapterOptions } from './adapters/storage-adapter.interface.js';
import { MemoryStorageAdapter } from './adapters/memory-storage.adapter.js';
import { FileStorageAdapter } from './adapters/file-storage.adapter.js';
import { MongoDBStorageAdapter } from './adapters/mongodb-storage.adapter.js';
import { RedisStorageAdapter } from './adapters/redis-storage.adapter.js';
import { ApiStorageAdapter, ApiStorageOptions } from './adapters/api-storage.adapter.js';
import { logger } from '../utils/logger.js';

/**
 * Storage adapter type
 */
export type StorageAdapterType = 'memory' | 'file' | 'mongodb' | 'redis' | 'api';

/**
 * Storage factory options
 */
export interface StorageFactoryOptions {
  /**
   * Default storage adapter type
   * @default 'memory'
   */
  defaultAdapter?: StorageAdapterType;

  /**
   * Storage adapter options
   */
  adapterOptions?: {
    memory?: StorageAdapterOptions;
    file?: StorageAdapterOptions;
    mongodb?: StorageAdapterOptions;
    redis?: StorageAdapterOptions;
    api?: ApiStorageOptions;
  };
}

/**
 * Storage factory
 * Creates and manages storage adapters
 */
export class StorageFactory {
  private static instance: StorageFactory;
  private defaultAdapter: StorageAdapterType;
  private adapterOptions: StorageFactoryOptions['adapterOptions'];
  private adapters: Map<string, StorageAdapter> = new Map();

  /**
   * Create a new storage factory
   * @param options Storage factory options
   */
  private constructor(options: StorageFactoryOptions = {}) {
    this.defaultAdapter = options.defaultAdapter || 'memory';
    this.adapterOptions = options.adapterOptions || {};
    logger.info(`Storage factory created with default adapter: ${this.defaultAdapter}`);
  }

  /**
   * Get the storage factory instance
   * @param options Storage factory options
   * @returns The storage factory instance
   */
  public static getInstance(options: StorageFactoryOptions = {}): StorageFactory {
    if (!StorageFactory.instance) {
      StorageFactory.instance = new StorageFactory(options);
    }
    return StorageFactory.instance;
  }

  /**
   * Get a storage adapter
   * @param type Storage adapter type
   * @param options Storage adapter options
   * @returns The storage adapter
   */
  public async getAdapter(
    type: StorageAdapterType = this.defaultAdapter,
    options?: StorageAdapterOptions
  ): Promise<StorageAdapter> {
    const adapterKey = `${type}-${JSON.stringify(options || {})}`;

    // Return existing adapter if available
    if (this.adapters.has(adapterKey)) {
      return this.adapters.get(adapterKey)!;
    }

    // Create a new adapter
    let adapter: StorageAdapter;
    const adapterOptions = options || this.adapterOptions?.[type] || {};

    switch (type) {
      case 'memory':
        adapter = new MemoryStorageAdapter(adapterOptions);
        break;
      case 'file':
        adapter = new FileStorageAdapter(adapterOptions);
        break;
      case 'mongodb':
        adapter = new MongoDBStorageAdapter(adapterOptions);
        break;
      case 'redis':
        adapter = new RedisStorageAdapter(adapterOptions);
        break;
      case 'api':
        if (!this.isApiStorageOptions(adapterOptions)) {
          throw new Error('API storage adapter requires baseUrl option');
        }
        adapter = new ApiStorageAdapter(adapterOptions);
        break;
      default:
        throw new Error(`Unknown storage adapter type: ${type}`);
    }

    // Initialize the adapter
    await adapter.initialize();

    // Store the adapter for reuse
    this.adapters.set(adapterKey, adapter);

    logger.info(`Created and initialized ${type} storage adapter`);
    return adapter;
  }

  /**
   * Close all storage adapters
   */
  public async closeAll(): Promise<void> {
    for (const [key, adapter] of this.adapters.entries()) {
      try {
        await adapter.close();
        logger.info(`Closed storage adapter: ${key}`);
      } catch (error: any) {
        logger.error(`Error closing storage adapter ${key}: ${error.message}`);
      }
    }
    this.adapters.clear();
  }

  /**
   * Type guard for API storage options
   * @param options Storage adapter options
   * @returns True if the options are API storage options
   */
  private isApiStorageOptions(options: StorageAdapterOptions): options is ApiStorageOptions {
    return 'baseUrl' in options;
  }
}
