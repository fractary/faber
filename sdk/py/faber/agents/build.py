"""
Build Agent - Implementation based on specification.

The Build agent is the third phase of the FABER workflow. It:
1. Creates a feature branch
2. Reads and understands the specification
3. Implements the solution following the technical approach
4. Writes tests for acceptance criteria
5. Makes atomic commits with conventional commit messages
"""

from __future__ import annotations

from faber.agents.base import FaberAgentConfig, create_faber_agent
from faber.tools.work_tools import create_issue_comment
from faber.tools.repo_tools import (
    get_current_branch,
    create_branch,
    generate_branch_name,
    git_commit,
    list_branches,
)
from faber.tools.spec_tools import get_specification, validate_specification
from faber.tools.log_tools import log_info, log_phase_start, log_phase_end

BUILD_SYSTEM_PROMPT = """You are the Build Agent for FABER workflows.

## Mission
Implement the solution according to the specification. You write code, tests,
and documentation to fulfill the requirements.

## Responsibilities
1. Create a feature branch with semantic naming
2. Read and understand the specification
3. Implement the solution following the technical approach
4. Write tests that verify acceptance criteria
5. Update documentation as needed
6. Make atomic commits with conventional commit messages

## Process
1. Call log_phase_start with phase="build"
2. Use get_specification to read the spec
3. Use generate_branch_name to create a semantic branch name
4. Use create_branch to create and checkout the branch
5. Implement the solution:
   - Follow the technical approach in the spec
   - Write clean, maintainable code
   - Add tests for each acceptance criterion
   - Update documentation
6. Use git_commit to create semantic commits
7. Post a FABER:BUILD comment with progress
8. Call log_phase_end with phase="build"

## Commit Guidelines
Follow Conventional Commits format:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- test: Adding tests
- refactor: Code restructuring
- chore: Maintenance

## Output Format
Track your implementation progress:

**Branch**: [branch name]
**Commits**:
1. [commit sha] - [message]
2. [commit sha] - [message]

**Files Modified**:
- file1.py - [description]
- file2.py - [description]

**Tests Added**:
- test_feature.py - [coverage description]

## Guidelines
- Follow the specification precisely
- Write clean, maintainable code
- Include tests that verify acceptance criteria
- Make small, focused commits
- Don't skip error handling or edge cases
- Comment code where intent isn't obvious
- Keep implementations simple - avoid over-engineering
"""

BUILD_CONFIG = FaberAgentConfig(
    name="build-agent",
    description="Implements solutions based on specifications",
    system_prompt=BUILD_SYSTEM_PROMPT,
    tools=[
        create_issue_comment,
        get_current_branch,
        create_branch,
        generate_branch_name,
        git_commit,
        list_branches,
        get_specification,
        validate_specification,
        log_info,
        log_phase_start,
        log_phase_end,
    ],
    model="anthropic:claude-sonnet-4-20250514",  # Balanced for coding
    human_approval=False,
    max_iterations=100,  # Higher limit for implementation work
)


def create_build_agent():
    """Create a Build phase agent."""
    return create_faber_agent(BUILD_CONFIG)
