graph TD
    Client[Client Code] --> StorageService[Storage Service]
    StorageService --> StorageFactory[Storage Factory]
    StorageFactory --> MemoryAdapter[Memory Storage Adapter]
    StorageFactory --> FileAdapter[File Storage Adapter]
    StorageFactory --> MongoDBAdapter[MongoDB Storage Adapter]
    StorageFactory --> RedisAdapter[Redis Storage Adapter]
    StorageFactory --> ApiAdapter[API Storage Adapter]
    
    MemoryAdapter --> StorageInterface[Storage Adapter Interface]
    FileAdapter --> StorageInterface
    MongoDBAdapter --> StorageInterface
    RedisAdapter --> StorageInterface
    ApiAdapter --> StorageInterface
    
    MemoryAdapter --> InMemoryMap[In-Memory Map]
    FileAdapter --> FileSystem[File System]
    MongoDBAdapter --> MongoDB[(MongoDB)]
    RedisAdapter --> Redis[(Redis)]
    ApiAdapter --> ExternalAPI[External API]
    
    subgraph "Storage Module"
        StorageService
        StorageFactory
        StorageInterface
        MemoryAdapter
        FileAdapter
        MongoDBAdapter
        RedisAdapter
        ApiAdapter
    end
    
    subgraph "Storage Destinations"
        InMemoryMap
        FileSystem
        MongoDB
        Redis
        ExternalAPI
    end
    
    classDef service fill:#f9f,stroke:#333,stroke-width:2px;
    classDef factory fill:#bbf,stroke:#333,stroke-width:2px;
    classDef interface fill:#bfb,stroke:#333,stroke-width:2px;
    classDef adapter fill:#fbb,stroke:#333,stroke-width:2px;
    classDef destination fill:#ddd,stroke:#333,stroke-width:2px;
    
    class StorageService service;
    class StorageFactory factory;
    class StorageInterface interface;
    class MemoryAdapter,FileAdapter,MongoDBAdapter,RedisAdapter,ApiAdapter adapter;
    class InMemoryMap,FileSystem,MongoDB,Redis,ExternalAPI destination;
