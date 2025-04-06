// src/storage/adapters/api-storage.adapter.ts

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ExtractionResult } from '../../types/extraction.types.js';
import { StorageAdapter, StorageAdapterOptions } from './storage-adapter.interface.js';
import { logger } from '../../utils/logger.js';

/**
 * API storage adapter options
 */
export interface ApiStorageOptions extends StorageAdapterOptions {
  /**
   * Base URL of the API
   */
  baseUrl: string;

  /**
   * API endpoints
   */
  endpoints?: {
    /**
     * Store endpoint
     * @default '/store'
     */
    store?: string;

    /**
     * Retrieve endpoint
     * @default '/retrieve'
     */
    retrieve?: string;

    /**
     * Update endpoint
     * @default '/update'
     */
    update?: string;

    /**
     * Delete endpoint
     * @default '/delete'
     */
    delete?: string;

    /**
     * List endpoint
     * @default '/list'
     */
    list?: string;
  };

  /**
   * API authentication
   */
  auth?: {
    /**
     * Authentication type
     */
    type: 'basic' | 'bearer' | 'api-key';

    /**
     * Username for basic authentication
     */
    username?: string;

    /**
     * Password for basic authentication
     */
    password?: string;

    /**
     * Token for bearer authentication
     */
    token?: string;

    /**
     * API key name
     */
    apiKeyName?: string;

    /**
     * API key value
     */
    apiKeyValue?: string;

    /**
     * API key location
     * @default 'header'
     */
    apiKeyLocation?: 'header' | 'query';
  };

  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  timeout?: number;

  /**
   * Additional headers to include in requests
   */
  headers?: Record<string, string>;

  /**
   * Retry configuration
   */
  retry?: {
    /**
     * Maximum number of retries
     * @default 3
     */
    maxRetries?: number;

    /**
     * Retry delay in milliseconds
     * @default 1000
     */
    retryDelay?: number;
  };
}

/**
 * API storage adapter
 * Stores extraction results in an external API
 */
export class ApiStorageAdapter implements StorageAdapter {
  private baseUrl: string;
  private endpoints: {
    store: string;
    retrieve: string;
    update: string;
    delete: string;
    list: string;
  };
  private auth?: ApiStorageOptions['auth'];
  private timeout: number;
  private headers: Record<string, string>;
  private retry: {
    maxRetries: number;
    retryDelay: number;
  };
  private client: AxiosInstance;

