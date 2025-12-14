"""
FABER Tools - LangChain @tool wrappers for FABER primitives.

These tools provide LangChain-compatible interfaces to the
framework-agnostic primitives.
"""

from faber.tools.work_tools import (
    fetch_issue,
    create_issue,
    classify_work_type,
    create_issue_comment,
    close_issue,
    search_issues,
    WORK_TOOLS,
)
from faber.tools.repo_tools import (
    get_current_branch,
    create_branch,
    generate_branch_name,
    git_commit,
    git_push,
    create_pull_request,
    REPO_TOOLS,
)
from faber.tools.spec_tools import (
    create_specification,
    get_specification,
    validate_specification,
    get_refinement_questions,
    SPEC_TOOLS,
)
from faber.tools.log_tools import (
    log_info,
    log_error,
    log_phase_start,
    log_phase_end,
    LOG_TOOLS,
)

# All tools combined
ALL_TOOLS = WORK_TOOLS + REPO_TOOLS + SPEC_TOOLS + LOG_TOOLS

# Built-in tool registry for agent factory
_BUILTIN_TOOLS = {
    # Work tools
    "fetch_issue": fetch_issue,
    "create_issue": create_issue,
    "classify_work_type": classify_work_type,
    "create_issue_comment": create_issue_comment,
    "close_issue": close_issue,
    "search_issues": search_issues,
    # Repo tools
    "get_current_branch": get_current_branch,
    "create_branch": create_branch,
    "generate_branch_name": generate_branch_name,
    "git_commit": git_commit,
    "git_push": git_push,
    "create_pull_request": create_pull_request,
    # Spec tools
    "create_specification": create_specification,
    "get_specification": get_specification,
    "validate_specification": validate_specification,
    "get_refinement_questions": get_refinement_questions,
    # Log tools
    "log_info": log_info,
    "log_error": log_error,
    "log_phase_start": log_phase_start,
    "log_phase_end": log_phase_end,
}


def get_builtin_tool(name: str):
    """Get a built-in tool by name.

    Args:
        name: Tool name (e.g., "fetch_issue", "create_branch")

    Returns:
        Tool function if found, None otherwise

    Example:
        tool = get_builtin_tool("fetch_issue")
    """
    return _BUILTIN_TOOLS.get(name)


def list_builtin_tools():
    """List all available built-in tools.

    Returns:
        List of tool names
    """
    return sorted(_BUILTIN_TOOLS.keys())


__all__ = [
    # Work tools
    "fetch_issue",
    "create_issue",
    "classify_work_type",
    "create_issue_comment",
    "close_issue",
    "search_issues",
    "WORK_TOOLS",
    # Repo tools
    "get_current_branch",
    "create_branch",
    "generate_branch_name",
    "git_commit",
    "git_push",
    "create_pull_request",
    "REPO_TOOLS",
    # Spec tools
    "create_specification",
    "get_specification",
    "validate_specification",
    "get_refinement_questions",
    "SPEC_TOOLS",
    # Log tools
    "log_info",
    "log_error",
    "log_phase_start",
    "log_phase_end",
    "LOG_TOOLS",
    # Combined
    "ALL_TOOLS",
    # Registry functions
    "get_builtin_tool",
    "list_builtin_tools",
]
