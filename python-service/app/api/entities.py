"""
Entity API routes with comprehensive validation.
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query

from ..models.schema import Entity, Observation
from ..utils.validators import (
    validate_entity_creation,
    validate_observation_creation,
    validate_duplicate_entity,
    validate_entity_id
)

router = APIRouter(prefix="/api/entities", tags=["entities"])


def setup_entity_routes(kg):
    """Setup entity routes with dependency injection of knowledge graph."""
    
    @router.post("", response_model=Entity)
    async def create_entity(entity: Entity):
        """Create a new entity with validation."""
        # Convert to dict for validation
        entity_data = entity.model_dump()
        
        # Validate and clean data
        entity_data = validate_entity_creation(entity_data, kg.projects)
        
        # Check for duplicates
        validate_duplicate_entity(entity_data, kg.entities)
        
        # Create validated entity
        validated_entity = Entity(**entity_data)
        new_entity = await kg.create_entity(validated_entity)
        return new_entity

    @router.get("/{entity_id}")
    async def get_entity(entity_id: str):
        """Get entity by ID with validation."""
        validate_entity_id(entity_id, kg.entities)
        entity = await kg.get_entity(entity_id)
        return entity

    @router.get("")
    async def list_entities(
        type: Optional[str] = Query(None, description="Filter by entity type"),
        project_id: Optional[str] = Query(None, description="Filter by project ID")
    ):
        """List all entities with optional filtering."""
        # Validate project_id if provided
        if project_id and project_id != "default":
            from ..utils.validators import validate_project_id
            validate_project_id(project_id, kg.projects)
        
        entities = await kg.list_entities(entity_type=type, project_id=project_id)
        return entities

    @router.put("/{entity_id}")
    async def update_entity(entity_id: str, updates: Dict[str, Any]):
        """Update entity with validation."""
        validate_entity_id(entity_id, kg.entities)
        
        # Validate update fields
        allowed_fields = {"name", "type", "description", "projectId"}
        invalid_fields = set(updates.keys()) - allowed_fields
        if invalid_fields:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid fields: {invalid_fields}. Allowed: {allowed_fields}"
            )
        
        # Validate non-empty strings
        for field, value in updates.items():
            if field in {"name", "type", "description"} and value is not None:
                if not isinstance(value, str) or not value.strip():
                    raise HTTPException(
                        status_code=400, 
                        detail=f"{field} must be a non-empty string"
                    )
                updates[field] = value.strip()
        
        # Validate project ID if being updated
        if "projectId" in updates and updates["projectId"] != "default":
            from ..utils.validators import validate_project_id
            validate_project_id(updates["projectId"], kg.projects)
        
        entity = await kg.update_entity(entity_id, updates)
        if not entity:
            raise HTTPException(status_code=404, detail="Entity not found")
        return entity

    @router.delete("/{entity_id}")
    async def delete_entity(entity_id: str):
        """Delete entity with validation."""
        validate_entity_id(entity_id, kg.entities)
        success = await kg.delete_entity(entity_id)
        if not success:
            raise HTTPException(status_code=404, detail="Entity not found")
        return {"success": True}

    @router.post("/{entity_id}/observations")
    async def add_observation(entity_id: str, observation: Observation):
        """Add observation to entity with validation."""
        # Validate observation data
        obs_data = observation.model_dump()
        obs_data["entityId"] = entity_id  # Ensure consistency
        obs_data = validate_observation_creation(obs_data, kg.entities)
        
        obs_id = await kg.add_observation(entity_id, obs_data["text"], obs_data["addedBy"])
        if not obs_id:
            raise HTTPException(status_code=404, detail="Entity not found")
        return {"observation_id": obs_id}

    return router