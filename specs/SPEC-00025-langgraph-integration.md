# SPEC-00025: LangGraph Integration Architecture

## Status: Draft
## Version: 1.1.0
## Last Updated: 2025-12-12

---

## 1. Executive Summary

This specification defines the integration of FABER with the LangGraph ecosystem to provide enterprise-grade workflow orchestration while maintaining FABER's differentiated value proposition. The integration replaces FABER's current shell-script-based orchestration with LangGraph's graph-based state machine architecture, while preserving all FABER primitives (WorkManager, RepoManager, SpecManager, LogManager) as portable, framework-agnostic components.

### 1.1 Strategic Rationale

**Why Integrate:**
- LangGraph provides battle-tested orchestration (checkpointing, replay, human-in-the-loop)
- Multi-model support via LangChain providers (700+ integrations)
- LangSmith observability eliminates need to build custom tracing
- Deep Agents patterns align with Claude Code-inspired architecture
- Focus engineering effort on differentiation, not infrastructure

**What We Keep:**
- FABER methodology (Frame, Architect, Build, Evaluate, Release)
- Development-specific primitives (WorkManager, RepoManager, SpecManager, LogManager)
- Codex knowledge layer integration
- FABER-specific tooling and templates

**What We Replace:**
- Shell-script agent spawning (`claude --agent`)
- Custom state persistence (migrate to LangGraph checkpointing)
- Manual retry logic (use LangGraph conditional edges)

### 1.2 Scope

**In Scope:**
- LangGraph StateGraph implementation of FABER workflow
- Deep Agents middleware pattern for phase agents
- LangChain tool wrappers for FABER primitives
- Multi-model routing configuration
- LangSmith observability integration
- Migration path from current architecture

**Out of Scope:**
- FABER Studio (visual builder) - see SPEC-00026
- Multi-workflow orchestration (DAC) - see SPEC-00027
- Deployment platform - future specification

### 1.3 References

