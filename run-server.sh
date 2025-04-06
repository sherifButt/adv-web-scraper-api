#!/bin/bash
# Run the server with verbose output
echo "Starting server with verbose output..."
DEBUG=* NODE_DEBUG=module,loader npx tsx src/server.ts
