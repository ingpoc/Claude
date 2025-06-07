#!/bin/bash

# Stop all microservices

echo "🛑 Stopping MCP Knowledge Graph Microservices..."

# Function to stop processes on a specific port
stop_port() {
    local port=$1
    local service_name=$2
    
    local pids=$(lsof -ti :$port)
    if [ ! -z "$pids" ]; then
        echo "⏹️  Stopping $service_name (port $port)..."
        kill -9 $pids 2>/dev/null
    fi
}

# Stop application services
echo "🔧 Stopping application services..."
stop_port 4000 "UI Service"
stop_port 3003 "MCP Service"
stop_port 3002 "Context Service"
stop_port 3001 "Graph Service"
stop_port 3000 "API Gateway"

# Stop infrastructure services
echo "🗃️  Stopping infrastructure services..."

# Stop Redis container
if docker ps | grep -q mcp-kg-redis; then
    echo "⏹️  Stopping Redis..."
    docker stop mcp-kg-redis
    docker rm mcp-kg-redis
fi

# Stop Qdrant container
if docker ps | grep -q mcp-kg-qdrant; then
    echo "⏹️  Stopping Qdrant..."
    docker stop mcp-kg-qdrant
    docker rm mcp-kg-qdrant
fi

# Kill any remaining Node.js processes related to our services
echo "🧹 Cleaning up remaining processes..."
pkill -f "ts-node.*services/" 2>/dev/null || true
pkill -f "node.*services/" 2>/dev/null || true

echo ""
echo "✅ All services stopped successfully!"
echo ""
echo "💡 To start services again:"
echo "   ./scripts/start-services-dev.sh (development)"
echo "   docker-compose up (production)"
