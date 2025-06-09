"""
API routes for the MCP Knowledge Graph service.
"""

from .entities import setup_entity_routes
from .relationships import setup_relationship_routes  
from .projects import setup_project_routes
from .search import setup_search_routes

__all__ = [
    "setup_entity_routes",
    "setup_relationship_routes", 
    "setup_project_routes",
    "setup_search_routes"
]