  /**
   * Create a new API storage adapter
   * @param options Options for the API storage adapter
   */
  constructor(options: ApiStorageOptions) {
    this.baseUrl = options.baseUrl;
    this.endpoints = {
      store: options.endpoints?.store || '/store',
      retrieve: options.endpoints?.retrieve || '/retrieve',
      update: options.endpoints?.update || '/update',
      delete: options.endpoints?.delete || '/delete',
      list: options.endpoints?.list || '/list',
    };
    this.auth = options.auth;
    this.timeout = options.timeout || 30000;
    this.headers = options.headers || {};
    this.retry = {
      maxRetries: options.retry?.maxRetries || 3,
      retryDelay: options.retry?.retryDelay || 1000,
    };

    // Create axios instance
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: this.headers,
    });

    logger.info(`API storage adapter created with base URL: ${this.baseUrl}`);
  }

  /**
   * Initialize the API storage adapter
   */
  public async initialize(): Promise<void> {
    try {
      // Test the connection
      await this.client.get('/', this.getRequestConfig());
      logger.info('API storage adapter initialized');
    } catch (error: any) {
      logger.warn(`API storage adapter initialization warning: ${error.message}`);
      // Don't throw error, just log warning
    }
  }

  /**
   * Store an extraction result
   * @param result The extraction result to store
   * @returns The ID of the stored result
   */
  public async store(result: ExtractionResult): Promise<string> {
    try {
      const response = await this.executeWithRetry(() =>
        this.client.post(this.endpoints.store, result, this.getRequestConfig())
      );

      const id = response.data.id || result.id;
      logger.debug(`Stored extraction result with ID: ${id} in API`);
      return id;
    } catch (error: any) {
      logger.error(`Error storing extraction result in API: ${error.message}`);
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
      const response = await this.executeWithRetry(() =>
        this.client.get(`${this.endpoints.retrieve}/${id}`, this.getRequestConfig())
      );

      if (response.data) {
        logger.debug(`Retrieved extraction result with ID: ${id} from API`);
        return response.data as ExtractionResult;
      } else {
        logger.debug(`Extraction result with ID: ${id} not found in API`);
        return null;
      }
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        logger.debug(`Extraction result with ID: ${id} not found in API`);
        return null;
      }
      logger.error(`Error retrieving extraction result from API: ${error.message}`);
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
      const response = await this.executeWithRetry(() =>
        this.client.put(`${this.endpoints.update}/${id}`, result, this.getRequestConfig())
      );

      const success = response.status === 200 || response.status === 204;
      if (success) {
        logger.debug(`Updated extraction result with ID: ${id} in API`);
      } else {
        logger.debug(`Failed to update extraction result with ID: ${id} in API`);
      }
      return success;
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        logger.debug(`Extraction result with ID: ${id} not found in API for update`);
        return false;
      }
      logger.error(`Error updating extraction result in API: ${error.message}`);
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
      const response = await this.executeWithRetry(() =>
        this.client.delete(`${this.endpoints.delete}/${id}`, this.getRequestConfig())
      );

      const success = response.status === 200 || response.status === 204;
      if (success) {
        logger.debug(`Deleted extraction result with ID: ${id} from API`);
      } else {
        logger.debug(`Failed to delete extraction result with ID: ${id} from API`);
      }
      return success;
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        logger.debug(`Extraction result with ID: ${id} not found in API for deletion`);
        return false;
      }
      logger.error(`Error deleting extraction result from API: ${error.message}`);
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
      // Convert options to query parameters
      const params: Record<string, any> = {};
      
      if (options.limit !== undefined) {
        params.limit = options.limit;
      }
      
      if (options.offset !== undefined) {
        params.offset = options.offset;
      }
      
      if (options.status) {
        params.status = options.status;
      }
      
      if (options.url) {
        params.url = options.url;
      }
      
      if (options.fromDate) {
        params.fromDate = options.fromDate.toISOString();
      }
      
      if (options.toDate) {
        params.toDate = options.toDate.toISOString();
      }
      
      const config = this.getRequestConfig();
      config.params = params;
      
      const response = await this.executeWithRetry(() =>
        this.client.get(this.endpoints.list, config)
      );
      
      const results = response.data as ExtractionResult[];
      logger.debug(`Listed ${results.length} extraction results from API`);
      return results;
    } catch (error: any) {
      logger.error(`Error listing extraction results from API: ${error.message}`);
      throw error;
    }
  }

  /**
   * Close the API storage adapter
   */
  public async close(): Promise<void> {
    logger.info('API storage adapter closed');
    return Promise.resolve();
  }

  /**
   * Get request configuration with authentication
   * @returns Axios request configuration
   */
  private getRequestConfig(): AxiosRequestConfig {
    const config: AxiosRequestConfig = {};
    
    if (this.auth) {
      switch (this.auth.type) {
        case 'basic':
          if (this.auth.username && this.auth.password) {
            config.auth = {
              username: this.auth.username,
              password: this.auth.password,
            };
          }
          break;
        case 'bearer':
          if (this.auth.token) {
            config.headers = {
              ...config.headers,
              Authorization: `Bearer ${this.auth.token}`,
            };
          }
          break;
        case 'api-key':
          if (this.auth.apiKeyName && this.auth.apiKeyValue) {
            if (this.auth.apiKeyLocation === 'query') {
              config.params = {
                ...config.params,
                [this.auth.apiKeyName]: this.auth.apiKeyValue,
              };
            } else {
              // Default to header
              config.headers = {
                ...config.headers,
                [this.auth.apiKeyName]: this.auth.apiKeyValue,
              };
            }
          }
          break;
      }
    }
    
    return config;
  }

  /**
   * Execute a request with retry logic
   * @param request The request function to execute
   * @returns The response from the request
   */
  private async executeWithRetry<T>(request: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.retry.maxRetries; attempt++) {
      try {
        return await request();
      } catch (error: any) {
        lastError = error;
        
        // Don't retry if it's a 4xx error (except 429 Too Many Requests)
        if (
          error.response &&
          error.response.status >= 400 &&
          error.response.status < 500 &&
          error.response.status !== 429
        ) {
          throw error;
        }
        
        // Last attempt, throw the error
        if (attempt === this.retry.maxRetries) {
          throw error;
        }
        
        // Wait before retrying
        const delay = this.retry.retryDelay * Math.pow(2, attempt);
        logger.debug(`Retrying API request in ${delay}ms (attempt ${attempt + 1}/${this.retry.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // This should never happen, but TypeScript requires a return statement
    throw lastError || new Error('Unknown error during request retry');
  }
}
