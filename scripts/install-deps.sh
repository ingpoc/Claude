#!/bin/bash

# Install dependencies for all microservices

echo "📦 Installing dependencies for MCP Knowledge Graph Microservices..."

# Function to install dependencies for a service
install_service_deps() {
    local service_name=$1
    local service_path=$2
    
    echo "📦 Installing dependencies for $service_name..."
    cd "$service_path"
    
    if [ -f "package.json" ]; then
        npm install
        if [ $? -eq 0 ]; then
            echo "✅ $service_name dependencies installed"
        else
            echo "❌ Failed to install $service_name dependencies"
            exit 1
        fi
    else
        echo "⚠️  No package.json found in $service_path"
    fi
    
    cd - > /dev/null
}

# Install root dependencies (shared modules)
echo "📦 Installing root dependencies..."
npm install

# Install shared dependencies
echo "📦 Installing shared dependencies..."
install_service_deps "Shared" "shared"

# Install service dependencies
install_service_deps "API Gateway" "services/api-gateway"
install_service_deps "Graph Service" "services/graph-service"
install_service_deps "Context Service" "services/context-service"
install_service_deps "MCP Service" "services/mcp-service"
install_service_deps "UI Service" "services/ui-service"

echo ""
echo "🎉 All dependencies installed successfully!"
echo ""
echo "🚀 Next steps:"
echo "   1. Copy .env.local.example to .env.local and configure your settings"
echo "   2. Start services: ./scripts/start-services-dev.sh"
echo "   3. Or use Docker: docker-compose up"
