"""
MCP Knowledge Graph Service - Modular Architecture

A FastAPI-based service for memvid-integrated knowledge graph storage and retrieval
with comprehensive validation, search capabilities, and analytics.

Architecture:
- app.models: Pydantic data models with validation
- app.core: Core KnowledgeGraph class with memvid integration  
- app.api: Modular API routes with validation
- app.config: Configuration and settings management
- app.utils: Validation utilities and helpers

Key Features:
-  Comprehensive input validation
-  Duplicate detection and prevention
-  Project-scoped operations
-  Enhanced search with relevance scoring
-  Observation management and search
-  Analytics and statistics
-  Memvid video-based storage
-  Modular, maintainable codebase
"""

from .models import Entity, Relationship, Project, Observation, AIQueryRequest
from .core import MemvidKnowledgeGraph
from .config import settings, setup_logging, get_memvid_availability

__version__ = "2.0.0"
__author__ = "MCP Knowledge Graph Team"

__all__ = [
    "Entity",
    "Relationship", 
    "Project",
    "Observation",
    "AIQueryRequest",
    "MemvidKnowledgeGraph",
    "settings",
    "setup_logging",
    "get_memvid_availability"
]