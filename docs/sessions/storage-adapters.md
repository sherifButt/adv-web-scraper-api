# Session Storage Adapters

## Available Adapters

### Memory Adapter
```typescript
// src/storage/adapters/memory-storage.adapter.ts
interface MemorySession {
  id: string;
  data: Record<string, any>;
  createdAt: number;
  ttl: number;
}
```
- **Pros**: Fastest, no dependencies
- **Cons**: Lost on server restart
- **Config**:
  ```json
  {
    "adapter": "memory",
    "ttl": 1800
  }
  ```

### Redis Adapter
```typescript
// src/storage/adapters/redis-storage.adapter.ts
interface RedisSession {
  id: string;
  data: string; // JSON stringified
  expiresAt: number;
}
```
- **Pros**: High performance, persistence
- **Cons**: Requires Redis server
- **Config**:
  ```json
  {
    "adapter": "redis",
    "host": "localhost",
    "port": 6379,
    "ttl": 3600
  }
  ```

### MongoDB Adapter
```typescript
// src/storage/adapters/mongodb-storage.adapter.ts
interface MongoSession {
  _id: string;
  data: object;
  expiresAt: Date;
}
```
- **Pros**: Flexible schema, queryable
- **Cons**: Higher latency
- **Config**:
  ```json
  {
    "adapter": "mongodb",
    "uri": "mongodb://localhost:27017",
    "dbName": "sessions",
    "ttl": 86400
  }
  ```

## Performance Comparison
```mermaid
barChart
    title Requests Per Second
    x-axis Adapter
    y-axis RPS
    bar Memory: 12000
    bar Redis: 9500
    bar MongoDB: 3500
```

## Choosing an Adapter
1. **Development**: Use memory for simplicity
2. **Production**: Redis for most use cases
3. **Complex Data**: MongoDB when you need querying

## Custom Adapters
Implement `StorageAdapterInterface`:
```typescript
export interface StorageAdapterInterface {
  get(id: string): Promise<SessionData>;
  set(id: string, data: SessionData, ttl: number): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}
```

Register in `storage-factory.ts`:
```typescript
StorageFactory.register('custom', CustomAdapter);
