#!/usr/bin/env python3
"""
Python Memvid Service for MCP Knowledge Graph

This service provides the actual memvid integration that the TypeScript
MCP server will communicate with via HTTP API.

Requirements:
pip install fastapi uvicorn memvid python-multipart pydantic

Usage:
python python_memvid_service.py
"""

import os
import json
import uuid
import logging
from datetime import datetime
from typing import List, Dict, Optional, Any
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Configure logging to output to stderr
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Import actual memvid Python library
try:
    from memvid import MemvidEncoder, MemvidRetriever
    MEMVID_AVAILABLE = True
except ImportError:
    logging.warning("memvid not installed. Install with: pip install memvid")
    MEMVID_AVAILABLE = False
    # Mock classes for development
    class MemvidEncoder:
        def add_chunk(self, text, metadata): pass
        async def build_video(self, video_path, index_path): pass
    
    class MemvidRetriever:
        def __init__(self, video_path, index_path): pass
        async def search(self, query, limit=10): return []

app = FastAPI(
    title="Memvid Knowledge Graph Service",
    description="Python backend service for memvid-based knowledge graph storage",
    version="1.0.0"
)

# Enable CORS for TypeScript frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data Models
class Entity(BaseModel):
    id: Optional[str] = None
    name: str
    type: str
    description: str
    observations: List[Dict[str, Any]] = []
    addedBy: str
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
    projectId: Optional[str] = "default"

class Relationship(BaseModel):
    id: Optional[str] = None
    sourceId: str
    targetId: str
    type: str
    description: Optional[str] = None
    addedBy: str
    createdAt: Optional[str] = None
    projectId: Optional[str] = "default"

