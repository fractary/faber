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
]