- SPEC-00023: FABER SDK (current architecture)
- SPEC-00015: FABER Orchestrator (original vision, partially superseded)
- SPEC-00024: Codex SDK
- External: [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- External: [Deep Agents](https://github.com/langchain-ai/deepagents)

---

## 2. Architecture Overview

### 2.1 Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Layer 5: FABER CLI / Studio                       │
│              User interfaces (CLI commands, visual builder)          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Layer 4: FABER Workflow Definitions               │
│         Declarative YAML/JSON workflow configs + templates           │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Layer 3: FABER Phase Agents                       │
│         Deep Agents middleware for Frame/Architect/Build/etc.        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Layer 2: FABER Tools                              │
│         LangChain @tool wrappers around FABER primitives             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Layer 1: FABER Primitives                         │
│         WorkManager, RepoManager, SpecManager, LogManager            │
│         (Framework-agnostic, portable Python/TypeScript)             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Foundation: LangGraph + LangChain                 │
│         Orchestration, state management, model providers             │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Package Structure (Python)

```
@fractary/faber/
├── faber/
│   ├── __init__.py
│   │
│   ├── primitives/              # Layer 1: Framework-agnostic
│   │   ├── __init__.py
│   │   ├── work/
│   │   │   ├── __init__.py
│   │   │   ├── manager.py       # WorkManager class
│   │   │   └── providers/
│   │   │       ├── github.py
│   │   │       ├── jira.py
│   │   │       └── linear.py
│   │   ├── repo/
│   │   │   ├── __init__.py
│   │   │   ├── manager.py       # RepoManager class
│   │   │   └── providers/
│   │   │       ├── github.py
│   │   │       ├── gitlab.py
│   │   │       └── bitbucket.py
│   │   ├── spec/
│   │   │   ├── __init__.py
│   │   │   ├── manager.py       # SpecManager class
│   │   │   └── templates/
│   │   └── logs/
│   │       ├── __init__.py
│   │       └── manager.py       # LogManager class
│   │
│   ├── tools/                   # Layer 2: LangChain tool wrappers
│   │   ├── __init__.py
│   │   ├── work_tools.py        # @tool wrappers for WorkManager
│   │   ├── repo_tools.py        # @tool wrappers for RepoManager
│   │   ├── spec_tools.py        # @tool wrappers for SpecManager
│   │   └── log_tools.py         # @tool wrappers for LogManager
│   │
│   ├── agents/                  # Layer 3: Deep Agents middleware
│   │   ├── __init__.py
│   │   ├── base.py              # Base FABER agent configuration
│   │   ├── frame.py             # FrameMiddleware + frame-agent
│   │   ├── architect.py         # ArchitectMiddleware + architect-agent
│   │   ├── build.py             # BuildMiddleware + build-agent
│   │   ├── evaluate.py          # EvaluateMiddleware + evaluate-agent
│   │   └── release.py           # ReleaseMiddleware + release-agent
│   │
│   ├── workflows/               # Layer 4: Workflow definitions
│   │   ├── __init__.py
│   │   ├── graph.py             # LangGraph StateGraph for FABER
│   │   ├── state.py             # FaberState TypedDict
│   │   ├── config.py            # Workflow configuration loading
│   │   └── templates/
│   │       ├── software_dev.yaml
│   │       ├── content_creation.yaml
│   │       └── data_pipeline.yaml
│   │
│   ├── cli/                     # Layer 5: CLI interface
│   │   ├── __init__.py
│   │   ├── main.py              # Click/Typer CLI
│   │   ├── commands/
│   │   │   ├── run.py
│   │   │   ├── init.py
│   │   │   ├── workflow.py
│   │   │   └── agent.py
│   │   └── formatters.py
│   │
│   └── observability/           # LangSmith integration
│       ├── __init__.py
│       ├── tracing.py
│       └── callbacks.py
│
├── tests/
├── pyproject.toml
└── README.md
```

---

## 3. Layer 1: FABER Primitives (Framework-Agnostic)

### 3.1 Design Principle

FABER primitives are **pure Python classes with no LangChain dependencies**. This ensures:
- Portability if framework needs change
- Testability without mocking LangChain
- Reuse in non-LangGraph contexts

### 3.2 WorkManager

```python
# faber/primitives/work/manager.py

from typing import Optional, List
from dataclasses import dataclass
from .providers import GitHubProvider, JiraProvider, LinearProvider

@dataclass
class Issue:
    id: str
    title: str
    body: str
    state: str
    labels: List[str]
    assignee: Optional[str]
    url: str

@dataclass
class WorkType:
    type: str  # 'feature' | 'bug' | 'chore' | 'patch' | 'infrastructure' | 'api'
    confidence: float
    reasoning: str

class WorkManager:
    """Framework-agnostic work tracking abstraction."""

    def __init__(self, config: Optional[dict] = None):
        self.config = config or self._load_config()
        self.provider = self._init_provider()

    def fetch_issue(self, issue_id: str) -> Issue:
        """Fetch issue from configured work tracking system."""
        return self.provider.fetch_issue(issue_id)

    def classify_work_type(self, issue: Issue) -> WorkType:
        """Classify work type based on issue content."""
        # Rule-based classification (no LLM dependency)
        labels = [l.lower() for l in issue.labels]

        if any(l in labels for l in ['bug', 'fix', 'defect']):
            return WorkType('bug', 0.9, 'Label indicates bug')
        elif any(l in labels for l in ['feature', 'enhancement']):
            return WorkType('feature', 0.9, 'Label indicates feature')
        elif any(l in labels for l in ['chore', 'maintenance']):
            return WorkType('chore', 0.9, 'Label indicates chore')
        else:
            return WorkType('feature', 0.5, 'Default classification')

    def create_comment(
        self,
        issue_id: str,
        body: str,
        context: Optional[str] = None
    ) -> dict:
        """Create comment on issue."""
        if context:
            body = f"**[FABER:{context.upper()}]**\n\n{body}"
        return self.provider.create_comment(issue_id, body)

    def close_issue(self, issue_id: str, reason: Optional[str] = None) -> Issue:
        """Close issue."""
        return self.provider.close_issue(issue_id, reason)

    # ... additional methods
```

### 3.3 RepoManager

```python
# faber/primitives/repo/manager.py

from typing import Optional, List
from dataclasses import dataclass
import subprocess

@dataclass
class Branch:
    name: str
    sha: str
    is_default: bool
    upstream: Optional[str]

@dataclass
class PullRequest:
    number: int
    title: str
    body: str
    state: str
    head_branch: str
    base_branch: str
    url: str

class RepoManager:
    """Framework-agnostic repository operations abstraction."""

    def __init__(self, config: Optional[dict] = None):
        self.config = config or self._load_config()
        self.provider = self._init_provider()

    def create_branch(
        self,
        name: str,
        base: str = "main",
        checkout: bool = True
    ) -> Branch:
        """Create a new git branch."""
        subprocess.run(["git", "checkout", "-b", name, base], check=True)
        return self.get_branch(name)

    def generate_branch_name(
        self,
        description: str,
        work_type: str = "feature",
        work_id: Optional[str] = None
    ) -> str:
        """Generate semantic branch name."""
        # Normalize description
        slug = description.lower()
        slug = ''.join(c if c.isalnum() else '-' for c in slug)
        slug = '-'.join(filter(None, slug.split('-')))[:50]

        prefix = {
            'feature': 'feature',
            'bug': 'fix',
            'chore': 'chore',
            'patch': 'fix',
        }.get(work_type, 'feature')

        if work_id:
            return f"{prefix}/{work_id}-{slug}"
        return f"{prefix}/{slug}"

    def commit(
        self,
        message: str,
        commit_type: str = "feat",
        scope: Optional[str] = None,
        work_id: Optional[str] = None
    ) -> dict:
        """Create semantic commit."""
        # Build conventional commit message
        prefix = commit_type
        if scope:
            prefix = f"{commit_type}({scope})"

        full_message = f"{prefix}: {message}"
        if work_id:
            full_message += f"\n\nRefs: #{work_id}"

        subprocess.run(["git", "add", "-A"], check=True)
        subprocess.run(["git", "commit", "-m", full_message], check=True)

        return {"message": full_message}

    def push(
        self,
        branch: Optional[str] = None,
        set_upstream: bool = False
    ) -> dict:
        """Push to remote."""
        cmd = ["git", "push"]
        if set_upstream:
            cmd.extend(["-u", "origin", branch or self.get_current_branch()])
        subprocess.run(cmd, check=True)
        return {"success": True}

    def create_pr(
        self,
        title: str,
        body: str,
        head: Optional[str] = None,
        base: str = "main",
        draft: bool = False
    ) -> PullRequest:
        """Create pull request via provider API."""
        return self.provider.create_pr(
            title=title,
            body=body,
            head=head or self.get_current_branch(),
            base=base,
            draft=draft
        )

    # ... additional methods
```

### 3.4 SpecManager

```python
# faber/primitives/spec/manager.py

from typing import Optional, List
from dataclasses import dataclass
from pathlib import Path
import yaml

@dataclass
class Specification:
    id: str
    path: str
    title: str
    work_id: Optional[str]
    template: str
    status: str  # 'draft' | 'in_progress' | 'complete'
    content: str

@dataclass
class ValidationResult:
    status: str  # 'complete' | 'partial' | 'incomplete'
    completeness: float
    missing_sections: List[str]
    suggestions: List[str]

class SpecManager:
    """Framework-agnostic specification management."""

    def __init__(self, config: Optional[dict] = None):
        self.config = config or self._load_config()
        self.specs_dir = Path(self.config.get('specs_dir', '.faber/specs'))

    def create_spec(
        self,
        title: str,
        template: str = "feature",
        work_id: Optional[str] = None,
        context: Optional[str] = None
    ) -> Specification:
        """Create specification from template."""
        spec_id = self._generate_spec_id()
        template_content = self._load_template(template)

        content = template_content.format(
            title=title,
            work_id=work_id or "N/A",
            context=context or "No additional context provided."
        )

        path = self.specs_dir / f"{spec_id}.md"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)

        return Specification(
            id=spec_id,
            path=str(path),
            title=title,
            work_id=work_id,
            template=template,
            status='draft',
            content=content
        )

    def validate_spec(self, spec_id: str) -> ValidationResult:
        """Validate specification completeness."""
        spec = self.get_spec(spec_id)

        required_sections = [
            "## Requirements",
            "## Acceptance Criteria",
            "## Technical Approach"
        ]

        missing = [s for s in required_sections if s not in spec.content]
        completeness = 1.0 - (len(missing) / len(required_sections))

        if completeness == 1.0:
            status = 'complete'
        elif completeness >= 0.5:
            status = 'partial'
        else:
            status = 'incomplete'

        return ValidationResult(
            status=status,
            completeness=completeness,
            missing_sections=missing,
            suggestions=[f"Add section: {s}" for s in missing]
        )

    def generate_refinement_questions(self, spec_id: str) -> List[str]:
        """Generate questions to refine spec."""
        spec = self.get_spec(spec_id)
        validation = self.validate_spec(spec_id)

        questions = []
        for section in validation.missing_sections:
            questions.append(f"Can you provide details for {section}?")

        # Add standard refinement questions
        questions.extend([
            "Are there any edge cases we should consider?",
            "What are the security implications?",
            "Are there any performance requirements?"
        ])

        return questions

    # ... additional methods
```

---

## 4. Layer 2: LangChain Tool Wrappers

### 4.1 Design Principle

Tool wrappers are **thin @tool decorated functions** that call primitive methods. They:
- Add LangChain-compatible decorators
- Provide rich descriptions for LLM tool use
- Handle serialization/deserialization
- Do NOT contain business logic

### 4.2 Work Tools

```python
# faber/tools/work_tools.py

from langchain_core.tools import tool
from ..primitives.work import WorkManager, Issue, WorkType

_work_manager = None

def get_work_manager() -> WorkManager:
    global _work_manager
    if _work_manager is None:
        _work_manager = WorkManager()
    return _work_manager

@tool
def fetch_issue(issue_id: str) -> dict:
    """Fetch an issue from the work tracking system.

    Args:
        issue_id: The issue number or identifier (e.g., "123" or "PROJ-123")

    Returns:
        Issue details including title, body, state, labels, and URL.
    """
    issue = get_work_manager().fetch_issue(issue_id)
    return {
        "id": issue.id,
        "title": issue.title,
        "body": issue.body,
        "state": issue.state,
        "labels": issue.labels,
        "assignee": issue.assignee,
        "url": issue.url
    }

@tool
def classify_work_type(issue_id: str) -> dict:
    """Classify the work type of an issue.

    Args:
        issue_id: The issue number or identifier

    Returns:
        Work type classification (feature, bug, chore, etc.) with confidence.
    """
    issue = get_work_manager().fetch_issue(issue_id)
    work_type = get_work_manager().classify_work_type(issue)
    return {
        "type": work_type.type,
        "confidence": work_type.confidence,
        "reasoning": work_type.reasoning
    }

@tool
def create_issue_comment(issue_id: str, body: str, context: str = None) -> dict:
    """Create a comment on an issue.

    Args:
        issue_id: The issue number or identifier
        body: The comment body text
        context: Optional FABER phase context (frame, architect, build, evaluate, release)

    Returns:
        Created comment details.
    """
    return get_work_manager().create_comment(issue_id, body, context)
```

### 4.3 Repo Tools

```python
# faber/tools/repo_tools.py

from langchain_core.tools import tool
from ..primitives.repo import RepoManager

_repo_manager = None

def get_repo_manager() -> RepoManager:
    global _repo_manager
    if _repo_manager is None:
        _repo_manager = RepoManager()
    return _repo_manager

@tool
def create_branch(
    name: str,
    base: str = "main",
    checkout: bool = True
) -> dict:
    """Create a new git branch.

    Args:
        name: Branch name (e.g., "feature/123-add-login")
        base: Base branch to create from (default: main)
        checkout: Whether to checkout the new branch (default: True)

    Returns:
        Created branch details.
    """
    branch = get_repo_manager().create_branch(name, base, checkout)
    return {
        "name": branch.name,
        "sha": branch.sha,
        "is_default": branch.is_default
    }

@tool
def generate_branch_name(
    description: str,
    work_type: str = "feature",
    work_id: str = None
) -> str:
    """Generate a semantic branch name.

    Args:
        description: Brief description of the work
        work_type: Type of work (feature, bug, chore, patch)
        work_id: Optional work item ID to include

    Returns:
        Generated branch name following conventions.
    """
    return get_repo_manager().generate_branch_name(description, work_type, work_id)

@tool
def git_commit(
    message: str,
    commit_type: str = "feat",
    scope: str = None,
    work_id: str = None
) -> dict:
    """Create a semantic git commit.

    Args:
        message: Commit message (without type prefix)
        commit_type: Conventional commit type (feat, fix, chore, docs, etc.)
        scope: Optional scope for the commit
        work_id: Optional work item ID to reference

    Returns:
        Commit details.
    """
    return get_repo_manager().commit(message, commit_type, scope, work_id)

@tool
def git_push(branch: str = None, set_upstream: bool = False) -> dict:
    """Push current branch to remote.

    Args:
        branch: Branch to push (default: current branch)
        set_upstream: Whether to set upstream tracking

    Returns:
        Push result.
    """
    return get_repo_manager().push(branch, set_upstream)

@tool
def create_pull_request(
    title: str,
    body: str,
    head: str = None,
    base: str = "main",
    draft: bool = False
) -> dict:
    """Create a pull request.

    Args:
        title: PR title
        body: PR body/description
        head: Head branch (default: current branch)
        base: Base branch to merge into (default: main)
        draft: Whether to create as draft PR

    Returns:
        Created PR details including number and URL.
    """
    pr = get_repo_manager().create_pr(title, body, head, base, draft)
    return {
        "number": pr.number,
        "title": pr.title,
        "url": pr.url,
        "state": pr.state
    }
```

### 4.4 Spec Tools

```python
# faber/tools/spec_tools.py

from langchain_core.tools import tool
from ..primitives.spec import SpecManager

_spec_manager = None

def get_spec_manager() -> SpecManager:
    global _spec_manager
    if _spec_manager is None:
        _spec_manager = SpecManager()
    return _spec_manager

@tool
def create_specification(
    title: str,
    template: str = "feature",
    work_id: str = None,
    context: str = None
) -> dict:
    """Create a new specification from a template.

    Args:
        title: Specification title
        template: Template to use (feature, bug, infrastructure, api)
        work_id: Optional work item ID to link
        context: Optional additional context for the spec

    Returns:
        Created specification details.
    """
    spec = get_spec_manager().create_spec(title, template, work_id, context)
    return {
        "id": spec.id,
        "path": spec.path,
        "title": spec.title,
        "status": spec.status
    }

@tool
def validate_specification(spec_id: str) -> dict:
    """Validate a specification for completeness.

    Args:
        spec_id: Specification ID

    Returns:
        Validation results including completeness percentage and suggestions.
    """
    result = get_spec_manager().validate_spec(spec_id)
    return {
        "status": result.status,
        "completeness": result.completeness,
        "missing_sections": result.missing_sections,
        "suggestions": result.suggestions
    }

@tool
def get_refinement_questions(spec_id: str) -> list:
    """Get questions to refine a specification.

    Args:
        spec_id: Specification ID

    Returns:
        List of questions to improve the spec.
    """
    return get_spec_manager().generate_refinement_questions(spec_id)
```

---

## 5. Layer 3: FABER Phase Agents (Deep Agents Pattern)

### 5.1 Design Principle

Each FABER phase is implemented as a **Deep Agents middleware** with:
- Custom tools specific to the phase
- Phase-specific system prompt
- Configurable model selection
- Optional human-in-the-loop checkpoints

### 5.2 Base Agent Configuration

```python
# faber/agents/base.py

from typing import List, Optional, Any
from dataclasses import dataclass, field
from deepagents import create_deep_agent
from deepagents.middleware import AgentMiddleware

@dataclass
class FaberAgentConfig:
    """Configuration for a FABER phase agent."""
    name: str
    description: str
    system_prompt: str
    tools: List[Any]
    model: str = "anthropic:claude-sonnet-4-20250514"
    human_approval: bool = False
    max_iterations: int = 50

def create_faber_agent(config: FaberAgentConfig):
    """Create a FABER phase agent using Deep Agents pattern."""

    class PhaseMiddleware(AgentMiddleware):
        tools = config.tools
        system_prompt = config.system_prompt

    return create_deep_agent(
        middleware=[PhaseMiddleware()],
        model=config.model,
        max_iterations=config.max_iterations
    )
```

### 5.3 Frame Agent

```python
# faber/agents/frame.py

from ..tools.work_tools import fetch_issue, classify_work_type, create_issue_comment
from .base import FaberAgentConfig, create_faber_agent

FRAME_SYSTEM_PROMPT = """You are the Frame Agent for FABER workflows.

## Mission
Gather requirements and classify work for the FABER workflow. You are the first
phase that prepares context for subsequent phases.

## Responsibilities
1. Fetch the issue from the work tracking system
2. Classify the work type (feature, bug, chore, patch, infrastructure, api)
3. Extract key requirements from the issue
4. Identify any blockers or dependencies
5. Post a comment on the issue indicating work has started

## Output Format
When complete, summarize your findings in a structured format:
- Work Type: [classification]
- Requirements: [bullet list]
- Dependencies: [if any]
- Blockers: [if any]

## Guidelines
- Always fetch the issue first to get full context
- Use the work type classification to inform subsequent phases
- If requirements are unclear, note them as needing clarification
- Post a FABER:FRAME comment when starting work
"""

frame_config = FaberAgentConfig(
    name="frame-agent",
    description="Gathers requirements and classifies work type for FABER workflow",
    system_prompt=FRAME_SYSTEM_PROMPT,
    tools=[fetch_issue, classify_work_type, create_issue_comment],
    model="anthropic:claude-3-5-haiku-20241022",  # Fast, cheap for classification
    human_approval=False
)

def create_frame_agent():
    return create_faber_agent(frame_config)
```

### 5.4 Architect Agent

```python
# faber/agents/architect.py

from ..tools.spec_tools import (
    create_specification,
    validate_specification,
    get_refinement_questions
)
from ..tools.work_tools import fetch_issue, create_issue_comment
from .base import FaberAgentConfig, create_faber_agent

ARCHITECT_SYSTEM_PROMPT = """You are the Architect Agent for FABER workflows.

## Mission
Create comprehensive specifications that guide implementation. You design the
solution architecture and break down requirements into actionable tasks.

## Responsibilities
1. Create a specification from the appropriate template
2. Fill in all sections with detailed requirements
3. Define acceptance criteria that are testable
4. Identify technical approach and key decisions
5. Validate the spec for completeness
6. Generate refinement questions if clarification needed

## Output Format
Create a complete specification with:
- Clear requirements derived from the issue
- Specific, testable acceptance criteria
- Technical approach with rationale
- Any assumptions or constraints noted

## Guidelines
- Use the correct template based on work type (feature, bug, infrastructure, api)
- Be specific and actionable - vague specs lead to poor implementations
- Consider edge cases and error scenarios
- If unsure about requirements, generate refinement questions
- Validate the spec before completing your work
"""

architect_config = FaberAgentConfig(
    name="architect-agent",
    description="Creates and refines specifications for FABER workflow",
    system_prompt=ARCHITECT_SYSTEM_PROMPT,
    tools=[
        fetch_issue,
        create_specification,
        validate_specification,
        get_refinement_questions,
        create_issue_comment
    ],
    model="anthropic:claude-opus-4-20250514",  # Deep reasoning for architecture
    human_approval=True  # Pause for human review of spec
)

def create_architect_agent():
    return create_faber_agent(architect_config)
```

### 5.5 Build Agent

```python
# faber/agents/build.py

from ..tools.repo_tools import (
    create_branch,
    generate_branch_name,
    git_commit,
    git_push
)
from ..tools.spec_tools import validate_specification
from .base import FaberAgentConfig, create_faber_agent

BUILD_SYSTEM_PROMPT = """You are the Build Agent for FABER workflows.

## Mission
Implement the solution according to the specification. You write code, tests,
and documentation to fulfill the requirements.

## Responsibilities
1. Create a feature branch with semantic naming
2. Read and understand the specification
3. Implement the solution following the technical approach
4. Write tests for acceptance criteria
5. Update documentation as needed
6. Make atomic commits with conventional commit messages

## Available Tools
You have access to filesystem tools (read_file, write_file, edit_file, ls, glob, grep)
in addition to the FABER-specific tools.

## Guidelines
- Follow the specification precisely
- Write clean, maintainable code
- Include tests that verify acceptance criteria
- Make small, focused commits
- Don't skip error handling or edge cases
- Comment code where intent isn't obvious
"""

build_config = FaberAgentConfig(
    name="build-agent",
    description="Implements solutions based on specifications",
    system_prompt=BUILD_SYSTEM_PROMPT,
    tools=[
        create_branch,
        generate_branch_name,
        git_commit,
        validate_specification
        # Note: Filesystem tools added by Deep Agents middleware
    ],
    model="anthropic:claude-sonnet-4-20250514",  # Balanced for coding
    human_approval=False,
    max_iterations=100  # Higher limit for implementation work
)

def create_build_agent():
    return create_faber_agent(build_config)
```

### 5.6 Evaluate Agent

```python
# faber/agents/evaluate.py

from ..tools.spec_tools import validate_specification
from ..tools.work_tools import create_issue_comment
from .base import FaberAgentConfig, create_faber_agent

EVALUATE_SYSTEM_PROMPT = """You are the Evaluate Agent for FABER workflows.

## Mission
Validate that the implementation meets the specification requirements. You ensure
quality before the work proceeds to release.

## Responsibilities
1. Run tests and verify they pass
2. Check that acceptance criteria are met
3. Review code quality and patterns
4. Validate documentation is updated
5. Identify any gaps or issues

## Decision
You must make a GO/NO-GO decision:
- GO: Implementation meets all requirements, ready for release
- NO-GO: Issues found, needs revision (triggers Build retry)

## Output Format
Provide a structured evaluation:
- Tests: [pass/fail with details]
- Acceptance Criteria: [checklist of met/unmet]
- Code Quality: [assessment]
- Documentation: [complete/incomplete]
- Decision: [GO/NO-GO]
- Issues: [if NO-GO, specific issues to fix]

## Guidelines
- Be thorough but pragmatic
- Focus on functional correctness first
- Don't block on minor style issues
- Provide actionable feedback for NO-GO decisions
"""

evaluate_config = FaberAgentConfig(
    name="evaluate-agent",
    description="Validates implementation against specification",
    system_prompt=EVALUATE_SYSTEM_PROMPT,
    tools=[
        validate_specification,
        create_issue_comment
        # Note: Filesystem tools added by Deep Agents middleware
    ],
    model="openai:gpt-4o",  # Different perspective for review
    human_approval=False
)

def create_evaluate_agent():
    return create_faber_agent(evaluate_config)
```

### 5.7 Release Agent

```python
# faber/agents/release.py

from ..tools.repo_tools import git_push, create_pull_request
from ..tools.work_tools import create_issue_comment
from .base import FaberAgentConfig, create_faber_agent

RELEASE_SYSTEM_PROMPT = """You are the Release Agent for FABER workflows.

## Mission
Deliver the completed work by creating a pull request and handling the release
process.

## Responsibilities
1. Push the branch to remote
2. Create a pull request with comprehensive description
3. Request reviewers if configured
4. Comment on the original issue with PR link
5. Handle any release-specific tasks

## PR Description Format
Create a PR with:
- Summary of changes
- Link to original issue
- Test plan or verification steps
- Any deployment considerations

## Guidelines
- Ensure all commits are pushed
- Write clear PR descriptions
- Link to the original issue
- Request appropriate reviewers
- Post status update on the issue
"""

release_config = FaberAgentConfig(
    name="release-agent",
    description="Creates PR and handles release for FABER workflow",
    system_prompt=RELEASE_SYSTEM_PROMPT,
    tools=[
        git_push,
        create_pull_request,
        create_issue_comment
    ],
    model="anthropic:claude-3-5-haiku-20241022",  # Simple task, cheap model
    human_approval=True  # Pause for human review of PR
)

def create_release_agent():
    return create_faber_agent(release_config)
```

---

## 6. Layer 4: LangGraph Workflow

### 6.1 FABER State Definition

```python
# faber/workflows/state.py

from typing import TypedDict, Annotated, Optional, List
from operator import add

class FaberState(TypedDict):
    """State for FABER workflow graph."""

    # Workflow identification
    workflow_id: str
    work_id: str

    # Phase tracking
    current_phase: str  # frame | architect | build | evaluate | release
    completed_phases: List[str]

    # Frame phase outputs
    issue: Optional[dict]
    work_type: Optional[str]
    requirements: Optional[List[str]]

    # Architect phase outputs
    spec_id: Optional[str]
    spec_path: Optional[str]
    spec_validated: bool

    # Build phase outputs
    branch_name: Optional[str]
    commits: Annotated[List[str], add]  # Accumulate commits

    # Evaluate phase outputs
    evaluation_result: Optional[str]  # GO | NO_GO
    evaluation_details: Optional[dict]
    retry_count: int

    # Release phase outputs
    pr_number: Optional[int]
    pr_url: Optional[str]

    # Human-in-the-loop
    awaiting_human_input: bool
    human_input_request: Optional[str]

    # Messages for LLM
    messages: Annotated[List[dict], add]
```

### 6.2 FABER Workflow Graph

```python
# faber/workflows/graph.py

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from typing import Literal

from .state import FaberState
from ..agents import (
    create_frame_agent,
    create_architect_agent,
    create_build_agent,
    create_evaluate_agent,
    create_release_agent
)

def create_faber_workflow(config: dict = None):
    """Create the FABER workflow as a LangGraph StateGraph."""

    # Initialize agents
    frame_agent = create_frame_agent()
    architect_agent = create_architect_agent()
    build_agent = create_build_agent()
    evaluate_agent = create_evaluate_agent()
    release_agent = create_release_agent()

    # Node functions
    async def frame_node(state: FaberState) -> FaberState:
        """Execute Frame phase."""
        result = await frame_agent.ainvoke({
            "messages": [{"role": "user", "content": f"Frame work item {state['work_id']}"}]
        })

        # Extract outputs from agent result
        return {
            **state,
            "current_phase": "frame",
            "completed_phases": state["completed_phases"] + ["frame"],
            "issue": result.get("issue"),
            "work_type": result.get("work_type"),
            "requirements": result.get("requirements"),
        }

    async def architect_node(state: FaberState) -> FaberState:
        """Execute Architect phase."""
        result = await architect_agent.ainvoke({
            "messages": [{
                "role": "user",
                "content": f"Create specification for {state['work_type']} work item {state['work_id']}"
            }]
        })

        return {
            **state,
            "current_phase": "architect",
            "completed_phases": state["completed_phases"] + ["architect"],
            "spec_id": result.get("spec_id"),
            "spec_path": result.get("spec_path"),
            "spec_validated": result.get("validated", False),
        }

    async def build_node(state: FaberState) -> FaberState:
        """Execute Build phase."""
        result = await build_agent.ainvoke({
            "messages": [{
                "role": "user",
                "content": f"Implement specification {state['spec_id']} for {state['work_id']}"
            }]
        })

        return {
            **state,
            "current_phase": "build",
            "completed_phases": state["completed_phases"] + ["build"],
            "branch_name": result.get("branch_name"),
            "commits": result.get("commits", []),
        }

    async def evaluate_node(state: FaberState) -> FaberState:
        """Execute Evaluate phase."""
        result = await evaluate_agent.ainvoke({
            "messages": [{
                "role": "user",
                "content": f"Evaluate implementation against spec {state['spec_id']}"
            }]
        })

        return {
            **state,
            "current_phase": "evaluate",
            "evaluation_result": result.get("decision"),  # GO or NO_GO
            "evaluation_details": result.get("details"),
            "retry_count": state["retry_count"] + (1 if result.get("decision") == "NO_GO" else 0),
        }

    async def release_node(state: FaberState) -> FaberState:
        """Execute Release phase."""
        result = await release_agent.ainvoke({
            "messages": [{
                "role": "user",
                "content": f"Release work item {state['work_id']} from branch {state['branch_name']}"
            }]
        })

        return {
            **state,
            "current_phase": "release",
            "completed_phases": state["completed_phases"] + ["release"],
            "pr_number": result.get("pr_number"),
            "pr_url": result.get("pr_url"),
        }

    # Conditional edge functions
    def should_retry_build(state: FaberState) -> Literal["build", "release"]:
        """Determine whether to retry build or proceed to release."""
        max_retries = config.get("max_retries", 3) if config else 3

        if state["evaluation_result"] == "GO":
            return "release"
        elif state["retry_count"] < max_retries:
            return "build"  # Retry
        else:
            # Max retries exceeded - could add error handling node
            return "release"  # Proceed anyway or fail

    # Build the graph
    workflow = StateGraph(FaberState)

    # Add nodes
    workflow.add_node("frame", frame_node)
    workflow.add_node("architect", architect_node)
    workflow.add_node("build", build_node)
    workflow.add_node("evaluate", evaluate_node)
    workflow.add_node("release", release_node)

    # Add edges
    workflow.add_edge("frame", "architect")
    workflow.add_edge("architect", "build")
    workflow.add_edge("build", "evaluate")
    workflow.add_conditional_edges(
        "evaluate",
        should_retry_build,
        {
            "build": "build",
            "release": "release"
        }
    )
    workflow.add_edge("release", END)

    # Set entry point
    workflow.set_entry_point("frame")

    # Compile with checkpointing
    checkpointer = MemorySaver()
    return workflow.compile(checkpointer=checkpointer)


# Convenience function
def run_faber_workflow(work_id: str, config: dict = None) -> FaberState:
    """Run the complete FABER workflow for a work item."""
    workflow = create_faber_workflow(config)

    initial_state = FaberState(
        workflow_id=f"WF-{work_id}-{int(time.time())}",
        work_id=work_id,
        current_phase="",
        completed_phases=[],
        issue=None,
        work_type=None,
        requirements=None,
        spec_id=None,
        spec_path=None,
        spec_validated=False,
        branch_name=None,
        commits=[],
        evaluation_result=None,
        evaluation_details=None,
        retry_count=0,
        pr_number=None,
        pr_url=None,
        awaiting_human_input=False,
        human_input_request=None,
        messages=[]
    )

    # Run with thread_id for checkpointing
    config = {"configurable": {"thread_id": initial_state["workflow_id"]}}

    result = workflow.invoke(initial_state, config)
    return result
```

---

## 7. Observability (LangSmith Integration)

### 7.1 Tracing Setup

```python
# faber/observability/tracing.py

import os
from langsmith import Client
from langchain.callbacks.tracers import LangChainTracer

def setup_langsmith_tracing(project_name: str = "faber-workflows"):
    """Configure LangSmith tracing for FABER workflows."""

    # Check for API key
    if not os.getenv("LANGSMITH_API_KEY"):
        print("Warning: LANGSMITH_API_KEY not set. Tracing disabled.")
        return None

    # Enable tracing
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_PROJECT"] = project_name

    return LangChainTracer(project_name=project_name)

def get_langsmith_client():
    """Get LangSmith client for programmatic access."""
    return Client()

def log_workflow_metadata(workflow_id: str, work_id: str, metadata: dict):
    """Log custom metadata to LangSmith."""
    client = get_langsmith_client()
    # Custom logging implementation
    pass
```

### 7.2 Custom Callbacks

```python
# faber/observability/callbacks.py

from langchain.callbacks.base import BaseCallbackHandler
from typing import Any, Dict, List

class FaberCallbackHandler(BaseCallbackHandler):
    """Custom callback handler for FABER-specific events."""

    def __init__(self, workflow_id: str):
        self.workflow_id = workflow_id
        self.phase_timings = {}

    def on_chain_start(self, serialized: Dict[str, Any], inputs: Dict[str, Any], **kwargs):
        """Log phase start."""
        phase = inputs.get("current_phase", "unknown")
        self.phase_timings[phase] = {"start": time.time()}
        print(f"[FABER] Phase {phase} started for workflow {self.workflow_id}")

    def on_chain_end(self, outputs: Dict[str, Any], **kwargs):
        """Log phase completion."""
        phase = outputs.get("current_phase", "unknown")
        if phase in self.phase_timings:
            self.phase_timings[phase]["end"] = time.time()
            duration = self.phase_timings[phase]["end"] - self.phase_timings[phase]["start"]
            print(f"[FABER] Phase {phase} completed in {duration:.2f}s")

    def on_tool_start(self, serialized: Dict[str, Any], input_str: str, **kwargs):
        """Log tool invocation."""
        tool_name = serialized.get("name", "unknown")
        print(f"[FABER] Tool {tool_name} invoked")

    def on_llm_error(self, error: Exception, **kwargs):
        """Handle LLM errors."""
        print(f"[FABER] LLM Error: {error}")
```

---

## 8. CLI Interface

### 8.1 Main CLI

```python
# faber/cli/main.py

import click
from .commands import run, init, workflow, agent

@click.group()
@click.version_option()
def cli():
    """FABER - AI-assisted development workflows."""
    pass

cli.add_command(run.run)
cli.add_command(init.init)
cli.add_command(workflow.workflow)
cli.add_command(agent.agent)

if __name__ == "__main__":
    cli()
```

### 8.2 Run Command

```python
# faber/cli/commands/run.py

import click
from ...workflows.graph import run_faber_workflow
from ...observability.tracing import setup_langsmith_tracing

@click.command()
@click.argument("work_id")
@click.option("--autonomy", type=click.Choice(["assisted", "guarded", "autonomous"]), default="assisted")
@click.option("--max-retries", type=int, default=3)
@click.option("--skip-phase", multiple=True, help="Phases to skip")
@click.option("--trace/--no-trace", default=True, help="Enable LangSmith tracing")
def run(work_id: str, autonomy: str, max_retries: int, skip_phase: tuple, trace: bool):
    """Run FABER workflow for a work item.

    Example: faber run 123 --autonomy assisted
    """
    if trace:
        setup_langsmith_tracing()

    config = {
        "autonomy": autonomy,
        "max_retries": max_retries,
        "skip_phases": list(skip_phase)
    }

    click.echo(f"Starting FABER workflow for work item {work_id}")
    click.echo(f"Autonomy: {autonomy}, Max retries: {max_retries}")

    try:
        result = run_faber_workflow(work_id, config)

        click.echo("\n" + "="*50)
        click.echo("FABER Workflow Complete")
        click.echo("="*50)
        click.echo(f"Workflow ID: {result['workflow_id']}")
        click.echo(f"Work Type: {result['work_type']}")
        click.echo(f"Spec: {result['spec_path']}")
        click.echo(f"Branch: {result['branch_name']}")
        click.echo(f"PR: {result['pr_url']}")
        click.echo(f"Retries: {result['retry_count']}")

    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        raise click.Abort()
```

---

## 9. Configuration

### 9.1 Configuration Schema

```yaml
# .faber/config.yaml

# Work tracking configuration
work:
  platform: github  # github | jira | linear
  owner: your-org
  repo: your-repo

# Repository configuration
repo:
  platform: github  # github | gitlab | bitbucket
  default_branch: main
  branch_prefixes:
    feature: "feature/"
    fix: "fix/"
    chore: "chore/"

# Workflow configuration
workflow:
  autonomy: assisted  # assisted | guarded | autonomous
  max_retries: 3

  # Phase-specific model configuration
  models:
    frame: anthropic:claude-3-5-haiku-20241022
    architect: anthropic:claude-opus-4-20250514
    build: anthropic:claude-sonnet-4-20250514
    evaluate: openai:gpt-4o
    release: anthropic:claude-3-5-haiku-20241022

  # Human approval checkpoints
  human_approval:
    architect: true  # Pause after spec creation
    release: true    # Pause before PR creation

# Observability
observability:
  langsmith:
    enabled: true
    project: faber-workflows
```

---

## 10. Migration Path

### 10.1 From Current Architecture

| Current | New | Migration |
|---------|-----|-----------|
| `FaberWorkflow` class | LangGraph `StateGraph` | Rewrite as graph |
| Shell-script agents | Deep Agents middleware | Define as Python classes |
| `claude --agent` spawning | LangGraph subgraphs | Use native spawning |
| JSON state files | LangGraph checkpointing | Automatic migration |
| No observability | LangSmith integration | Add tracing |

### 10.2 Migration Steps

1. **Phase 1: Primitives** (No breaking changes)
   - Extract primitives to framework-agnostic modules
   - Add LangChain tool wrappers
   - Existing code continues to work

2. **Phase 2: Agents** (Parallel implementation)
   - Implement Deep Agents middleware for each phase
   - Test alongside existing agents
   - Compare behavior

3. **Phase 3: Workflow** (Switchover)
   - Implement LangGraph StateGraph
   - Migrate state persistence to checkpointing
   - Enable LangSmith tracing

4. **Phase 4: CLI** (New interface)
   - Update CLI to use new workflow
   - Add new commands (replay, debug)
   - Deprecate old commands

---

## 11. Success Criteria

### 11.1 Functional Requirements

- [ ] All FABER phases execute correctly via LangGraph
- [ ] Retry logic works for Build/Evaluate cycle
- [ ] Human-in-the-loop checkpoints pause appropriately
- [ ] State is persisted and recoverable
- [ ] Multi-model routing works per phase

### 11.2 Non-Functional Requirements

- [ ] Workflow completes in <10min for typical tasks
- [ ] LangSmith traces are captured for all runs
- [ ] Memory usage stays under 500MB
- [ ] Works with Claude, GPT-4, Gemini models

### 11.3 Developer Experience

- [ ] `faber run 123` executes complete workflow
- [ ] Clear error messages on failures
- [ ] Replay/debug commands work
- [ ] Configuration is straightforward

---

## 12. Refinement Decisions (v1.1.0)

*Added after spec refinement session on 2025-12-12*

### 12.1 Deep Agents Abstraction Layer

**Decision**: Build our own middleware abstraction that wraps Deep Agents.

**Rationale**: Deep Agents is experimental and may have API changes. An abstraction layer:
- Isolates FABER from Deep Agents API changes
- Allows fallback to custom implementation if Deep Agents is deprecated
- Provides consistent interface regardless of underlying implementation

**Implementation**:
```python
# faber/agents/middleware.py

from abc import ABC, abstractmethod
from typing import List, Any

class FaberMiddleware(ABC):
    """Abstract middleware interface - implementations can use Deep Agents or custom logic."""

    @property
    @abstractmethod
    def tools(self) -> List[Any]:
        """Tools available to this middleware."""
        pass

    @property
    @abstractmethod
    def system_prompt(self) -> str:
        """System prompt for this middleware."""
        pass

class DeepAgentsMiddleware(FaberMiddleware):
    """Implementation using Deep Agents library."""
    pass

class NativeMiddleware(FaberMiddleware):
    """Fallback implementation using raw LangGraph."""
    pass
```

### 12.2 Dual Language Implementation

**Decision**: Implement in both Python and TypeScript simultaneously.

**Rationale**:
- Python: LangGraph/LangChain are Python-native with full feature support
- TypeScript: Matches existing FABER codebase (Claude Code plugins)
- Both: Maximizes adoption across different use cases

**Package Structure**:
```
@fractary/faber/
├── python/
│   └── faber/           # Python implementation (LangGraph native)
├── typescript/
│   └── src/             # TypeScript implementation (LangGraph.js)
└── shared/
    └── schemas/         # Shared JSON schemas for interop
```

### 12.3 Unified Approval Queue (Human-in-the-Loop)

**Decision**: Implement a unified approval queue with configurable multi-channel notification and response handling.

**Rationale**: HITL must work across all interfaces:
- Claude Code CLI (terminal prompt)
- Fractary CLI (direct invocation)
- Web/App interface (future)
- GitHub Issues (@faber mention triggers)

**Architecture**:
```
┌─────────────────────────────────────────────────────────────────┐
│                    Unified Approval Queue                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Approval Request: { workflow_id, phase, question, ... } │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
   ┌──────────┐        ┌──────────┐        ┌──────────┐
   │   CLI    │        │   Web    │        │  GitHub  │
   │ Adapter  │        │ Adapter  │        │ Adapter  │
   │ (poll)   │        │(WebSocket│        │(@faber   │
   │          │        │  push)   │        │ mention) │
   └──────────┘        └──────────┘        └──────────┘
```

**Configuration**:
```yaml
# .faber/config.yaml
workflow:
  approval:
    # Channels to notify when approval is needed
    notify_channels:
      - cli          # Always notify in terminal if active
      - github       # Post comment on linked issue
      - slack        # Optional: Slack webhook

    # Channels that can provide approval responses
    response_channels:
      - cli          # Accept response from terminal
      - github       # Accept response via @faber mention
      - api          # Accept response via HTTP API

    # Timeout before best-effort decision (0 = wait forever)
    timeout_minutes: 60
```

**GitHub Integration**:
```python
# When approval needed, post to issue:
"""
## 🔄 Approval Required: Architect Phase

The specification has been created and requires your review before proceeding.

**Spec**: [SPEC-00025.md](/specs/SPEC-00025.md)

**Options**:
- Reply with `@faber approve` to proceed
- Reply with `@faber reject <reason>` to stop workflow
- Reply with `@faber revise <instructions>` for changes

**Timeout**: 60 minutes (will use best-effort decision)
"""
```

### 12.4 Checkpoint Persistence Backends

**Decision**: Support pluggable backends - SQLite (default), PostgreSQL, Redis.

**Implementation**:
```python
# faber/workflows/checkpointing.py

from abc import ABC, abstractmethod
from langgraph.checkpoint.base import BaseCheckpointSaver

class FaberCheckpointer(ABC):
    """Abstract checkpointer with pluggable backends."""

    @abstractmethod
    def save(self, workflow_id: str, state: dict) -> None:
        pass

    @abstractmethod
    def load(self, workflow_id: str) -> dict:
        pass

class SQLiteCheckpointer(FaberCheckpointer):
    """Default: File-based, good for local/single-user."""
    pass

class PostgresCheckpointer(FaberCheckpointer):
    """Enterprise: Concurrent workflows, team usage."""
    pass

class RedisCheckpointer(FaberCheckpointer):
    """Fast: Short-lived workflows, CI/CD pipelines."""
    pass
```

**Configuration**:
```yaml
workflow:
  checkpointing:
    backend: sqlite  # sqlite | postgres | redis

    sqlite:
      path: .faber/checkpoints.db

    postgres:
      connection_string: ${FABER_POSTGRES_URL}

    redis:
      url: ${FABER_REDIS_URL}
      ttl_hours: 24
```

### 12.5 Error Recovery Strategy

**Decision**: Checkpoint before each tool call + automatic retry from last checkpoint.

**Implementation**:
- Save state checkpoint before every tool invocation
- On failure (network, API, LLM), restore from checkpoint and retry
- Configurable retry limits and backoff
- No model fallback chain in v1 (keep simple)

```python
# faber/workflows/recovery.py

class RecoveryConfig:
    max_retries: int = 3
    backoff_base: float = 1.0  # seconds
    backoff_multiplier: float = 2.0
    checkpoint_before_tools: bool = True

async def execute_with_recovery(tool_call, state, config: RecoveryConfig):
    """Execute tool with checkpoint and retry logic."""
    # Save checkpoint
    checkpointer.save(state.workflow_id, state)

    for attempt in range(config.max_retries):
        try:
            return await tool_call()
        except RecoverableError as e:
            delay = config.backoff_base * (config.backoff_multiplier ** attempt)
            await asyncio.sleep(delay)
            state = checkpointer.load(state.workflow_id)  # Restore

    raise MaxRetriesExceeded()
```

### 12.6 Cost Control and Budget Limits

**Decision**: Hard limits that pause workflow and require approval when approaching budget.

**Implementation**:
```python
# faber/workflows/cost.py

@dataclass
class CostConfig:
    budget_limit_usd: float = 10.0  # Per workflow
    warning_threshold: float = 0.8   # 80% of budget
    require_approval_at: float = 0.9 # 90% of budget

@dataclass
class CostTracker:
    workflow_id: str
    total_tokens: int = 0
    total_cost_usd: float = 0.0

    def add_usage(self, model: str, input_tokens: int, output_tokens: int):
        cost = calculate_cost(model, input_tokens, output_tokens)
        self.total_cost_usd += cost

        if self.total_cost_usd >= self.config.budget_limit_usd:
            raise BudgetExceeded()
        elif self.total_cost_usd >= self.config.require_approval_at * self.config.budget_limit_usd:
            raise BudgetApprovalRequired()
```

**State Addition**:
```python
class FaberState(TypedDict):
    # ... existing fields ...

    # Cost tracking
    cost_tracker: CostTracker
    budget_approved: bool  # Set to True after approval to continue
```

### 12.7 Codex Knowledge Integration

**Decision**: Reactive integration via `codex://` MCP references - no pre-fetching by default.

**Rationale**:
- Models naturally encounter `codex://` references in specs/docs
- MCP handler resolves references on-demand
- Users can add explicit pre-fetch steps to workflows if needed

**How It Works**:
1. Agent reads a spec containing `codex://fractary/guides/faber-workflow.md`
2. MCP intercepts the reference and fetches the document
3. Document content is injected into agent context
4. No FABER-specific code needed - relies on Codex MCP

**Optional Pre-fetch Step**:
```yaml
# Custom workflow with pre-fetch
phases:
  frame:
    steps:
      - name: pre-fetch-context
        command: /fractary-codex:fetch codex://fractary/guides/faber-workflow.md
      - name: gather-requirements
        agent: frame-agent
```

---

## 13. Changelog

### v1.1.0 (2025-12-12)
- Added: Deep Agents abstraction layer decision (Section 12.1)
- Added: Dual Python/TypeScript implementation decision (Section 12.2)
- Added: Unified approval queue architecture for HITL (Section 12.3)
- Added: Pluggable checkpoint backends - SQLite, PostgreSQL, Redis (Section 12.4)
- Added: Error recovery strategy with checkpoint + retry (Section 12.5)
- Added: Cost control with hard budget limits (Section 12.6)
- Added: Codex integration via reactive MCP references (Section 12.7)

### v1.0.0 (2025-12-12)
- Initial specification

---

## 14. References

- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [Deep Agents GitHub](https://github.com/langchain-ai/deepagents)
- [LangSmith Documentation](https://docs.smith.langchain.com/)
- [LangChain Tools Guide](https://python.langchain.com/docs/modules/tools/)
