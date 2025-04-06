// src/storage/adapters/storage-adapter.interface.ts

import { ExtractionResult } from '../../types/extraction.types.js';

/**
 * Interface for storage adapters
 * Defines the contract that all storage adapters must implement
 */
export interface StorageAdapter {
  /**
   * Store an extraction result
   * @param result The extraction result to store
   * @returns A promise that resolves to the ID of the stored result
   */
  store(result: ExtractionResult): Promise<string>;

  /**
   * Retrieve an extraction result by ID
   * @param id The ID of the extraction result to retrieve
   * @returns A promise that resolves to the extraction result or null if not found
   */
  retrieve(id: string): Promise<ExtractionResult | null>;

  /**
   * Update an existing extraction result
   * @param id The ID of the extraction result to update
   * @param result The updated extraction result
   * @returns A promise that resolves to true if the update was successful, false otherwise
   */
  update(id: string, result: Partial<ExtractionResult>): Promise<boolean>;

  /**
   * Delete an extraction result by ID
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
