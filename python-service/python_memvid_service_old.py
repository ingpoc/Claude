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
        def add_chunks(self, text, metadata): pass
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
            
            # Collect all text chunks
            chunks = []
            
            # Add entities to chunks
            for entity in self.entities.values():
                entity_text = f"""Entity: {entity.name} ({entity.type})
Project: {entity.projectId}
Description: {entity.description}
Added by: {entity.addedBy}
Created: {entity.createdAt}

Observations:
{chr(10).join([f"- {obs.get('text', '')} (by {obs.get('addedBy', 'unknown')})" for obs in entity.observations])}
"""
                chunks.append(entity_text)
            
            # Add relationships to chunks
            for relationship in self.relationships.values():
                rel_text = f"""Relationship: {relationship.type}
From: {relationship.sourceId} 
To: {relationship.targetId}
Project: {relationship.projectId}
Description: {relationship.description or 'No description'}
Added by: {relationship.addedBy}
Created: {relationship.createdAt}
"""
                chunks.append(rel_text)
            
            # Add all chunks at once
            if chunks:
                encoder.add_chunks(chunks)
            
            # Build the video (not async)
            encoder.build_video(str(self.video_path), str(self.index_path))
            
            # Reload retriever
            self.retriever = MemvidRetriever(str(self.video_path), str(self.index_path))
            
            logging.info(f"✅ Rebuilt memvid: {len(self.entities)} entities, {len(self.relationships)} relationships")
            
        except Exception as e:
            logging.error(f"❌ Error rebuilding video: {e}")
            import traceback
            traceback.print_exc()

    # Entity Operations
    async def create_entity(self, entity: Entity) -> Entity:
        """Create a new entity"""
        entity.id = entity.id or str(uuid.uuid4())
        entity.createdAt = datetime.now().isoformat()
        entity.updatedAt = entity.createdAt
        
        self.entities[entity.id] = entity
        self._save_metadata()
        
        # We need to rebuild the video so the new entity is searchable
        await self._rebuild_video()
        
        return entity

    async def get_entity(self, entity_id: str) -> Optional[Entity]:
        """Get a single entity by its ID"""
        return self.entities.get(entity_id)

    async def list_entities(self, entity_type: Optional[str] = None, project_id: Optional[str] = None) -> List[Entity]:
        """List all entities, optionally filtering by type or project"""
        entities_list = list(self.entities.values())
        
        if entity_type:
            entities_list = [e for e in entities_list if e.type == entity_type]
            
        if project_id:
            entities_list = [e for e in entities_list if e.projectId == project_id]
            
        return entities_list

    async def update_entity(self, entity_id: str, updates: Dict[str, Any]) -> Optional[Entity]:
        """Update an existing entity"""
        entity = self.entities.get(entity_id)
        if not entity:
            return None
            
        for key, value in updates.items():
            if hasattr(entity, key):
                setattr(entity, key, value)
                
        entity.updatedAt = datetime.now().isoformat()
        self.entities[entity_id] = entity
        self._save_metadata()
        
        await self._rebuild_video()
        return entity

    async def delete_entity(self, entity_id: str) -> bool:
        """Delete an entity and its relationships"""
        if entity_id not in self.entities:
            return False
            
        # Delete entity
        del self.entities[entity_id]
        
        # Delete related relationships
        rels_to_delete = [
            rel_id for rel_id, rel in self.relationships.items() 
            if rel.sourceId == entity_id or rel.targetId == entity_id
        ]
        for rel_id in rels_to_delete:
            del self.relationships[rel_id]
            
        self._save_metadata()
        await self._rebuild_video()
        return True

    async def add_observation(self, entity_id: str, text: str, added_by: str) -> Optional[str]:
        """Add an observation to an entity"""
        entity = self.entities.get(entity_id)
        if not entity:
            return None
        
        # Generate truly unique observation ID using timestamp and random
        timestamp = int(datetime.now().timestamp() * 1000000)  # microseconds
        random_suffix = uuid.uuid4().hex[:8]
        observation_id = f"obs_{timestamp}_{random_suffix}"
        
        new_observation = {
            "id": observation_id,
            "text": text,
            "addedBy": added_by,
            "createdAt": datetime.now().isoformat()
        }
        
        entity.observations.append(new_observation)
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


    async def delete_relationship(self, relationship_id: str) -> bool:
        """Delete a relationship"""
        if relationship_id in self.relationships:
            del self.relationships[relationship_id]
            self._save_metadata()
            await self._rebuild_video()
            return True
        return False

    async def search_entities(self, query: str, limit: int = 10, project_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Enhanced semantic search with mem0-inspired relevance scoring"""
        # Use hybrid approach: memvid + text matching
        if not self.retriever:
            # Enhanced fallback search with relevance scoring
            results = []
            query_lower = query.lower()
            query_words = set(query_lower.split())
            
            for entity in self.entities.values():
                # Filter by project if specified
                if project_id and entity.projectId != project_id:
                    continue
                    
                # Calculate relevance score
                score = 0.0
                entity_text = f"{entity.name} {entity.description} {' '.join([obs.get('text', '') for obs in entity.observations])}"
                entity_words = set(entity_text.lower().split())
                
                # Word overlap scoring
                common_words = query_words.intersection(entity_words)
                if common_words:
                    score += len(common_words) / len(query_words) * 0.6
                
                # Exact phrase matching
                if query_lower in entity.name.lower():
                    score += 0.3
                elif query_lower in entity.description.lower():
                    score += 0.2
                elif any(query_lower in obs.get('text', '').lower() for obs in entity.observations):
                    score += 0.1
                
                if score > 0:
                    entity_dict = entity.model_dump()
                    entity_dict['_relevance_score'] = score
                    results.append(entity_dict)
            
            # Sort by relevance score
            results.sort(key=lambda x: x['_relevance_score'], reverse=True)
            return results[:limit]
        
        try:
            # Use text-based search ONLY - memvid was adding noise
            results = []
            query_lower = query.lower()
            query_words = set(query_lower.split())
            
            for entity in self.entities.values():
                # Filter by project if specified
                if project_id and entity.projectId != project_id:
                    continue
                    
                # Calculate relevance score using STRICT matching
                score = 0.0
                entity_text = f"{entity.name} {entity.description} {' '.join([obs.get('text', '') for obs in entity.observations])}"
                entity_words = set(entity_text.lower().split())
                
                # Exact phrase matching (highest priority)
                if query_lower in entity.name.lower():
                    score += 1.0
                elif query_lower in entity.description.lower():
                    score += 0.8
                elif any(query_lower in obs.get('text', '').lower() for obs in entity.observations):
                    score += 0.6
                
                # Word overlap scoring (only if we have phrase matches)
                if score > 0:
                    common_words = query_words.intersection(entity_words)
                    if common_words:
                        score += len(common_words) / len(query_words) * 0.3
                
                # Only include results with meaningful scores (> 0.5)
                if score >= 0.5:
                    entity_dict = entity.model_dump()
                    entity_dict['_relevance_score'] = score
                    results.append(entity_dict)
            
            # Sort by relevance score
            results.sort(key=lambda x: x['_relevance_score'], reverse=True)
            return results[:limit]
            
        except Exception as e:
            logging.warning(f"⚠️  Memvid search error, falling back to text search: {e}")
            # Fall back to pure text search
            results = []
            query_lower = query.lower()
            query_words = set(query_lower.split())
            
            for entity in self.entities.values():
                # Filter by project if specified
                if project_id and entity.projectId != project_id:
                    continue
                    
                # Calculate relevance score
                score = 0.0
                entity_text = f"{entity.name} {entity.description} {' '.join([obs.get('text', '') for obs in entity.observations])}"
                entity_words = set(entity_text.lower().split())
                
                # Word overlap scoring
                common_words = query_words.intersection(entity_words)
                if common_words:
                    score += len(common_words) / len(query_words) * 0.6
                
                # Exact phrase matching
                if query_lower in entity.name.lower():
                    score += 0.3
                elif query_lower in entity.description.lower():
                    score += 0.2
                elif any(query_lower in obs.get('text', '').lower() for obs in entity.observations):
                    score += 0.1
                
                if score > 0:
                    entity_dict = entity.model_dump()
                    entity_dict['_relevance_score'] = score
                    results.append(entity_dict)
            
            # Sort by relevance score
            results.sort(key=lambda x: x['_relevance_score'], reverse=True)
            return results[:limit]

    async def get_relevant_memories(self, query: str, limit: int = 3, project_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """mem0-inspired: Get the most relevant memories for context injection"""
        search_results = await self.search_entities(query, limit, project_id)
        
        # Filter for high-relevance memories only
        relevant_memories = [
            result for result in search_results 
            if result.get('_relevance_score', 0) > 0.5
        ]
        
        return relevant_memories[:limit]

    # Relationship Querying
    async def find_related_entities(self, entity_id: str, direction: str = "both", 
                                  relationship_type: Optional[str] = None, 
                                  depth: int = 1, project_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Find entities related to a specific entity through relationships"""
        if entity_id not in self.entities:
            return []
        
        visited = set()
        results = []
        
        def traverse(current_entity_id: str, current_depth: int):
            if current_depth > depth or current_entity_id in visited:
                return
            
            visited.add(current_entity_id)
            
            for rel_id, rel in self.relationships.items():
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
                
                if target_entity_id and target_entity_id in self.entities:
                    target_entity = self.entities[target_entity_id]
                    
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

    async def list_relationships(self, project_id: Optional[str] = None, 
                               relationship_type: Optional[str] = None,
                               entity_id: Optional[str] = None) -> List[Relationship]:
        """List relationships with optional filtering"""
        relationships_list = list(self.relationships.values())
        
        if project_id:
            relationships_list = [r for r in relationships_list if r.projectId == project_id]
            
        if relationship_type:
            relationships_list = [r for r in relationships_list if r.type == relationship_type]
            
        if entity_id:
            relationships_list = [r for r in relationships_list if r.sourceId == entity_id or r.targetId == entity_id]
            
        return relationships_list

    # Project Operations
    async def create_project(self, project: Project) -> Project:
        """Create a new project"""
        project.id = project.id or str(uuid.uuid4())
        project.createdAt = datetime.now().isoformat()
        project.lastAccessed = project.createdAt
        
        self.projects[project.id] = project
        self._save_metadata()
        return project

    async def list_projects(self) -> List[Dict[str, Any]]:
        """List all projects with their stats"""
        project_list = []
        for project in self.projects.values():
            proj_dict = project.model_dump()
            
            # Calculate stats
            entity_count = sum(1 for e in self.entities.values() if e.projectId == project.id)
            relationship_count = sum(1 for r in self.relationships.values() if r.projectId == project.id)
            
            # Simple activity score
            activity_score = (entity_count * 2) + relationship_count
            
            proj_dict['entityCount'] = entity_count
            proj_dict['relationshipCount'] = relationship_count
            proj_dict['activityScore'] = activity_score
            
            project_list.append(proj_dict)
            
        return project_list

    async def get_project(self, project_id: str) -> Optional[Project]:
        """Get a single project by ID"""
        return self.projects.get(project_id)

    async def delete_project(self, project_id: str) -> bool:
        """Delete a project and all its contents"""
        if project_id not in self.projects:
            return False
        
        if project_id == "default":
            raise HTTPException(status_code=400, detail="Cannot delete the default project.")
            
        # Delete project
        del self.projects[project_id]
        
        # Delete associated entities
        entities_to_delete = [
            entity_id for entity_id, entity in self.entities.items()
            if entity.projectId == project_id
        ]
        for entity_id in entities_to_delete:
            del self.entities[entity_id]
            
        # Delete associated relationships
        rels_to_delete = [
            rel_id for rel_id, rel in self.relationships.items()
            if rel.projectId == project_id
        ]
        for rel_id in rels_to_delete:
            del self.relationships[rel_id]
            
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
    """Endpoint to list all entities, with optional filtering"""
    entities = await kg.list_entities(entity_type=type, project_id=project_id)
    return entities

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

@app.get("/api/observations/search")
async def search_observations(
    q: str = Query(..., description="Search query for observation content"),
    limit: int = Query(10, description="Maximum number of results"),
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    entity_id: Optional[str] = Query(None, description="Filter by specific entity ID"),
    added_by: Optional[str] = Query(None, description="Filter by who added the observation")
):
    """Search for observations across all entities"""
    results = await kg.search_observations(
        query=q,
        limit=limit,
        project_id=project_id,
        entity_id=entity_id,
        added_by=added_by
    )
    
    return results

@app.get("/api/analytics")
async def get_analytics(
    project_id: Optional[str] = Query(None, description="Filter analytics by project ID"),
    include_details: bool = Query(False, description="Include detailed analytics")
):
    """Get comprehensive analytics and statistics for the knowledge graph"""
    analytics = await kg.get_analytics(project_id=project_id, include_details=include_details)
    return analytics

# Relationship Endpoints  
@app.post("/api/relationships", response_model=Relationship)
async def create_relationship(relationship: Relationship):
    """Create a new relationship"""
    return await kg.create_relationship(relationship)

@app.get("/api/relationships")
async def list_relationships(
    project_id: Optional[str] = Query(None),
    type: Optional[str] = Query(None, alias="type"),
    entity_id: Optional[str] = Query(None)
):
    """List relationships with optional filtering"""
    return await kg.list_relationships(project_id, type, entity_id)

@app.get("/api/entities/{entity_id}/related")
async def find_related_entities(
    entity_id: str,
    direction: str = Query("both", regex="^(outgoing|incoming|both)$"),
    relationship_type: Optional[str] = Query(None),
    depth: int = Query(1, ge=1, le=3),
    project_id: Optional[str] = Query(None)
):
    """Find entities related to a specific entity through relationships"""
    if entity_id not in kg.entities:
        raise HTTPException(status_code=404, detail="Entity not found")
    
    related_entities = await kg.find_related_entities(
        entity_id=entity_id,
        direction=direction,
        relationship_type=relationship_type,
        depth=depth,
        project_id=project_id
    )
    
    return related_entities
        
        for entity in self.entities.values():
            # Filter by project if specified
            if project_id and entity.projectId != project_id:
                continue
            
            # Filter by entity if specified
            if entity_id and entity.id != entity_id:
                continue
            
            # Search through entity's observations
            for obs in entity.observations:
                # Filter by added_by if specified
                if added_by and obs.get('addedBy', '').lower() != added_by.lower():
                    continue
                
                obs_text = obs.get('text', '').lower()
                
                # Calculate relevance score
                score = 0.0
                
                # Exact phrase matching
                if query_lower in obs_text:
                    score += 0.6
                
                # Word overlap scoring
                obs_words = set(obs_text.split())
                common_words = query_words.intersection(obs_words)
                if common_words:
                    score += len(common_words) / len(query_words) * 0.4
                
                if score > 0:
                    results.append({
                        'id': obs.get('id', ''),
                        'text': obs.get('text', ''),
                        'addedBy': obs.get('addedBy', ''),
                        'createdAt': obs.get('createdAt', ''),
                        'entityId': entity.id,
                        'entity_name': entity.name,
                        'entity_type': entity.type,
                        'entity_description': entity.description,
                        'projectId': entity.projectId,
                        '_relevance_score': score
                    })
        
        # Sort by relevance score
        results.sort(key=lambda x: x['_relevance_score'], reverse=True)
        return results[:limit]

    # Analytics and Statistics
    async def get_analytics(self, project_id: Optional[str] = None, include_details: bool = False) -> Dict[str, Any]:
        """Get comprehensive analytics for the knowledge graph"""
        # Filter entities and relationships by project if specified
        entities = list(self.entities.values())
        relationships = list(self.relationships.values())
        
        if project_id:
            entities = [e for e in entities if e.projectId == project_id]
            relationships = [r for r in relationships if r.projectId == project_id]
        
        # Basic counts
        total_entities = len(entities)
        total_relationships = len(relationships)
        total_observations = sum(len(e.observations) for e in entities)
        total_projects = len(self.projects) if not project_id else 1
        
        # Entity type breakdown
        entity_types = {}
        for entity in entities:
            entity_types[entity.type] = entity_types.get(entity.type, 0) + 1
        
        # Relationship type breakdown
        relationship_types = {}
        for rel in relationships:
            relationship_types[rel.type] = relationship_types.get(rel.type, 0) + 1
        
        # Project statistics
        project_stats = []
        projects_to_analyze = [self.projects[project_id]] if project_id else self.projects.values()
        
        for project in projects_to_analyze:
            project_entities = [e for e in self.entities.values() if e.projectId == project.id]
            project_relationships = [r for r in self.relationships.values() if r.projectId == project.id]
            
            project_stats.append({
                'id': project.id,
                'name': project.name,
                'entity_count': len(project_entities),
                'relationship_count': len(project_relationships),
                'observation_count': sum(len(e.observations) for e in project_entities)
            })
        
        # Top contributors
        contributors = {}
        for entity in entities:
            name = entity.addedBy
            if name not in contributors:
                contributors[name] = {'entities': 0, 'observations': 0}
            contributors[name]['entities'] += 1
            contributors[name]['observations'] += len(entity.observations)
        
        # Add relationship contributions
        for rel in relationships:
            name = rel.addedBy
            if name not in contributors:
                contributors[name] = {'entities': 0, 'observations': 0}
            # Count relationships as half an entity for contribution scoring
            contributors[name]['entities'] += 0.5
        
        top_contributors = [
            {'name': name, 'entities': int(stats['entities']), 'observations': stats['observations']}
            for name, stats in sorted(contributors.items(), 
                                    key=lambda x: x[1]['entities'] + x[1]['observations'], 
                                    reverse=True)[:5]
        ]
        
        analytics = {
            'total_entities': total_entities,
            'total_relationships': total_relationships,
            'total_observations': total_observations,
            'total_projects': total_projects,
            'entity_types': entity_types,
            'relationship_types': relationship_types,
            'project_stats': project_stats,
            'top_contributors': top_contributors
        }
        
        if include_details:
            # Add more detailed analytics
            analytics['avg_observations_per_entity'] = total_observations / total_entities if total_entities > 0 else 0
            analytics['avg_relationships_per_entity'] = total_relationships / total_entities if total_entities > 0 else 0
            
            # Entity connectivity (how many relationships each entity has)
            entity_connectivity = {}
            for rel in relationships:
                entity_connectivity[rel.sourceId] = entity_connectivity.get(rel.sourceId, 0) + 1
                entity_connectivity[rel.targetId] = entity_connectivity.get(rel.targetId, 0) + 1
            
            if entity_connectivity:
                analytics['most_connected_entities'] = sorted(
                    [(entity_id, count) for entity_id, count in entity_connectivity.items()],
                    key=lambda x: x[1], reverse=True
                )[:5]
        
        return analytics

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
    limit: int = Query(10, description="Maximum results"),
    project_id: Optional[str] = Query(None, description="Project ID to search within")
):
    """Enhanced semantic search with relevance scoring"""
    results = await kg.search_entities(q, limit, project_id)
    return {
        "query": q,
        "entities": results,
        "count": len(results),
        "project_id": project_id
    }

