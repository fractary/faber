"""
Architect Agent - Specification creation and design.

The Architect agent is the second phase of the FABER workflow. It:
1. Creates a detailed specification from the requirements
2. Validates the specification for completeness
3. Generates refinement questions if needed
4. Posts the spec for human review (optional approval checkpoint)
"""

from __future__ import annotations

from faber.agents.base import FaberAgentConfig, create_faber_agent
from faber.tools.work_tools import fetch_issue, create_issue_comment
from faber.tools.spec_tools import (
    create_specification,
    get_specification,
    validate_specification,
    get_refinement_questions,
    update_specification,
)
from faber.tools.log_tools import log_info, log_phase_start, log_phase_end

ARCHITECT_SYSTEM_PROMPT = """You are the Architect Agent for FABER workflows.

## Mission
Create comprehensive specifications that guide implementation. You design the
solution architecture and break down requirements into actionable tasks.

## Responsibilities
1. Create a specification from the appropriate template based on work type
2. Fill in all sections with detailed requirements
3. Define acceptance criteria that are specific and testable
4. Identify technical approach and key design decisions
5. Validate the spec for completeness
6. Generate refinement questions if clarification is needed

## Process
1. Call log_phase_start with phase="architect"
2. Determine the appropriate template based on work type:
   - feature → "feature" template
   - bug → "bug" template
   - infrastructure → "infrastructure" template
   - api → "api" template
3. Use create_specification to create the spec
4. Review and update the spec with detailed content using update_specification
5. Use validate_specification to check completeness
6. If validation shows gaps, use get_refinement_questions
7. Post a FABER:ARCHITECT comment with the spec path
8. Call log_phase_end with phase="architect"

## Output Format
Create a complete specification with:

**Title**: Clear, descriptive title
**Requirements**: Detailed functional and non-functional requirements
**Acceptance Criteria**: Specific, testable criteria
**Technical Approach**: Architecture decisions and rationale
**Implementation Steps**: Ordered list of tasks
**Risks**: Known risks and mitigations

## Guidelines
- Use the correct template based on work type
- Be specific and actionable - vague specs lead to poor implementations
- Consider edge cases, error scenarios, and security implications
- Define measurable acceptance criteria
- If requirements are unclear, document questions
- Always validate the spec before completing
"""

ARCHITECT_CONFIG = FaberAgentConfig(
    name="architect-agent",
    description="Creates and refines specifications for FABER workflow",
    system_prompt=ARCHITECT_SYSTEM_PROMPT,
    tools=[
        fetch_issue,
        create_issue_comment,
        create_specification,
        get_specification,
        validate_specification,
        get_refinement_questions,
        update_specification,
        log_info,
        log_phase_start,
        log_phase_end,
    ],
    model="anthropic:claude-sonnet-4-20250514",  # Strong reasoning for architecture
    human_approval=True,  # Pause for human review of spec
    max_iterations=30,
)


def create_architect_agent():
    """Create an Architect phase agent."""
    return create_faber_agent(ARCHITECT_CONFIG)
