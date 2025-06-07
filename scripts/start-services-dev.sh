#!/bin/bash

# Start all microservices for development

echo "🚀 Starting MCP Knowledge Graph Microservices..."

# Check if required environment variables are set
if [ -z "$OPENAI_API_KEY" ]; then
    echo "⚠️  Warning: OPENAI_API_KEY not set. AI features will be limited."
fi

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo "❌ Port $1 is already in use. Please free the port and try again."
        exit 1
    fi
}

# Check required ports
echo "🔍 Checking required ports..."
check_port 3000  # API Gateway
check_port 3001  # Graph Service
check_port 3002  # Context Service
check_port 3003  # MCP Service
check_port 4000  # UI Service
check_port 6379  # Redis
check_port 6333  # Qdrant

echo "✅ All ports are available"

# Start infrastructure services
echo "🗃️  Starting infrastructure services..."

# Start Redis
echo "Starting Redis..."
if ! docker ps | grep -q mcp-kg-redis; then
    docker run -d --name mcp-kg-redis -p 6379:6379 redis:7-alpine
fi

# Start Qdrant
echo "Starting Qdrant..."
if ! docker ps | grep -q mcp-kg-qdrant; then
    docker run -d --name mcp-kg-qdrant -p 6333:6333 -p 6334:6334 \
        -v $(pwd)/qdrant_storage:/qdrant/storage:z qdrant/qdrant
fi

# Wait for services to be ready
echo "⏳ Waiting for infrastructure services to be ready..."
sleep 5

# Function to start a service in the background
start_service() {
    local service_name=$1
    local service_path=$2
    local port=$3
    
    echo "🔧 Starting $service_name on port $port..."
    cd "$service_path"
    npm run dev &
    cd - > /dev/null
    sleep 2
}

# Start application services
echo "🔧 Starting application services..."

# Start Graph Service
start_service "Graph Service" "services/graph-service" 3001

# Start Context Service  
start_service "Context Service" "services/context-service" 3002

# Start API Gateway
start_service "API Gateway" "services/api-gateway" 3000

# Start UI Service
start_service "UI Service" "services/ui-service" 4000

# Start MCP Service (last, as it depends on others)
echo "🔧 Starting MCP Service..."
cd services/mcp-service
npm run dev &
cd - > /dev/null

echo ""
echo "🎉 All services started successfully!"
echo ""
echo "📋 Service URLs:"
echo "   🌐 Dashboard:      http://localhost:4000"
echo "   🚪 API Gateway:    http://localhost:3000"
echo "   📊 Graph Service:  http://localhost:3001"
echo "   💬 Context Service: http://localhost:3002"
echo "   🔧 MCP Service:    http://localhost:3003"
echo "   🗃️  Redis:         http://localhost:6379"
echo "   🔍 Qdrant:        http://localhost:6333"
echo ""
echo "📖 Health Checks:"
echo "   curl http://localhost:3000/health/services"
echo ""
echo "⏹️  To stop all services: ./scripts/stop-services.sh"
echo ""

# Keep the script running
wait
