"""
Core KnowledgeGraph class with memvid integration.
"""

import json
import uuid
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path

from ..models.schema import Entity, Relationship, Project
from ..config.settings import settings, get_memvid_availability

# Set up logging
logger = logging.getLogger(__name__)

# Import memvid with fallback
MEMVID_AVAILABLE = get_memvid_availability()

if MEMVID_AVAILABLE:
    from memvid import MemvidEncoder, MemvidRetriever
else:
    # Mock classes for development
    class MemvidEncoder:
        def add_chunks(self, chunks): pass
        def build_video(self, video_path, index_path): pass
    
    class MemvidRetriever:
        def __init__(self, video_path, index_path): pass
        def search(self, query, limit=10): return []


class MemvidKnowledgeGraph:
    """
    Core knowledge graph class with memvid integration for video-based storage.
    """
    
    def __init__(self, storage_dir: Optional[str] = None):
        """Initialize the knowledge graph with storage."""
        self.storage_dir = Path(storage_dir or settings.STORAGE_DIR)
        self.storage_dir.mkdir(exist_ok=True)
        
        # File paths using settings
        self.video_path = settings.video_path
        self.index_path = settings.index_path
        self.metadata_path = settings.metadata_path
        
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
                logger.info(f"✅ Loaded existing knowledge graph: {len(self.entities)} entities, {len(self.relationships)} relationships")
            except Exception as e:
                logger.warning(f"⚠️ Could not load existing memvid: {e}")

    def _ensure_default_project(self):
        """Ensure default project exists."""
        if "default" not in self.projects:
            self.projects["default"] = Project(
                id="default",
                name="Default Project",
                description="Default project for entities without specific project assignment",
                createdAt=datetime.now().isoformat()
            )

    def _load_metadata(self):
        """Load entities, relationships, and projects from metadata file."""
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
            logger.warning(f"⚠️ Error loading metadata: {e}")

    def _save_metadata(self):
        """Save current entities, relationships, and projects to metadata file."""
        try:
            data = {
                'entities': [entity.model_dump() for entity in self.entities.values()],
                'relationships': [rel.model_dump() for rel in self.relationships.values()],
                'projects': [proj.model_dump() for proj in self.projects.values()],
                'updated_at': datetime.now().isoformat()
            }
            
            with open(self.metadata_path, 'w') as f:
                json.dump(data, f, indent=2)
                
        except Exception as e:
            logger.warning(f"⚠️ Error saving metadata: {e}")

    async def _rebuild_video(self):
        """Rebuild the memvid video with current data."""
        if not MEMVID_AVAILABLE:
            logger.warning("⚠️ Memvid not available, skipping video rebuild")
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
            
            logger.info(f"✅ Rebuilt memvid: {len(self.entities)} entities, {len(self.relationships)} relationships")
            
        except Exception as e:
            logger.error(f"❌ Error rebuilding video: {e}")
            import traceback
            traceback.print_exc()

    # Entity Operations
    async def create_entity(self, entity: Entity) -> Entity:
        """Create a new entity with validation."""
        entity.id = entity.id or str(uuid.uuid4())
        entity.createdAt = datetime.now().isoformat()
        entity.updatedAt = entity.createdAt
        
        self.entities[entity.id] = entity
        self._save_metadata()
        
        # Rebuild the video so the new entity is searchable
        await self._rebuild_video()
        
        return entity

    async def get_entity(self, entity_id: str) -> Optional[Entity]:
        """Get a single entity by its ID."""
        return self.entities.get(entity_id)

    async def list_entities(self, entity_type: Optional[str] = None, project_id: Optional[str] = None) -> List[Entity]:
        """List all entities, optionally filtering by type or project."""
        entities_list = list(self.entities.values())
        
        if entity_type:
            entities_list = [e for e in entities_list if e.type == entity_type]
            
        if project_id:
            entities_list = [e for e in entities_list if e.projectId == project_id]
            
        return entities_list

    async def update_entity(self, entity_id: str, updates: Dict[str, Any]) -> Optional[Entity]:
        """Update an existing entity."""
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
        """Delete an entity and its relationships."""
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

    # Relationship Operations
    async def create_relationship(self, relationship: Relationship) -> Relationship:
        """Create a new relationship."""
        relationship.id = relationship.id or str(uuid.uuid4())
        relationship.createdAt = datetime.now().isoformat()
        
        self.relationships[relationship.id] = relationship
        self._save_metadata()
        
        await self._rebuild_video()
        return relationship

    async def delete_relationship(self, relationship_id: str) -> bool:
        """Delete a relationship."""
        if relationship_id in self.relationships:
            del self.relationships[relationship_id]
            self._save_metadata()
            await self._rebuild_video()
            return True
        return False

    # Observation Operations
    async def add_observation(self, entity_id: str, text: str, added_by: str) -> Optional[str]:
        """Add an observation to an entity."""
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
        self.entities[entity_id] = entity
        self._save_metadata()
        await self._rebuild_video()
        return observation_id

    # Search Operations
    async def search_entities(self, query: str, limit: int = 10, project_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Enhanced search with strict relevance filtering."""
        # Use fallback text search only - memvid was adding noise
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
            # Use strict text-based search with high relevance threshold
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
                if score >= settings.MIN_RELEVANCE_SCORE:
                    entity_dict = entity.model_dump()
                    entity_dict['_relevance_score'] = score
                    results.append(entity_dict)
            
            # Sort by relevance score
            results.sort(key=lambda x: x['_relevance_score'], reverse=True)
            return results[:limit]
            
        except Exception as e:
            logger.warning(f"⚠️ Search error, falling back to text search: {e}")
            return []

    # Project Operations
    async def create_project(self, project: Project) -> Project:
        """Create a new project."""
        project.id = project.id or str(uuid.uuid4())
        project.createdAt = datetime.now().isoformat()
        project.lastAccessed = project.createdAt
        
        self.projects[project.id] = project
        self._save_metadata()
        return project

    async def get_project(self, project_id: str) -> Optional[Project]:
        """Get a single project by ID."""
        return self.projects.get(project_id)

    async def list_projects(self) -> List[Dict[str, Any]]:
        """List all projects with their stats."""
        project_list = []
        for project in self.projects.values():
            proj_dict = project.model_dump()
            
            # Add statistics
            project_entities = [e for e in self.entities.values() if e.projectId == project.id]
            project_relationships = [r for r in self.relationships.values() if r.projectId == project.id]
            
            entity_count = len(project_entities)
            relationship_count = len(project_relationships)
            activity_score = (entity_count * 2) + relationship_count
            
            proj_dict['entityCount'] = entity_count
            proj_dict['relationshipCount'] = relationship_count
            proj_dict['activityScore'] = activity_score
            
            project_list.append(proj_dict)
            
        return project_list

    async def delete_project(self, project_id: str) -> bool:
        """Delete a project and all its contents."""
        if project_id not in self.projects:
            return False
        
        if project_id == "default":
            raise ValueError("Cannot delete the default project.")
            
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
        """Get overall statistics."""
        return {
            'entities': len(self.entities),
            'relationships': len(self.relationships), 
            'projects': len(self.projects),
            'memvid_available': MEMVID_AVAILABLE,
            'video_exists': self.video_path.exists(),
            'index_exists': self.index_path.exists()
        }

    # Additional Search Methods
    async def search_observations(self, query: str, limit: int = 10, 
                                project_id: Optional[str] = None,
                                entity_id: Optional[str] = None,
                                added_by: Optional[str] = None) -> List[Dict[str, Any]]:
        """Search for observations across all entities."""
        results = []
        query_lower = query.lower()
        query_words = set(query_lower.split())
        
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
        """Get comprehensive analytics for the knowledge graph."""
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
                                    reverse=True)[:settings.TOP_CONTRIBUTORS_LIMIT]
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
                )[:settings.TOP_CONNECTED_ENTITIES_LIMIT]
        
        return analytics