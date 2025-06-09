"""
Relationship API routes with comprehensive validation.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from ..models.schema import Relationship
from ..utils.validators import (
    validate_relationship_creation,
    validate_duplicate_relationship,
    validate_project_id
)

router = APIRouter(prefix="/api/relationships", tags=["relationships"])


def setup_relationship_routes(kg):
    """Setup relationship routes with dependency injection."""
    
    @router.post("", response_model=Relationship)
    async def create_relationship(relationship: Relationship):
        """Create a new relationship with validation."""
        # Convert to dict for validation
        rel_data = relationship.model_dump()
        
        # Validate and clean data
        rel_data = validate_relationship_creation(rel_data, kg.entities, kg.projects)
        
        # Check for duplicates
        validate_duplicate_relationship(rel_data, kg.relationships)
        
        # Create validated relationship
        validated_relationship = Relationship(**rel_data)
        new_relationship = await kg.create_relationship(validated_relationship)
        return new_relationship

    @router.get("")
    async def list_relationships(
        project_id: Optional[str] = Query(None, description="Filter by project ID"),
        type: Optional[str] = Query(None, description="Filter by relationship type"),
        entity_id: Optional[str] = Query(None, description="Filter by entity involvement")
    ):
        """List relationships with optional filtering and validation."""
        # Validate project_id if provided
        if project_id and project_id != "default":
            validate_project_id(project_id, kg.projects)
        
        # Validate entity_id if provided
        if entity_id:
            from ..utils.validators import validate_entity_id
            validate_entity_id(entity_id, kg.entities)
        
        # Filter relationships
        relationships = list(kg.relationships.values())
        
        if project_id:
            relationships = [r for r in relationships if r.projectId == project_id]
            
        if type:
            relationships = [r for r in relationships if r.type.lower() == type.lower()]
            
        if entity_id:
            relationships = [r for r in relationships if r.sourceId == entity_id or r.targetId == entity_id]
            
        return relationships

    @router.delete("/{relationship_id}")
    async def delete_relationship(relationship_id: str):
        """Delete relationship with validation."""
        if not relationship_id or not relationship_id.strip():
            raise HTTPException(status_code=400, detail="Relationship ID is required")
        
        if relationship_id not in kg.relationships:
            raise HTTPException(status_code=404, detail="Relationship not found")
        
        success = await kg.delete_relationship(relationship_id)
        if not success:
            raise HTTPException(status_code=404, detail="Relationship not found")
        return {"success": True}

    return router