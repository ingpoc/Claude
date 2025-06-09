"""
Project API routes with validation.
"""

from fastapi import APIRouter, HTTPException

from ..models.schema import Project
from ..utils.validators import validate_project_creation

router = APIRouter(prefix="/api/projects", tags=["projects"])


def setup_project_routes(kg):
    """Setup project routes with dependency injection."""
    
    @router.post("", response_model=Project)
    async def create_project(project: Project):
        """Create a new project with validation."""
        # Convert to dict for validation
        project_data = project.model_dump()
        
        # Validate and clean data
        project_data = validate_project_creation(project_data)
        
        # Check for duplicate project names
        for existing_project in kg.projects.values():
            if existing_project.name.lower() == project_data["name"].lower():
                raise HTTPException(
                    status_code=409,
                    detail=f"Project with name '{project_data['name']}' already exists"
                )
        
        # Create validated project
        validated_project = Project(**project_data)
        new_project = await kg.create_project(validated_project)
        return new_project

    @router.get("")
    async def list_projects():
        """List all projects with stats."""
        projects_with_stats = await kg.list_projects()
        return projects_with_stats

    @router.get("/{project_id}")
    async def get_project(project_id: str):
        """Get project by ID with validation."""
        if not project_id or not project_id.strip():
            raise HTTPException(status_code=400, detail="Project ID is required")
        
        project = await kg.get_project(project_id.strip())
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        return project

    @router.delete("/{project_id}")
    async def delete_project(project_id: str):
        """Delete a project and its contents with validation."""
        if not project_id or not project_id.strip():
            raise HTTPException(status_code=400, detail="Project ID is required")
        
        project_id = project_id.strip()
        
        if project_id == "default":
            raise HTTPException(status_code=400, detail="Cannot delete the default project")
        
        if project_id not in kg.projects:
            raise HTTPException(status_code=404, detail=f"Project with ID {project_id} not found")
        
        try:
            success = await kg.delete_project(project_id)
            if not success:
                raise HTTPException(status_code=404, detail=f"Project with ID {project_id} not found")
            return {"message": f"Project {project_id} and its contents deleted successfully"}
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    return router