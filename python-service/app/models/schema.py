"""
Pydantic data models for the MCP Knowledge Graph service.
"""

from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime


class Entity(BaseModel):
    """Entity model with validation."""
    id: Optional[str] = None
    name: str = Field(..., min_length=1, description="Entity name is required")
    type: str = Field(..., min_length=1, description="Entity type is required")
    description: str = Field(..., min_length=1, description="Entity description is required")
    observations: List[Dict[str, Any]] = Field(default_factory=list)
    addedBy: str = Field(..., min_length=1, description="Added by field is required")
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
    projectId: str = Field(default="default", description="Project ID")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Neural Networks",
                "type": "concept",
                "description": "Artificial neural networks for machine learning",
                "addedBy": "system",
                "projectId": "ai-project"
            }
        }


class Relationship(BaseModel):
    """Relationship model with validation."""
    id: Optional[str] = None
    sourceId: str = Field(..., min_length=1, description="Source entity ID is required")
    targetId: str = Field(..., min_length=1, description="Target entity ID is required")
    type: str = Field(..., min_length=1, description="Relationship type is required")
    description: Optional[str] = None
    addedBy: str = Field(..., min_length=1, description="Added by field is required")
    createdAt: Optional[str] = None
    projectId: str = Field(default="default", description="Project ID")

    class Config:
        json_schema_extra = {
            "example": {
                "sourceId": "entity-1",
                "targetId": "entity-2", 
                "type": "relates_to",
                "description": "Entity 1 relates to Entity 2",
                "addedBy": "system",
                "projectId": "default"
            }
        }


class Project(BaseModel):
    """Project model with validation."""
    id: Optional[str] = None
    name: str = Field(..., min_length=1, description="Project name is required")
    description: Optional[str] = None
    createdAt: Optional[str] = None
    lastAccessed: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "name": "AI Research Project",
                "description": "Machine learning and AI research data"
            }
        }


class Observation(BaseModel):
    """Observation model with validation."""
    entityId: str = Field(..., min_length=1, description="Entity ID is required")
    text: str = Field(..., min_length=1, description="Observation text is required")
    addedBy: str = Field(..., min_length=1, description="Added by field is required")

    class Config:
        json_schema_extra = {
            "example": {
                "entityId": "entity-1",
                "text": "This entity shows interesting behavior",
                "addedBy": "researcher"
            }
        }


class AIQueryRequest(BaseModel):
    """AI query request model."""
    query: str = Field(..., min_length=1, description="Query text is required")
    project_id: Optional[str] = None
    ai_config: Dict[str, Any] = Field(..., description="AI configuration is required")
    include_context: bool = Field(default=True)
    max_results: int = Field(default=10, ge=1, le=50)

    class Config:
        json_schema_extra = {
            "example": {
                "query": "What are neural networks?",
                "project_id": "ai-project",
                "ai_config": {
                    "enabled": True,
                    "config": {
                        "apiKey": "sk-...",
                        "model": "gpt-3.5-turbo",
                        "maxTokens": 1000,
                        "temperature": 0.7
                    }
                },
                "include_context": True,
                "max_results": 10
            }
        }


# Validation helper functions
def validate_project_exists(project_id: str, projects: Dict[str, Project]) -> bool:
    """Validate that a project exists."""
    return project_id in projects


def validate_entity_exists(entity_id: str, entities: Dict[str, Entity]) -> bool:
    """Validate that an entity exists."""
    return entity_id in entities


def validate_non_empty_string(value: str, field_name: str) -> str:
    """Validate that a string is not empty."""
    if not value or not value.strip():
        raise ValueError(f"{field_name} cannot be empty")
    return value.strip()