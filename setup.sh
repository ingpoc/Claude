#!/bin/bash

echo "🚀 MCP Knowledge Graph Server Setup"
echo "=================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js $(node --version) detected"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker to run Qdrant."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

echo "✅ Docker detected"

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local from template..."
    cp .env.local.example .env.local
    echo "⚠️  Please edit .env.local and add your OpenAI API key"
else
    echo "✅ .env.local exists"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the server
echo "🔨 Building TypeScript..."
npm run build:server

# Check if Qdrant is running
echo "🔍 Checking Qdrant status..."
if ! curl -s http://localhost:6333/health > /dev/null 2>&1; then
    echo "🐳 Starting Qdrant..."
    npm run start:qdrant
    sleep 5
else
    echo "✅ Qdrant is already running"
fi

# Build Next.js
echo "🏗️  Building Next.js..."
npm run build

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the server:"
echo "  npm run start:all    # Development mode with UI"
echo "  npm run start:prod   # Production mode"
echo ""
echo "To use with Claude Desktop, add to your config:"
echo '  {
    "mcpServers": {
      "knowledge-graph": {
        "command": "node",
        "args": ["'$(pwd)'/dist/standalone-server.js"],
        "cwd": "'$(pwd)'",
        "env": {
          "NODE_ENV": "production",
          "OPENAI_API_KEY": "your_key_here"
        }
      }
    }
  }'
