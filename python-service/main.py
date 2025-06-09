#!/usr/bin/env python3
"""
Modular MCP Knowledge Graph Service

A FastAPI service providing memvid-integrated knowledge graph storage and retrieval
with comprehensive validation, search capabilities, and analytics.

Usage:
    python main.py

Requirements:
    pip install fastapi uvicorn memvid python-multipart pydantic
"""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import modular components
from app.config import settings, setup_logging
from app.core import MemvidKnowledgeGraph
from app.api import (
    setup_entity_routes,
    setup_relationship_routes,
    setup_project_routes,
    setup_search_routes
)

# Setup logging
setup_logging()

# Create FastAPI app
app = FastAPI(
    title="Memvid Knowledge Graph Service", 
    description="Modular Python backend service for memvid-based knowledge graph storage with comprehensive validation",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize knowledge graph
kg = MemvidKnowledgeGraph()

# Health check endpoint
@app.get("/", tags=["health"])
async def root():
    """Health check endpoint with service statistics."""
    stats = await kg.get_stats()
    return {
        "service": "Memvid Knowledge Graph Service",
        "status": "running",
        "version": "2.0.0",
        "architecture": "modular",
        **stats
    }

@app.get("/health", tags=["health"])
async def health_check():
    """Detailed health check."""
    stats = await kg.get_stats()
    return {
        "status": "healthy",
        "modules": {
            "core": "loaded",
            "api": "loaded", 
            "models": "loaded",
            "config": "loaded",
            "utils": "loaded"
        },
        **stats
    }

# Setup API routes with dependency injection
entity_router = setup_entity_routes(kg)
relationship_router = setup_relationship_routes(kg)
project_router = setup_project_routes(kg)
search_router = setup_search_routes(kg)

# Include routers
app.include_router(entity_router)
app.include_router(relationship_router)
app.include_router(project_router)
app.include_router(search_router)

# Additional endpoints for compatibility
@app.get("/api/entities/{entity_id}/related", tags=["relationships"])
async def find_related_entities(
    entity_id: str,
    direction: str = "both",
    relationship_type: str = None,
    depth: int = 1,
    project_id: str = None
):
    """Find entities related to a specific entity through relationships."""
    from app.utils.validators import validate_entity_id, validate_project_id
    
    # Validate entity exists
    validate_entity_id(entity_id, kg.entities)
    
    # Validate project if specified
    if project_id and project_id != "default":
        validate_project_id(project_id, kg.projects)
    
    # Validate direction
    if direction not in ["outgoing", "incoming", "both"]:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Direction must be 'outgoing', 'incoming', or 'both'")
    
    # Validate depth
    if not 1 <= depth <= 3:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Depth must be between 1 and 3")
    
    # Find related entities (implement traversal logic)
    results = []
    visited = set()
    
    def traverse(current_entity_id: str, current_depth: int):
        if current_depth > depth or current_entity_id in visited:
            return
        
        visited.add(current_entity_id)
        
        for rel_id, rel in kg.relationships.items():
            # Filter by project if specified
            if project_id and rel.projectId != project_id:
                continue
            
            # Filter by relationship type if specified
            if relationship_type and rel.type != relationship_type:
                continue
            
            target_entity_id = None
            rel_direction = None
            
            # Check direction and find target entity
            if direction in ["outgoing", "both"] and rel.sourceId == current_entity_id:
                target_entity_id = rel.targetId
                rel_direction = "outgoing"
            elif direction in ["incoming", "both"] and rel.targetId == current_entity_id:
                target_entity_id = rel.sourceId
                rel_direction = "incoming"
            
            if target_entity_id and target_entity_id in kg.entities:
                target_entity = kg.entities[target_entity_id]
                
                # Add to results if not the starting entity
                if target_entity_id != entity_id:
                    results.append({
                        "entity": target_entity.model_dump(),
                        "relationship": rel.model_dump(),
                        "direction": rel_direction,
                        "depth": current_depth
                    })
                
                # Continue traversal if depth allows
                if current_depth < depth:
                    traverse(target_entity_id, current_depth + 1)
    
    traverse(entity_id, 1)
    
    # Remove duplicates based on entity ID
    seen_entities = set()
    unique_results = []
    for result in results:
        entity_id_key = result["entity"]["id"]
        if entity_id_key not in seen_entities:
            seen_entities.add(entity_id_key)
            unique_results.append(result)
    
    return unique_results


if __name__ == "__main__":
    print("🚀 Starting Modular MCP Knowledge Graph Service...")
    print(f"📍 Server: http://{settings.HOST}:{settings.PORT}")
    print(f"📚 Documentation: http://{settings.HOST}:{settings.PORT}/docs")
    print(f"🔧 Configuration: {settings.storage_path}")
    
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info" if not settings.DEBUG else "debug"
    )