#!/bin/bash

# Start Qdrant if not already running
npm run start:qdrant

# Function to stop Docker container
function stop_docker {
    echo 'Stopping Qdrant Docker container...'
    docker ps -q --filter 'ancestor=qdrant/qdrant' | xargs -r docker stop
    exit 0
}

# Trap SIGINT (Cmd + C) to stop Docker container
trap stop_docker SIGINT

# Start the services with concurrently
concurrently --kill-others-on-fail "npm:start" "npm:start-nextjs" 