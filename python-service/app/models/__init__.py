"""
Data models for the MCP Knowledge Graph service.
"""

from .schema import (
    Entity,
    Relationship, 
    Project,
    Observation,
    AIQueryRequest
)

__all__ = [
    "Entity",
    "Relationship", 
    "Project",
    "Observation",
    "AIQueryRequest"
]