@app.get("/api/memories")
async def get_relevant_memories(
    q: str = Query(..., description="Query for relevant memories"),
    limit: int = Query(3, description="Maximum relevant memories"),
    project_id: Optional[str] = Query(None, description="Project ID to search within")
):
    """mem0-inspired: Get relevant memories for context injection"""
    memories = await kg.get_relevant_memories(q, limit, project_id)
    return {
        "query": q,
        "memories": memories,
        "count": len(memories),
        "context_ready": True
    }

# Project Endpoints
@app.post("/api/projects", response_model=Project)
async def create_project(project: Project):
    """Create a new project"""
    new_project = await kg.create_project(project)
    return new_project

@app.get("/api/projects")
async def list_projects():
    """Endpoint to list all projects with stats"""
    projects_with_stats = await kg.list_projects()
    return projects_with_stats

@app.get("/api/projects/{project_id}")
async def get_project(project_id: str):
    """Get project by ID"""
    project = await kg.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: str):
    """Endpoint to delete a project and its contents"""
    success = await kg.delete_project(project_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Project with ID {project_id} not found.")
    return {"message": f"Project {project_id} and its contents deleted successfully."}

# AI Query Model
class AIQueryRequest(BaseModel):
    query: str
    project_id: Optional[str] = None
    ai_config: Dict[str, Any]
    include_context: bool = True
    max_results: int = 10

@app.post("/api/ai-query")
async def ai_query(request: AIQueryRequest):
    """AI-powered natural language query endpoint"""
    try:
        # Get project context
        project_entities = []
        project_relationships = []
        project_name = "your project"
        
        if request.project_id:
            project_entities = await kg.list_entities(project_id=request.project_id)
            project_relationships = await kg.list_relationships(project_id=request.project_id)
            project = await kg.get_project(request.project_id)
            if project:
                # Handle both dict and Pydantic model objects
                if hasattr(project, 'name'):
                    project_name = project.name
                elif isinstance(project, dict):
                    project_name = project.get("name", "your project")
                else:
                    project_name = "your project"
        
        # Search for relevant entities
        search_results = await kg.search_entities(
            query=request.query,
            limit=request.max_results,
            project_id=request.project_id
        )
        
        # Extract AI config
        ai_config = request.ai_config
        logging.info(f"Received AI config: enabled={ai_config.get('enabled')}, has_api_key={bool(ai_config.get('config', {}).get('apiKey'))}")
        
        if not ai_config.get("enabled"):
            return {
                "success": False,
                "error": "AI features are disabled in settings",
                "query": request.query,
                "timestamp": datetime.now().isoformat()
            }
            
        if not ai_config.get("config", {}).get("apiKey"):
            return {
                "success": False,
                "error": "OpenRouter API key not configured in settings",
                "query": request.query,
                "timestamp": datetime.now().isoformat()
            }
        
        # Import requests for OpenRouter API call
        try:
            import requests
        except ImportError:
            logging.error("requests library not installed. Install with: pip install requests")
            return {
                "success": False,
                "error": "requests library not available for AI processing",
                "query": request.query,
                "timestamp": datetime.now().isoformat()
            }
        
        # Create context for AI
        context_info = f"""You are an AI assistant helping users understand their knowledge graph project "{project_name}".

Project Statistics:
- Total entities: {len(project_entities)}
- Total relationships: {len(project_relationships)}
- Entity types: {', '.join(set(e.type for e in project_entities))}

Search Results for "{request.query}":
{chr(10).join(f"{i+1}. {e.get('name', 'Unknown')} ({e.get('type', 'unknown')}): {e.get('description', 'No description')}" for i, e in enumerate(search_results[:5]))}

User Question: {request.query}

Provide a helpful, conversational response about the search results and knowledge graph. Be specific about the entities found and suggest follow-up actions. Keep it concise but informative."""
        
        # Call OpenRouter API
        try:
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {ai_config['config']['apiKey']}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost:3000",
                    "X-Title": "MCP Knowledge Graph"
                },
                json={
                    "model": ai_config["config"].get("model", "meta-llama/llama-3.2-3b-instruct:free"),
                    "messages": [{"role": "user", "content": context_info}],
                    "max_tokens": min(ai_config["config"].get("maxTokens", 2048), 1000),
                    "temperature": ai_config["config"].get("temperature", 0.7)
                },
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                ai_message = result.get("choices", [{}])[0].get("message", {}).get("content", "Sorry, I couldn't generate a response.")
                
                return {
                    "success": True,
                    "response": ai_message,
                    "query": request.query,
                    "entities": [e.get("name", "Unknown") for e in search_results[:5]],
                    "confidence": 0.9,
                    "queryType": "ai_processed",
                    "timestamp": datetime.now().isoformat(),
                    "project_context": {
                        "name": project_name,
                        "entity_count": len(project_entities),
                        "relationship_count": len(project_relationships)
                    }
                }
            elif response.status_code == 401:
                return {
                    "success": False,
                    "error": "Invalid API key. Please check your OpenRouter configuration.",
                    "query": request.query,
                    "timestamp": datetime.now().isoformat()
                }
            elif response.status_code == 429:
                return {
                    "success": False,
                    "error": "Rate limit exceeded. Please try again in a moment.",
                    "query": request.query,
                    "timestamp": datetime.now().isoformat()
                }
            else:
                return {
                    "success": False,
                    "error": f"AI service error: {response.status_code}",
                    "query": request.query,
                    "timestamp": datetime.now().isoformat()
                }
                
        except requests.exceptions.Timeout:
            return {
                "success": False,
                "error": "AI service timeout. Please try again.",
                "query": request.query,
                "timestamp": datetime.now().isoformat()
            }
        except requests.exceptions.RequestException as e:
            logging.error(f"AI API request failed: {e}")
            return {
                "success": False,
                "error": "Failed to connect to AI service",
                "query": request.query,
                "timestamp": datetime.now().isoformat()
            }
        
    except Exception as e:
        logging.error(f"AI query processing failed: {e}", exc_info=True)
        return {
            "success": False,
            "error": f"Internal server error during AI processing: {str(e)}",
            "query": request.query,
            "timestamp": datetime.now().isoformat()
        }

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
