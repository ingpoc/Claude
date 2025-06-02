#!/bin/bash

# Start Qdrant if not already running
npm run start:qdrant

# Create log directory if it doesn't exist
mkdir -p logs

# Function to stop Docker container
function stop_docker {
    echo 'Stopping Qdrant Docker container...'
    docker ps -q --filter 'ancestor=qdrant/qdrant' | xargs -r docker stop
    exit 0
}

# Trap SIGINT (Cmd + C) to stop Docker container
trap stop_docker SIGINT

# Set RUN_UI to true for local development with UI
export RUN_UI=true

# Start the unified server with UI
echo "Starting MCP Knowledge Graph Server with Dashboard..."
echo "Dashboard will be available at http://localhost:4000"
npm run start 