class Project(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = None
    createdAt: Optional[str] = None
    lastAccessed: Optional[str] = None

class Observation(BaseModel):
    entityId: str
    text: str
    addedBy: str

# Storage Management
class MemvidKnowledgeGraph:
    def __init__(self, storage_dir: str = "shared_knowledge"):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(exist_ok=True)
        
        # File paths
        self.video_path = self.storage_dir / "knowledge_graph.mp4"
        self.index_path = self.storage_dir / "knowledge_graph_index.json"
        self.metadata_path = self.storage_dir / "metadata.json"
        
        # In-memory storage for fast access
        self.entities: Dict[str, Entity] = {}
        self.relationships: Dict[str, Relationship] = {}
        self.projects: Dict[str, Project] = {}
        
        # Load existing data
        self._load_metadata()
        self._ensure_default_project()
        
        # Initialize retriever if video exists
        self.retriever = None
        if self.video_path.exists() and self.index_path.exists():
            try:
                if MEMVID_AVAILABLE:
                    self.retriever = MemvidRetriever(str(self.video_path), str(self.index_path))
                logging.info(f"✅ Loaded existing knowledge graph: {len(self.entities)} entities, {len(self.relationships)} relationships")
            except Exception as e:
                logging.warning(f"⚠️  Could not load existing memvid: {e}")

    def _ensure_default_project(self):
        """Ensure default project exists"""
        if "default" not in self.projects:
            self.projects["default"] = Project(
                id="default",
                name="Default Project",
                description="Default project for entities without specific project assignment",
                createdAt=datetime.now().isoformat()
            )

    def _load_metadata(self):
        """Load entities, relationships, and projects from metadata file"""
        if not self.metadata_path.exists():
            return
            
        try:
            with open(self.metadata_path, 'r') as f:
                data = json.load(f)
                
            # Load entities
            for entity_data in data.get('entities', []):
                entity = Entity(**entity_data)
                self.entities[entity.id] = entity
                
            # Load relationships  
            for rel_data in data.get('relationships', []):
                relationship = Relationship(**rel_data)
                self.relationships[relationship.id] = relationship
                
            # Load projects
            for proj_data in data.get('projects', []):
                project = Project(**proj_data)
                self.projects[project.id] = project
                
        except Exception as e:
            logging.warning(f"⚠️  Error loading metadata: {e}")

    def _save_metadata(self):
        """Save current entities, relationships, and projects to metadata file"""
        try:
            data = {
                'entities': [entity.dict() for entity in self.entities.values()],
                'relationships': [rel.dict() for rel in self.relationships.values()],
                'projects': [proj.dict() for proj in self.projects.values()],
                'updated_at': datetime.now().isoformat()
            }
            
            with open(self.metadata_path, 'w') as f:
                json.dump(data, f, indent=2)
                
        except Exception as e:
            logging.warning(f"⚠️  Error saving metadata: {e}")

    async def _rebuild_video(self):
        """Rebuild the memvid video with current data"""
        if not MEMVID_AVAILABLE:
            logging.warning("⚠️  Memvid not available, skipping video rebuild")
            return
            
        try:
            encoder = MemvidEncoder()
            
            # Add entities to video
            for entity in self.entities.values():
                entity_text = f"""Entity: {entity.name} ({entity.type})
Project: {entity.projectId}
Description: {entity.description}
Added by: {entity.addedBy}
Created: {entity.createdAt}

Observations:
{chr(10).join([f"- {obs.get('text', '')} (by {obs.get('addedBy', 'unknown')})" for obs in entity.observations])}
"""
                
                metadata = {
                    'id': entity.id,
                    'type': 'entity',
                    'entity_type': entity.type,
                    'project_id': entity.projectId,
                    'added_by': entity.addedBy,
                    'created_at': entity.createdAt
                }
                
                encoder.add_chunk(entity_text, metadata)
            
            # Add relationships to video
            for relationship in self.relationships.values():
                rel_text = f"""Relationship: {relationship.type}
From: {relationship.sourceId} 
To: {relationship.targetId}
Project: {relationship.projectId}
Description: {relationship.description or 'No description'}
Added by: {relationship.addedBy}
Created: {relationship.createdAt}
"""
                
                metadata = {
                    'id': relationship.id,
                    'type': 'relationship',
                    'relationship_type': relationship.type,
                    'source_id': relationship.sourceId,
                    'target_id': relationship.targetId,
                    'project_id': relationship.projectId,
                    'added_by': relationship.addedBy,
                    'created_at': relationship.createdAt
                }
                
                encoder.add_chunk(rel_text, metadata)
            
            # Build the video
            await encoder.build_video(str(self.video_path), str(self.index_path))
            
            # Reload retriever
            self.retriever = MemvidRetriever(str(self.video_path), str(self.index_path))
            
            logging.info(f"✅ Rebuilt memvid: {len(self.entities)} entities, {len(self.relationships)} relationships")
            
        except Exception as e:
            logging.error(f"❌ Error rebuilding video: {e}")

    # Entity Operations
    async def create_entity(self, entity: Entity) -> Entity:
        """Create a new entity"""
        entity.id = entity.id or str(uuid.uuid4())
        entity.createdAt = datetime.now().isoformat()
        entity.updatedAt = entity.createdAt
        
        self.entities[entity.id] = entity
        self._save_metadata()
        await self._rebuild_video()
        
        return entity

    async def get_entity(self, entity_id: str) -> Optional[Entity]:
        """Get entity by ID"""
        return self.entities.get(entity_id)

    async def list_entities(self, entity_type: Optional[str] = None, project_id: Optional[str] = None) -> List[Entity]:
        """List entities with optional filtering"""
        entities = list(self.entities.values())
        
        if entity_type:
            entities = [e for e in entities if e.type == entity_type]
        if project_id:
            entities = [e for e in entities if e.projectId == project_id]
            
        return entities

    async def update_entity(self, entity_id: str, updates: Dict[str, Any]) -> Optional[Entity]:
        """Update entity"""
        if entity_id not in self.entities:
            return None
            
        entity = self.entities[entity_id]
        
        # Update fields
        for key, value in updates.items():
            if hasattr(entity, key):
                setattr(entity, key, value)
        
        entity.updatedAt = datetime.now().isoformat()
        
        self._save_metadata()
        await self._rebuild_video()
        
        return entity

    async def delete_entity(self, entity_id: str) -> bool:
        """Delete entity and related relationships"""
        if entity_id not in self.entities:
            return False
            
        # Remove entity
        del self.entities[entity_id]
        
        # Remove related relationships
        to_remove = [rel_id for rel_id, rel in self.relationships.items() 
                    if rel.sourceId == entity_id or rel.targetId == entity_id]
        
        for rel_id in to_remove:
            del self.relationships[rel_id]
        
        self._save_metadata()
        await self._rebuild_video()
        
        return True

    async def add_observation(self, entity_id: str, text: str, added_by: str) -> Optional[str]:
        """Add observation to entity"""
        if entity_id not in self.entities:
            return None
            
        entity = self.entities[entity_id]
        observation_id = str(uuid.uuid4())
        
        observation = {
            'id': observation_id,
            'text': text,
            'addedBy': added_by,
            'createdAt': datetime.now().isoformat()
        }
        
        entity.observations.append(observation)
        entity.updatedAt = datetime.now().isoformat()
        
        self._save_metadata()
        await self._rebuild_video()
        
        return observation_id

    # Relationship Operations
    async def create_relationship(self, relationship: Relationship) -> Relationship:
        """Create a new relationship"""
        relationship.id = relationship.id or str(uuid.uuid4())
        relationship.createdAt = datetime.now().isoformat()
        
        self.relationships[relationship.id] = relationship
        self._save_metadata()
        await self._rebuild_video()
        
        return relationship

    async def list_relationships(self, project_id: Optional[str] = None) -> List[Relationship]:
        """List relationships"""
        relationships = list(self.relationships.values())
        
        if project_id:
            relationships = [r for r in relationships if r.projectId == project_id]
            
        return relationships

    async def delete_relationship(self, relationship_id: str) -> bool:
        """Delete relationship"""
        if relationship_id not in self.relationships:
            return False
            
        del self.relationships[relationship_id]
        self._save_metadata()
        await self._rebuild_video()
        
        return True

    # Search Operations
    async def search_entities(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search entities using memvid semantic search"""
        if not self.retriever:
            # Fallback to simple text search
            results = []
            query_lower = query.lower()
            
            for entity in self.entities.values():
                if (query_lower in entity.name.lower() or 
                    query_lower in entity.description.lower() or
                    any(query_lower in obs.get('text', '').lower() for obs in entity.observations)):
                    results.append(entity.dict())
                    
            return results[:limit]
        
        try:
            # Use memvid semantic search
            search_results = await self.retriever.search(query, limit)
            
            # Convert results to entity format
            results = []
            for result in search_results:
                # Extract entity ID from metadata
                if hasattr(result, 'metadata') and 'id' in result.metadata:
                    entity_id = result.metadata['id']
                    if entity_id in self.entities:
                        results.append(self.entities[entity_id].dict())
            
            return results
            
        except Exception as e:
            logging.warning(f"⚠️  Search error: {e}")
            return []

    # Project Operations
    async def create_project(self, project: Project) -> Project:
        """Create a new project"""
        project.id = project.id or str(uuid.uuid4())
        project.createdAt = datetime.now().isoformat()
        project.lastAccessed = project.createdAt
        
        self.projects[project.id] = project
        self._save_metadata()
        
        return project

    async def list_projects(self) -> List[Project]:
        """List all projects"""
        return list(self.projects.values())

    async def get_project(self, project_id: str) -> Optional[Project]:
        """Get project by ID"""
        return self.projects.get(project_id)

    async def delete_project(self, project_id: str) -> bool:
        """Delete project and all its entities/relationships"""
        if project_id not in self.projects:
            return False
        
        # Don't allow deleting default project
        if project_id == "default":
            return False
            
        # Remove project
        del self.projects[project_id]
        
        # Remove entities in this project
        entities_to_remove = [eid for eid, e in self.entities.items() if e.projectId == project_id]
        for eid in entities_to_remove:
            del self.entities[eid]
        
        # Remove relationships in this project
        rels_to_remove = [rid for rid, r in self.relationships.items() if r.projectId == project_id]
        for rid in rels_to_remove:
            del self.relationships[rid]
        
        self._save_metadata()
        await self._rebuild_video()
        
        return True

    async def get_stats(self) -> Dict[str, Any]:
        """Get overall statistics"""
        return {
            'entities': len(self.entities),
            'relationships': len(self.relationships), 
            'projects': len(self.projects),
            'memvid_available': MEMVID_AVAILABLE,
            'video_exists': self.video_path.exists(),
            'index_exists': self.index_path.exists()
        }

# Global instance
kg = MemvidKnowledgeGraph()

# API Endpoints
@app.get("/")
async def root():
    """Health check endpoint"""
    stats = await kg.get_stats()
    return {
        "service": "Memvid Knowledge Graph Service",
        "status": "running",
        "memvid_available": MEMVID_AVAILABLE,
        **stats
    }

@app.get("/health")
async def health():
    """Detailed health check"""
    return await kg.get_stats()

# Entity Endpoints
@app.post("/api/entities", response_model=Entity)
async def create_entity(entity: Entity):
    """Create a new entity"""
    return await kg.create_entity(entity)

@app.get("/api/entities/{entity_id}")
async def get_entity(entity_id: str):
    """Get entity by ID"""
    entity = await kg.get_entity(entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return entity

@app.get("/api/entities")
async def list_entities(
    type: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None)
):
    """List entities with optional filtering"""
    return await kg.list_entities(type, project_id)

@app.put("/api/entities/{entity_id}")
async def update_entity(entity_id: str, updates: Dict[str, Any]):
    """Update entity"""
    entity = await kg.update_entity(entity_id, updates)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return entity

@app.delete("/api/entities/{entity_id}")
async def delete_entity(entity_id: str):
    """Delete entity"""
    success = await kg.delete_entity(entity_id)
    if not success:
        raise HTTPException(status_code=404, detail="Entity not found")
    return {"success": True}

@app.post("/api/entities/{entity_id}/observations")
async def add_observation(entity_id: str, observation: Observation):
    """Add observation to entity"""
    obs_id = await kg.add_observation(entity_id, observation.text, observation.addedBy)
    if not obs_id:
        raise HTTPException(status_code=404, detail="Entity not found")
    return {"observation_id": obs_id}

# Relationship Endpoints  
@app.post("/api/relationships", response_model=Relationship)
async def create_relationship(relationship: Relationship):
    """Create a new relationship"""
    return await kg.create_relationship(relationship)

@app.get("/api/relationships")
async def list_relationships(project_id: Optional[str] = Query(None)):
    """List relationships"""
    return await kg.list_relationships(project_id)

@app.delete("/api/relationships/{relationship_id}")
async def delete_relationship(relationship_id: str):
    """Delete relationship"""
    success = await kg.delete_relationship(relationship_id)
    if not success:
        raise HTTPException(status_code=404, detail="Relationship not found")
    return {"success": True}

# Search Endpoints
@app.get("/api/search")
async def search_entities(
    q: str = Query(..., description="Search query"),
    limit: int = Query(10, description="Maximum results")
):
    """Search entities using semantic search"""
    results = await kg.search_entities(q, limit)
    return {
        "query": q,
        "entities": results,
        "count": len(results)
    }

# Project Endpoints
@app.post("/api/projects", response_model=Project)
async def create_project(project: Project):
    """Create a new project"""
    return await kg.create_project(project)

@app.get("/api/projects")
async def list_projects():
    """List all projects"""
    return await kg.list_projects()

@app.get("/api/projects/{project_id}")
async def get_project(project_id: str):
    """Get project by ID"""
    project = await kg.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: str):
    """Delete project"""
    success = await kg.delete_project(project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found or cannot delete default project")
    return {"success": True}

def main():
    """Main function to run the service"""
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    
    logging.info(f"Starting Memvid service on http://{host}:{port}")
    
    uvicorn.run(
        "__main__:app",
        host=host,
        port=port,
        reload=True, # Set to False in production
        log_level="info"
    )

if __name__ == "__main__":
    main()
