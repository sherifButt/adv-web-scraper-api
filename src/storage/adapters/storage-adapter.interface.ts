// src/storage/adapters/storage-adapter.interface.ts

import { ExtractionResult } from '../../types/extraction.types.js';
import { SessionData } from '../../core/session/session-manager.js'; // Import SessionData if needed for union type

// Define a generic type for stored data, ensuring it has an ID and optionally a queue name
export type StorableData = Record<string, any> & { id: string; queueName?: string }; // Export the type

/**
 * Interface for storage adapters
 * Defines the contract that all storage adapters must implement
 */
export interface StorageAdapter {
  /**
   * Store data (e.g., ExtractionResult, SessionData)
   * @param data The data object to store (must have an 'id' property)
   * @param ttl Optional Time-to-Live in milliseconds
   * @returns A promise that resolves to the ID of the stored data
   */
  store(data: StorableData, ttl?: number): Promise<string>;

  /**
   * Retrieve data by ID
   * @param id The ID of the data to retrieve
   * @returns A promise that resolves to the data object or null if not found
   */
  retrieve(id: string): Promise<StorableData | null>;

  /**
   * Update existing data
   * @param id The ID of the data to update
   * @param data The partial data object with updates
   * @returns A promise that resolves to true if the update was successful, false otherwise
   */
  update(id: string, data: Partial<StorableData>): Promise<boolean>;

  /**
   * Delete data by ID
   * @param id The ID of the extraction result to delete
   * @returns A promise that resolves to true if the deletion was successful, false otherwise
   */
  delete(id: string): Promise<boolean>;

  /**
   * List extraction results with optional filtering and pagination
   * @param options Options for filtering and pagination
   * @returns A promise that resolves to an array of extraction results
   */
  list(options?: {
    limit?: number;
    offset?: number;
    status?: string;
    url?: string;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<ExtractionResult[]>;

  /**
   * Initialize the storage adapter
   * @returns A promise that resolves when the adapter is initialized
   */
  initialize(): Promise<void>;

  /**
   * Close the storage adapter and release any resources
   * @returns A promise that resolves when the adapter is closed
   */
  close(): Promise<void>;
}

/**
 * Storage adapter options
 */
export interface StorageAdapterOptions {
  [key: string]: any;
}
