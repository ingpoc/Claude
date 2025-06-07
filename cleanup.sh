#!/bin/bash

# Cleanup script to remove redundant files

echo "Cleaning up redundant files..."

# Remove backup files
rm -f lib/mcp/tools/ContextTools.ts.backup
rm -f lib/mcp/tools/VectorSearchTools.ts.backup

# Remove fixed files
rm -f lib/mcp/tools/ContextTools.fixed.ts
rm -f lib/mcp/tools/VectorSearchTools.fixed.ts

# Remove old microservices if not needed
read -p "Remove microservices directory? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    rm -rf services/
    rm -f docker-compose.yml
    rm -f MICROSERVICES.md
    rm -f .env.microservices.example
fi

# Remove test files
rm -f test-mcp-format.js
rm -f test-openrouter-auth.ts
rm -f test-openrouter.ts

echo "Cleanup complete!"
