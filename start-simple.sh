#!/bin/bash

echo "🚀 Starting MCP Knowledge Graph Services"
echo "======================================="

# Function to check if port is open
check_port() {
    nc -z localhost $1 >/dev/null 2>&1
}

# Start Python service in background
echo "📊 Starting Python Backend Service..."
cd python-service
python python_memvid_service.py &
PYTHON_PID=$!
cd ..

# Wait for Python service to be ready
echo "⏳ Waiting for Python service on port 8000..."
for i in {1..30}; do
    if check_port 8000; then
        echo "✅ Python service ready on port 8000"
        break
    fi
    sleep 1
    if [ $i -eq 30 ]; then
        echo "❌ Python service failed to start"
        exit 1
    fi
done

# Start Next.js frontend in background
echo "🌐 Starting Next.js Frontend..."
npm run dev &
FRONTEND_PID=$!

# Wait for frontend service to be ready
echo "⏳ Waiting for frontend service on port 3000..."
for i in {1..30}; do
    if check_port 3000; then
        echo "✅ Frontend service ready on port 3000"
        break
    fi
    sleep 1
    if [ $i -eq 30 ]; then
        echo "❌ Frontend service failed to start"
        kill $PYTHON_PID 2>/dev/null
        exit 1
    fi
done

echo "======================================="
echo "✅ All services started successfully!"
echo ""
echo "🔗 Services:"
echo "   • Frontend Dashboard: http://localhost:3000"
echo "   • Python API Service: http://localhost:8000"
echo "   • API Documentation: http://localhost:8000/docs"
echo ""
echo "📋 MCP Configuration:"
echo "   • MCP Server Path: ./dist/mcp-host-simple.js"
echo "   • Build MCP Server: npm run build:server"
echo ""
echo "🛑 Press Ctrl+C to stop all services"
echo "======================================="

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $PYTHON_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ All services stopped"
    exit 0
}

# Set trap to cleanup on exit
trap cleanup SIGINT SIGTERM

# Keep script running
wait