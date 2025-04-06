// src/storage/adapters/file-storage.adapter.ts

import fs from 'fs/promises';
import path from 'path';
import { ExtractionResult } from '../../types/extraction.types.js';
import { StorageAdapter, StorageAdapterOptions } from './storage-adapter.interface.js';
import { logger } from '../../utils/logger.js';

/**
 * File system storage adapter options
 */
export interface FileStorageOptions extends StorageAdapterOptions {
  /**
   * Directory to store extraction results
   * @default './data/extraction-results'
   */
  directory?: string;

  /**
   * File extension for extraction result files
   * @default '.json'
   */
  fileExtension?: string;

  /**
   * Whether to create the directory if it doesn't exist
   * @default true
   */
  createDirectory?: boolean;

  /**
   * Whether to pretty print JSON files
   * @default true
   */
  prettyPrint?: boolean;
}

/**
 * File system storage adapter
 * Stores extraction results as JSON files in the file system
 */
export class FileStorageAdapter implements StorageAdapter {
  private directory: string;
  private fileExtension: string;
  private createDirectory: boolean;
  private prettyPrint: boolean;

  /**
   * Create a new file system storage adapter
   * @param options Options for the file system storage adapter
   */
  constructor(options: FileStorageOptions = {}) {
    this.directory = options.directory || './data/extraction-results';
    this.fileExtension = options.fileExtension || '.json';
    this.createDirectory = options.createDirectory !== false;
    this.prettyPrint = options.prettyPrint !== false;

    logger.info(`File storage adapter created with directory: ${this.directory}`);
  }

  /**
   * Initialize the file system storage adapter
   * Creates the storage directory if it doesn't exist
   */
  public async initialize(): Promise<void> {
    try {
      if (this.createDirectory) {
        await fs.mkdir(this.directory, { recursive: true });
        logger.info(`Created storage directory: ${this.directory}`);
      }
      logger.info('File storage adapter initialized');
    } catch (error: any) {
      logger.error(`Error initializing file storage adapter: ${error.message}`);
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
      const filePath = this.getFilePath(result.id);
      const content = this.prettyPrint ? JSON.stringify(result, null, 2) : JSON.stringify(result);

      await fs.writeFile(filePath, content, 'utf8');
      logger.debug(`Stored extraction result with ID: ${result.id} at ${filePath}`);
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
      const filePath = this.getFilePath(id);
      
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const result = JSON.parse(content) as ExtractionResult;
        logger.debug(`Retrieved extraction result with ID: ${id} from ${filePath}`);
        return result;
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          logger.debug(`Extraction result with ID: ${id} not found at ${filePath}`);
          return null;
        }
        throw error;
      }
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
      const existingResult = await this.retrieve(id);
      if (!existingResult) {
        logger.debug(`Extraction result with ID: ${id} not found for update`);
        return false;
      }

      const updatedResult = { ...existingResult, ...result };
      await this.store(updatedResult);
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
      const filePath = this.getFilePath(id);
      
      try {
        await fs.unlink(filePath);
        logger.debug(`Deleted extraction result with ID: ${id} from ${filePath}`);
        return true;
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          logger.debug(`Extraction result with ID: ${id} not found at ${filePath} for deletion`);
          return false;
        }
        throw error;
      }
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
      // Get all files in the directory
      const files = await fs.readdir(this.directory);
      
      // Filter files by extension
      const resultFiles = files.filter(file => file.endsWith(this.fileExtension));
      
      // Read all files
      const results: ExtractionResult[] = [];
      for (const file of resultFiles) {
        try {
          const filePath = path.join(this.directory, file);
          const content = await fs.readFile(filePath, 'utf8');
          const result = JSON.parse(content) as ExtractionResult;
          results.push(result);
        } catch (error) {
          logger.warn(`Error reading file ${file}: ${error}`);
          // Skip invalid files
        }
      }
      
      // Apply filters
      let filteredResults = results;
      
      if (options.status) {
        filteredResults = filteredResults.filter(result => result.status === options.status);
      }
      
      if (options.url) {
        filteredResults = filteredResults.filter(result => result.url.includes(options.url || ''));
      }
      
      if (options.fromDate) {
        filteredResults = filteredResults.filter(result => {
          const timestamp = new Date(result.timestamp);
          return timestamp >= options.fromDate!;
        });
      }
      
      if (options.toDate) {
        filteredResults = filteredResults.filter(result => {
          const timestamp = new Date(result.timestamp);
          return timestamp <= options.toDate!;
        });
      }
      
      // Sort by timestamp (newest first)
      filteredResults.sort((a, b) => {
        const timestampA = new Date(a.timestamp).getTime();
        const timestampB = new Date(b.timestamp).getTime();
        return timestampB - timestampA;
      });
      
      // Apply pagination
      const offset = options.offset || 0;
      const limit = options.limit || filteredResults.length;
      const paginatedResults = filteredResults.slice(offset, offset + limit);
      
      logger.debug(`Listed ${paginatedResults.length} extraction results from file storage`);
      return paginatedResults;
    } catch (error: any) {
      logger.error(`Error listing extraction results: ${error.message}`);
      throw error;
    }
  }

  /**
   * Close the file system storage adapter
   */
  public async close(): Promise<void> {
    logger.info('File storage adapter closed');
    return Promise.resolve();
  }

  /**
   * Get the file path for an extraction result
   * @param id The ID of the extraction result
   * @returns The file path
   */
  private getFilePath(id: string): string {
    return path.join(this.directory, `${id}${this.fileExtension}`);
  }
}
