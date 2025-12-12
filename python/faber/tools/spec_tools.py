"""
LangChain @tool wrappers for SpecManager.

These tools provide LangChain-compatible interfaces to specification
management without containing business logic.
"""

from __future__ import annotations

from typing import Any, Optional

from langchain_core.tools import tool

from faber.primitives.spec.manager import SpecManager

# Singleton instance - lazy loaded
_spec_manager: Optional[SpecManager] = None


def get_spec_manager() -> SpecManager:
    """Get or create SpecManager singleton."""
    global _spec_manager
    if _spec_manager is None:
        _spec_manager = SpecManager()
    return _spec_manager


@tool
def create_specification(
    title: str,
    template: str = "feature",
    work_id: Optional[str] = None,
    context: Optional[str] = None,
) -> dict[str, Any]:
    """Create a new specification from a template.

    Use this tool to create a structured specification document for a work item.
    The spec will be created in the specs/ directory.

    Args:
        title: Specification title (e.g., "Add user authentication")
        template: Template to use - "feature", "bug", "infrastructure", or "api"
        work_id: Optional work item ID to link (e.g., "123")
        context: Optional additional context to include in the spec

    Returns:
        Created specification details including id, path, and status.
    """
    spec = get_spec_manager().create_spec(
        title=title,
        template=template,
        work_id=work_id,
        context=context,
    )
    return {
        "id": spec.id,
        "path": spec.path,
        "title": spec.title,
        "work_id": spec.work_id,
        "template": spec.template,
        "status": spec.status,
    }


@tool
def get_specification(spec_id: str) -> dict[str, Any]:
    """Get a specification by ID or work ID.

    Use this tool to retrieve an existing specification document.

    Args:
        spec_id: Specification ID (e.g., "SPEC-00001") or work ID (e.g., "123")

    Returns:
        Specification details including id, path, title, content, and status.
    """
    spec = get_spec_manager().get_spec(spec_id)
    return {
        "id": spec.id,
        "path": spec.path,
        "title": spec.title,
        "work_id": spec.work_id,
        "status": spec.status,
        "version": spec.version,
        "content": spec.content,
    }


@tool
def validate_specification(spec_id: str) -> dict[str, Any]:
    """Validate a specification for completeness.

    Use this tool to check if a specification has all required sections
    and is ready for implementation.

    Args:
        spec_id: Specification ID to validate

    Returns:
        Validation results with status, completeness score, missing sections, and suggestions.
    """
    result = get_spec_manager().validate_spec(spec_id)
    return {
        "status": result.status,
        "completeness": result.completeness,
        "missing_sections": result.missing_sections,
        "suggestions": result.suggestions,
        "errors": result.errors,
    }


@tool
def get_refinement_questions(spec_id: str) -> list[str]:
    """Get questions to refine a specification.

    Use this tool to generate clarifying questions that would improve
    the specification's completeness and clarity.

    Args:
        spec_id: Specification ID

    Returns:
        List of refinement questions to ask.
    """
    return get_spec_manager().generate_refinement_questions(spec_id)


@tool
def update_specification(
    spec_id: str,
    content: Optional[str] = None,
    status: Optional[str] = None,
    version: Optional[str] = None,
) -> dict[str, Any]:
    """Update an existing specification.

    Use this tool to update spec content, status, or version.

    Args:
        spec_id: Specification ID
        content: New content (replaces entire spec content)
        status: New status - "draft", "in_progress", "complete", "archived"
        version: New version string (e.g., "1.1.0")

    Returns:
        Updated specification details.
    """
    spec = get_spec_manager().update_spec(
        spec_id=spec_id,
        content=content,
        status=status,
        version=version,
    )
    return {
        "id": spec.id,
        "path": spec.path,
        "title": spec.title,
        "status": spec.status,
        "version": spec.version,
    }


@tool
def list_specifications(
    status: Optional[str] = None,
    work_id: Optional[str] = None,
) -> list[dict[str, Any]]:
    """List specifications with optional filtering.

    Use this tool to find existing specifications.

    Args:
        status: Filter by status - "draft", "in_progress", "complete", "archived"
        work_id: Filter by work item ID

    Returns:
        List of specifications with id, path, title, status, and work_id.
    """
    specs = get_spec_manager().list_specs(status=status, work_id=work_id)
    return [
        {
            "id": s.id,
            "path": s.path,
            "title": s.title,
            "status": s.status,
            "work_id": s.work_id,
        }
        for s in specs
    ]


@tool
def archive_specification(spec_id: str) -> dict[str, Any]:
    """Archive a completed specification.

    Use this tool to archive a spec that is no longer active.

    Args:
        spec_id: Specification ID to archive

    Returns:
        Archived specification details.
    """
    spec = get_spec_manager().archive_spec(spec_id)
    return {
        "id": spec.id,
        "path": spec.path,
        "title": spec.title,
        "status": spec.status,
    }


# Export all spec tools
SPEC_TOOLS = [
    create_specification,
    get_specification,
    validate_specification,
    get_refinement_questions,
    update_specification,
    list_specifications,
    archive_specification,
]
