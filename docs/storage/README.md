# Storage Module Documentation

The Storage module provides a flexible and extensible system for storing, retrieving, updating, and deleting extraction results. It follows a modular design with a common interface that allows for easy switching between different storage implementations.

## Table of Contents

- [Architecture](#architecture)
- [Storage Adapters](#storage-adapters)
  - [Memory Storage](#memory-storage)
  - [File Storage](#file-storage)
  - [MongoDB Storage](#mongodb-storage)
  - [Redis Storage](#redis-storage)
  - [API Storage](#api-storage)
- [Storage Factory](#storage-factory)
- [Storage Service](#storage-service)
- [Usage Examples](#usage-examples)
- [Configuration](#configuration)
- [Best Practices](#best-practices)

## Architecture

The Storage module follows the Strategy pattern, allowing the application to switch between different storage implementations without changing the client code. The module consists of the following components:

1. **Storage Adapter Interface**: Defines the contract that all storage adapters must implement.
2. **Storage Adapters**: Concrete implementations of the storage adapter interface for different storage destinations.
3. **Storage Factory**: Creates and manages storage adapters, following the Factory and Singleton patterns.
4. **Storage Service**: Provides a unified interface for storage operations, with support for primary and backup storage.

![Storage Module Architecture](../images/storage-architecture.png)

## Storage Adapters

### Memory Storage

The Memory Storage adapter stores extraction results in memory using a Map. This is useful for development and testing, but data is lost when the server restarts.

**Key Features:**
- Fast in-memory storage
- No persistence between server restarts
- Suitable for development and testing

**Usage:**
```typescript
import { MemoryStorageAdapter } from '../../storage/index.js';

const memoryStorage = new MemoryStorageAdapter();
await memoryStorage.initialize();

// Store an extraction result
const id = await memoryStorage.store(extractionResult);

// Retrieve an extraction result
const result = await memoryStorage.retrieve(id);

// Update an extraction result
const success = await memoryStorage.update(id, { status: 'updated' });

// Delete an extraction result
const deleted = await memoryStorage.delete(id);

// List extraction results
const results = await memoryStorage.list({ limit: 10, offset: 0 });
```

### File Storage

The File Storage adapter stores extraction results as JSON files in the file system. This provides persistence between server restarts and is suitable for small to medium-sized datasets.

**Key Features:**
- Persistent storage in the file system
- JSON file format with optional pretty printing
- Configurable storage directory and file extension
- Suitable for small to medium-sized datasets

**Usage:**
```typescript
import { FileStorageAdapter } from '../../storage/index.js';

const fileStorage = new FileStorageAdapter({
  directory: './data/extraction-results',
  fileExtension: '.json',
  prettyPrint: true,
});
await fileStorage.initialize();

// Store an extraction result
const id = await fileStorage.store(extractionResult);

// Retrieve an extraction result
const result = await fileStorage.retrieve(id);

// Update an extraction result
const success = await fileStorage.update(id, { status: 'updated' });

// Delete an extraction result
const deleted = await fileStorage.delete(id);

// List extraction results
const results = await fileStorage.list({ limit: 10, offset: 0 });
```

### MongoDB Storage

The MongoDB Storage adapter stores extraction results in a MongoDB database. This provides scalable and queryable storage suitable for large datasets.

**Key Features:**
- Scalable database storage
- Indexing for efficient queries
- Support for complex filtering and pagination
- Suitable for large datasets and production use

**Usage:**
```typescript
import { MongoDBStorageAdapter } from '../../storage/index.js';

const mongodbStorage = new MongoDBStorageAdapter({
  uri: 'mongodb://localhost:27017/web-scraper',
  database: 'web-scraper',
  collection: 'extraction-results',
});
await mongodbStorage.initialize();

// Store an extraction result
const id = await mongodbStorage.store(extractionResult);

// Retrieve an extraction result
const result = await mongodbStorage.retrieve(id);

// Update an extraction result
const success = await mongodbStorage.update(id, { status: 'updated' });

// Delete an extraction result
const deleted = await mongodbStorage.delete(id);

// List extraction results
const results = await mongodbStorage.list({ limit: 10, offset: 0 });
```

### Redis Storage

The Redis Storage adapter stores extraction results in Redis. This provides high-performance caching and storage with optional expiration.

**Key Features:**
- High-performance in-memory storage
- Optional expiration for time-sensitive data
- Indexing for efficient filtering and sorting
- Suitable for caching and high-throughput scenarios

**Usage:**
```typescript
import { RedisStorageAdapter } from '../../storage/index.js';

const redisStorage = new RedisStorageAdapter({
  host: 'localhost',
  port: 6379,
  keyPrefix: 'extraction:',
  expireTime: 3600, // 1 hour
});
await redisStorage.initialize();

// Store an extraction result
const id = await redisStorage.store(extractionResult);

// Retrieve an extraction result
const result = await redisStorage.retrieve(id);

// Update an extraction result
const success = await redisStorage.update(id, { status: 'updated' });

// Delete an extraction result
const deleted = await redisStorage.delete(id);

// List extraction results
const results = await redisStorage.list({ limit: 10, offset: 0 });
```

### API Storage

The API Storage adapter stores extraction results in an external API. This provides integration with external systems and services.

**Key Features:**
- Integration with external APIs
- Support for various authentication methods
- Configurable endpoints and retry mechanisms
- Suitable for integration with external systems

**Usage:**
```typescript
import { ApiStorageAdapter } from '../../storage/index.js';

const apiStorage = new ApiStorageAdapter({
  baseUrl: 'https://api.example.com',
  endpoints: {
    store: '/store',
    retrieve: '/retrieve',
    update: '/update',
    delete: '/delete',
    list: '/list',
  },
  auth: {
    type: 'bearer',
    token: 'your-api-token',
  },
  retry: {
    maxRetries: 3,
    retryDelay: 1000,
  },
});
await apiStorage.initialize();

// Store an extraction result
const id = await apiStorage.store(extractionResult);

// Retrieve an extraction result
const result = await apiStorage.retrieve(id);

// Update an extraction result
const success = await apiStorage.update(id, { status: 'updated' });

// Delete an extraction result
const deleted = await apiStorage.delete(id);

// List extraction results
const results = await apiStorage.list({ limit: 10, offset: 0 });
```

## Storage Factory

The Storage Factory creates and manages storage adapters, following the Factory and Singleton patterns. It provides a centralized way to create and reuse storage adapters.

**Key Features:**
- Singleton pattern for centralized management
- Factory pattern for creating storage adapters
- Adapter reuse for efficient resource usage
- Support for different adapter types and options

**Usage:**
```typescript
import { StorageFactory } from '../../storage/index.js';

// Get the storage factory instance
const storageFactory = StorageFactory.getInstance();

// Get a memory storage adapter
const memoryStorage = await storageFactory.getAdapter('memory');

// Get a file storage adapter with options
const fileStorage = await storageFactory.getAdapter('file', {
  directory: './data/extraction-results',
  prettyPrint: true,
});

// Get a MongoDB storage adapter with options
const mongodbStorage = await storageFactory.getAdapter('mongodb', {
  uri: 'mongodb://localhost:27017/web-scraper',
});

// Close all adapters when done
await storageFactory.closeAll();
```

## Storage Service

The Storage Service provides a unified interface for storage operations, with support for primary and backup storage. It follows the Singleton pattern and provides a high-level API for storage operations.

**Key Features:**
- Singleton pattern for centralized management
- Support for primary and backup storage
- Automatic initialization and synchronization
- High-level API for storage operations

**Usage:**
```typescript
import { StorageService } from '../../storage/index.js';

// Get the storage service instance with options
const storageService = StorageService.getInstance({
  primaryAdapter: 'mongodb',
  primaryAdapterOptions: {
    uri: 'mongodb://localhost:27017/web-scraper',
  },
  backupAdapter: 'file',
  backupAdapterOptions: {
    directory: './data/backup',
  },
  useBackup: true,
});

// Initialize the storage service
await storageService.initialize();

// Store an extraction result
const id = await storageService.store(extractionResult);

// Retrieve an extraction result
const result = await storageService.retrieve(id);

// Update an extraction result
const success = await storageService.update(id, { status: 'updated' });

// Delete an extraction result
const deleted = await storageService.delete(id);

// List extraction results
const results = await storageService.list({ limit: 10, offset: 0 });

// Change the primary storage adapter
await storageService.changePrimaryAdapter('redis', {
  host: 'localhost',
  port: 6379,
});

// Change the backup storage adapter
await storageService.changeBackupAdapter('api', {
  baseUrl: 'https://api.example.com',
});

// Close the storage service when done
await storageService.close();
```

## Usage Examples

### Basic Usage with Storage Service

```typescript
import { StorageService } from '../../storage/index.js';

// Get the storage service instance
const storageService = StorageService.getInstance();

// Initialize the storage service
await storageService.initialize();

// Store an extraction result
const extractionResult = {
  id: 'extract_123',
  url: 'https://example.com',
  status: 'completed',
  data: { title: 'Example Page' },
  timestamp: new Date().toISOString(),
};
const id = await storageService.store(extractionResult);

// Retrieve an extraction result
const result = await storageService.retrieve(id);
console.log('Retrieved result:', result);

// Update an extraction result
const success = await storageService.update(id, { status: 'updated' });
console.log('Update success:', success);

// List extraction results
const results = await storageService.list({ limit: 10, offset: 0 });
console.log('Listed results:', results);

// Delete an extraction result
const deleted = await storageService.delete(id);
console.log('Delete success:', deleted);

// Close the storage service when done
await storageService.close();
```

### Using Multiple Storage Adapters

```typescript
import { StorageService } from '../../storage/index.js';

// Get the storage service instance with primary and backup adapters
const storageService = StorageService.getInstance({
  primaryAdapter: 'mongodb',
  primaryAdapterOptions: {
    uri: 'mongodb://localhost:27017/web-scraper',
  },
  backupAdapter: 'file',
  backupAdapterOptions: {
    directory: './data/backup',
  },
  useBackup: true,
});

// Initialize the storage service
await storageService.initialize();

// Store an extraction result (stored in both primary and backup)
const id = await storageService.store(extractionResult);

// Retrieve an extraction result (tries primary first, then backup)
const result = await storageService.retrieve(id);

// Update an extraction result (updates both primary and backup)
const success = await storageService.update(id, { status: 'updated' });

// Delete an extraction result (deletes from both primary and backup)
const deleted = await storageService.delete(id);

// Close the storage service when done
await storageService.close();
```

### Migrating Between Storage Adapters

```typescript
import { StorageService } from '../../storage/index.js';

// Get the storage service instance with memory adapter
const storageService = StorageService.getInstance({
  primaryAdapter: 'memory',
});

// Initialize the storage service
await storageService.initialize();

// Store some extraction results
await storageService.store(extractionResult1);
await storageService.store(extractionResult2);

// Change the primary storage adapter to MongoDB
// This will automatically migrate all data from memory to MongoDB
await storageService.changePrimaryAdapter('mongodb', {
  uri: 'mongodb://localhost:27017/web-scraper',
});

// Now all operations will use MongoDB
const results = await storageService.list();
console.log('Results from MongoDB:', results);

// Close the storage service when done
await storageService.close();
```

## Configuration

### Storage Adapter Options

#### Memory Storage Options

```typescript
interface MemoryStorageOptions {
  // No specific options for memory storage
}
```

#### File Storage Options

```typescript
interface FileStorageOptions {
  directory?: string; // Default: './data/extraction-results'
  fileExtension?: string; // Default: '.json'
  createDirectory?: boolean; // Default: true
  prettyPrint?: boolean; // Default: true
}
```

#### MongoDB Storage Options

```typescript
interface MongoDBStorageOptions {
  uri?: string; // Default: config.mongodb.uri
  database?: string; // Default: 'web-scraper'
  collection?: string; // Default: 'extraction-results'
  options?: any; // MongoDB connection options
}
```

#### Redis Storage Options

```typescript
interface RedisStorageOptions {
  host?: string; // Default: config.redis.host
  port?: number; // Default: config.redis.port
  password?: string;
  db?: number; // Default: 0
  keyPrefix?: string; // Default: 'extraction:'
  expireTime?: number; // Default: 0 (no expiration)
}
```

#### API Storage Options

```typescript
interface ApiStorageOptions {
  baseUrl: string;
  endpoints?: {
    store?: string; // Default: '/store'
    retrieve?: string; // Default: '/retrieve'
    update?: string; // Default: '/update'
    delete?: string; // Default: '/delete'
    list?: string; // Default: '/list'
  };
  auth?: {
    type: 'basic' | 'bearer' | 'api-key';
    username?: string; // For basic auth
    password?: string; // For basic auth
    token?: string; // For bearer auth
    apiKeyName?: string; // For API key auth
    apiKeyValue?: string; // For API key auth
    apiKeyLocation?: 'header' | 'query'; // Default: 'header'
  };
  timeout?: number; // Default: 30000
  headers?: Record<string, string>;
  retry?: {
    maxRetries?: number; // Default: 3
    retryDelay?: number; // Default: 1000
  };
}
```

### Storage Factory Options

```typescript
interface StorageFactoryOptions {
  defaultAdapter?: 'memory' | 'file' | 'mongodb' | 'redis' | 'api'; // Default: 'memory'
  adapterOptions?: {
    memory?: MemoryStorageOptions;
    file?: FileStorageOptions;
    mongodb?: MongoDBStorageOptions;
    redis?: RedisStorageOptions;
    api?: ApiStorageOptions;
  };
}
```

### Storage Service Options

```typescript
interface StorageServiceOptions {
  primaryAdapter?: 'memory' | 'file' | 'mongodb' | 'redis' | 'api'; // Default: 'memory'
  primaryAdapterOptions?: StorageAdapterOptions;
  backupAdapter?: 'memory' | 'file' | 'mongodb' | 'redis' | 'api';
  backupAdapterOptions?: StorageAdapterOptions;
  useBackup?: boolean; // Default: false
}
```

## Best Practices

### Choosing the Right Storage Adapter

- **Memory Storage**: Use for development, testing, or when persistence is not required.
- **File Storage**: Use for small to medium-sized datasets or when a simple persistence solution is needed.
- **MongoDB Storage**: Use for large datasets, complex queries, or production environments.
- **Redis Storage**: Use for high-performance caching, time-sensitive data, or high-throughput scenarios.
- **API Storage**: Use for integration with external systems or services.

### Using Primary and Backup Storage

- Use primary and backup storage for critical data that needs redundancy.
- Choose complementary storage adapters (e.g., MongoDB for primary and File for backup).
- Regularly test backup recovery by retrieving data from the backup adapter.

### Error Handling

- Always handle errors from storage operations.
- Implement retry mechanisms for transient errors.
- Log storage errors with appropriate context.
- Provide meaningful error messages to clients.

### Performance Considerations

- Use connection pooling for database adapters.
- Implement caching for frequently accessed data.
- Use pagination for large datasets.
- Monitor storage performance and optimize as needed.

### Security Considerations

- Use secure connections for remote storage (HTTPS, TLS).
- Implement proper authentication for storage services.
- Encrypt sensitive data before storage.
- Validate and sanitize data before storage.
