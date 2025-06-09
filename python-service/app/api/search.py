"""
Search API routes with validation.
"""

from typing import Optional
from fastapi import APIRouter, Query

from ..utils.validators import validate_search_params, validate_project_id
from ..config.settings import settings

router = APIRouter(prefix="/api", tags=["search"])


def setup_search_routes(kg):
    """Setup search routes with dependency injection."""
    
    @router.get("/search")
    async def search_entities(
        q: str = Query(..., description="Search query"),
        limit: int = Query(10, description="Maximum results"),
        project_id: Optional[str] = Query(None, description="Project ID to search within")
    ):
        """Enhanced semantic search with validation and relevance scoring."""
        # Validate search parameters
        query, validated_limit = validate_search_params(q, limit, settings.MAX_SEARCH_LIMIT)
        
        # Validate project_id if provided
        if project_id and project_id != "default":
            validate_project_id(project_id, kg.projects)
        
        results = await kg.search_entities(query, validated_limit, project_id)
        return {
            "query": query,
            "entities": results,
            "count": len(results),
            "project_id": project_id
        }

    @router.get("/observations/search")
    async def search_observations(
        q: str = Query(..., description="Search query for observation content"),
        limit: int = Query(10, description="Maximum number of results"),
        project_id: Optional[str] = Query(None, description="Filter by project ID"),
        entity_id: Optional[str] = Query(None, description="Filter by specific entity ID"),
        added_by: Optional[str] = Query(None, description="Filter by who added the observation")
    ):
        """Search for observations across all entities with validation."""
        # Validate search parameters
        query, validated_limit = validate_search_params(q, limit, settings.MAX_SEARCH_LIMIT)
        
        # Validate project_id if provided
        if project_id and project_id != "default":
            validate_project_id(project_id, kg.projects)
        
        # Validate entity_id if provided
        if entity_id:
            from ..utils.validators import validate_entity_id
            validate_entity_id(entity_id, kg.entities)
        
        # Search observations (implement in knowledge_graph.py)
        results = await kg.search_observations(
            query=query,
            limit=validated_limit,
            project_id=project_id,
            entity_id=entity_id,
            added_by=added_by
        )
        
        return results

    @router.get("/analytics")
    async def get_analytics(
        project_id: Optional[str] = Query(None, description="Filter analytics by project ID"),
        include_details: bool = Query(False, description="Include detailed analytics")
    ):
        """Get comprehensive analytics and statistics with validation."""
        # Validate project_id if provided
        if project_id and project_id != "default":
            validate_project_id(project_id, kg.projects)
        
        analytics = await kg.get_analytics(project_id=project_id, include_details=include_details)
        return analytics

    return router