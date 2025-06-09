"""
Validation utilities for the MCP Knowledge Graph service.
"""

import uuid
import re
from typing import Dict, Any, Optional, List
from fastapi import HTTPException

from ..models.schema import Entity, Project, Relationship, validate_non_empty_string


def validate_uuid(value: str) -> bool:
    """Validate that a string is a valid UUID."""
    try:
        uuid.UUID(value)
        return True
    except ValueError:
        return False


def validate_project_id(project_id: str, projects: Dict[str, Project]) -> str:
    """Validate project ID and ensure project exists."""
    if not project_id:
        raise HTTPException(status_code=400, detail="Project ID is required")
    
    if project_id not in projects:
        raise HTTPException(
            status_code=404, 
            detail=f"Project '{project_id}' not found. Create the project first."
        )
    
    return project_id


def validate_entity_id(entity_id: str, entities: Dict[str, Entity]) -> str:
    """Validate entity ID and ensure entity exists."""
    if not entity_id:
        raise HTTPException(status_code=400, detail="Entity ID is required")
    
    if entity_id not in entities:
        raise HTTPException(
            status_code=404,
            detail=f"Entity '{entity_id}' not found"
        )
    
    return entity_id


def validate_entity_creation(entity_data: Dict[str, Any], projects: Dict[str, Project]) -> Dict[str, Any]:
    """Validate entity creation data."""
    # Validate required fields
    if not entity_data.get("name", "").strip():
        raise HTTPException(status_code=400, detail="Entity name is required and cannot be empty")
    
    if not entity_data.get("type", "").strip():
        raise HTTPException(status_code=400, detail="Entity type is required and cannot be empty")
    
    if not entity_data.get("description", "").strip():
        raise HTTPException(status_code=400, detail="Entity description is required and cannot be empty")
    
    if not entity_data.get("addedBy", "").strip():
        raise HTTPException(status_code=400, detail="addedBy field is required and cannot be empty")
    
    # Validate project ID if provided
    project_id = entity_data.get("projectId", "default")
    if project_id != "default":
        validate_project_id(project_id, projects)
    
    # Clean data
    entity_data["name"] = entity_data["name"].strip()
    entity_data["type"] = entity_data["type"].strip()
    entity_data["description"] = entity_data["description"].strip()
    entity_data["addedBy"] = entity_data["addedBy"].strip()
    entity_data["projectId"] = project_id
    
    return entity_data


def validate_relationship_creation(rel_data: Dict[str, Any], entities: Dict[str, Entity], projects: Dict[str, Project]) -> Dict[str, Any]:
    """Validate relationship creation data."""
    # Validate required fields
    if not rel_data.get("sourceId", "").strip():
        raise HTTPException(status_code=400, detail="sourceId is required and cannot be empty")
    
    if not rel_data.get("targetId", "").strip():
        raise HTTPException(status_code=400, detail="targetId is required and cannot be empty")
    
    if not rel_data.get("type", "").strip():
        raise HTTPException(status_code=400, detail="Relationship type is required and cannot be empty")
    
    if not rel_data.get("addedBy", "").strip():
        raise HTTPException(status_code=400, detail="addedBy field is required and cannot be empty")
    
    # Validate that entities exist
    source_id = rel_data["sourceId"].strip()
    target_id = rel_data["targetId"].strip()
    
    validate_entity_id(source_id, entities)
    validate_entity_id(target_id, entities)
    
    # Prevent self-relationships
    if source_id == target_id:
        raise HTTPException(status_code=400, detail="Entity cannot have a relationship with itself")
    
    # Validate project ID if provided
    project_id = rel_data.get("projectId", "default")
    if project_id != "default":
        validate_project_id(project_id, projects)
    
    # Clean data
    rel_data["sourceId"] = source_id
    rel_data["targetId"] = target_id
    rel_data["type"] = rel_data["type"].strip()
    rel_data["addedBy"] = rel_data["addedBy"].strip()
    rel_data["projectId"] = project_id
    
    if rel_data.get("description"):
        rel_data["description"] = rel_data["description"].strip()
    
    return rel_data


def validate_observation_creation(obs_data: Dict[str, Any], entities: Dict[str, Entity]) -> Dict[str, Any]:
    """Validate observation creation data."""
    # Validate required fields
    if not obs_data.get("entityId", "").strip():
        raise HTTPException(status_code=400, detail="entityId is required and cannot be empty")
    
    if not obs_data.get("text", "").strip():
        raise HTTPException(status_code=400, detail="Observation text is required and cannot be empty")
    
    if not obs_data.get("addedBy", "").strip():
        raise HTTPException(status_code=400, detail="addedBy field is required and cannot be empty")
    
    # Validate that entity exists
    entity_id = obs_data["entityId"].strip()
    validate_entity_id(entity_id, entities)
    
    # Clean data
    obs_data["entityId"] = entity_id
    obs_data["text"] = obs_data["text"].strip()
    obs_data["addedBy"] = obs_data["addedBy"].strip()
    
    return obs_data


def validate_project_creation(project_data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate project creation data."""
    # Validate required fields
    if not project_data.get("name", "").strip():
        raise HTTPException(status_code=400, detail="Project name is required and cannot be empty")
    
    # Clean data
    project_data["name"] = project_data["name"].strip()
    
    if project_data.get("description"):
        project_data["description"] = project_data["description"].strip()
    
    return project_data


def validate_search_params(query: str, limit: int = 10, max_limit: int = 100) -> tuple[str, int]:
    """Validate search parameters."""
    if not query or not query.strip():
        raise HTTPException(status_code=400, detail="Search query is required and cannot be empty")
    
    if limit < 1:
        raise HTTPException(status_code=400, detail="Limit must be at least 1")
    
    if limit > max_limit:
        raise HTTPException(status_code=400, detail=f"Limit cannot exceed {max_limit}")
    
    return query.strip(), limit


def validate_duplicate_entity(entity_data: Dict[str, Any], entities: Dict[str, Entity]) -> None:
    """Check for potential duplicate entities."""
    name = entity_data["name"].lower()
    entity_type = entity_data["type"].lower()
    project_id = entity_data["projectId"]
    
    for existing_entity in entities.values():
        if (existing_entity.name.lower() == name and 
            existing_entity.type.lower() == entity_type and 
            existing_entity.projectId == project_id):
            raise HTTPException(
                status_code=409, 
                detail=f"Entity '{entity_data['name']}' of type '{entity_data['type']}' already exists in project '{project_id}'"
            )


def validate_duplicate_relationship(rel_data: Dict[str, Any], relationships: Dict[str, Relationship]) -> None:
    """Check for duplicate relationships."""
    source_id = rel_data["sourceId"]
    target_id = rel_data["targetId"]
    rel_type = rel_data["type"].lower()
    project_id = rel_data["projectId"]
    
    for existing_rel in relationships.values():
        if (existing_rel.sourceId == source_id and
            existing_rel.targetId == target_id and
            existing_rel.type.lower() == rel_type and
            existing_rel.projectId == project_id):
            raise HTTPException(
                status_code=409,
                detail=f"Relationship '{rel_data['type']}' between these entities already exists in project '{project_id}'"
            )