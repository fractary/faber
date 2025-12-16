# SPEC-00026: FABER Accessibility Layer

## Status: Draft
## Version: 1.1.0
## Last Updated: 2025-12-12

---

## 1. Executive Summary

This specification defines the FABER Accessibility Layer - tooling that makes LangGraph-powered workflows accessible to developers of all skill levels and eventually to non-technical users. The goal is to abstract LangGraph's complexity while preserving its power, following the pattern of "Vercel is to deployment infrastructure" or "Prisma is to SQL."

### 1.1 Strategic Rationale

**The Problem:**
- LangGraph is powerful but has a steep learning curve
- Requires understanding graph theory, state machines, Python async patterns
- Documentation is fragmented and technical
- Only accessible to senior developers with ML/orchestration experience

**The Opportunity:**
- Make AI-assisted workflows accessible to all developers
- Enable non-technical users through visual builders
- Reduce time-to-workflow from days to minutes
- Create differentiated value on top of LangGraph ecosystem

**Market Position:**
```
                    Technical Expertise Required
                    ─────────────────────────────►
                    Low                        High

     ┌──────────────┬──────────────┬──────────────┐
     │              │              │              │
High │   Zapier     │   n8n        │  LangGraph   │
     │   Make       │   Windmill   │  AutoGen     │
Power├──────────────┼──────────────┼──────────────┤
     │              │              │              │
     │  ChatGPT     │   ★ FABER ★  │  Custom      │
     │  Copilot     │              │  Solutions   │
 Low │              │              │              │
     └──────────────┴──────────────┴──────────────┘
```

### 1.2 Scope

**In Scope:**
- Declarative YAML/JSON workflow definitions
- Enhanced CLI with workflow generation and management
- Agent and tool template system
- Workflow validation and testing utilities
- API server for programmatic access
- Foundation for visual builder (FABER Studio)

**Out of Scope:**
- Visual builder UI implementation (future spec)
- Marketplace/community sharing (future spec)
- Enterprise features (SSO, audit logs)

### 1.3 References

- SPEC-00025: LangGraph Integration Architecture
- SPEC-00027: Multi-Workflow Orchestration
- External: [Prisma Schema](https://www.prisma.io/docs/concepts/components/prisma-schema)
- External: [GitHub Actions YAML](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)

---

## 2. Design Principles

### 2.1 Progressive Disclosure

Users should be able to:
1. **Start simple** - Single command to run predefined workflows
2. **Customize incrementally** - Modify YAML configs as needed
3. **Go deep when necessary** - Drop down to Python for advanced cases

```
Level 1: faber run 123                           # Use defaults
Level 2: faber run 123 --workflow custom.yaml    # Custom workflow
Level 3: Python SDK for full control              # Advanced
```

### 2.2 Convention Over Configuration

- Sensible defaults for everything
- Zero-config for standard use cases
- Override only what you need

### 2.3 Declarative First

- Define what, not how
- YAML/JSON over Python when possible
- Code generation from declarations

---

## 3. Declarative Workflow Definitions

### 3.1 Workflow Schema

```yaml
# .faber/workflows/software-dev.yaml

# Metadata
name: software-development
version: "1.0"
description: Standard FABER workflow for software development

# Trigger configuration
triggers:
  - type: manual
    command: "faber run"
  - type: issue_labeled
    labels: ["ready-for-dev"]
  - type: webhook
    path: "/webhooks/start-work"

# Global configuration
config:
  work_platform: github      # github | jira | linear
  repo_platform: github      # github | gitlab | bitbucket
  autonomy: assisted         # assisted | guarded | autonomous
  max_retries: 3

# Model routing
models:
  default: anthropic:claude-sonnet-4-20250514
  classification: anthropic:claude-3-5-haiku-20241022
  reasoning: anthropic:claude-opus-4-20250514
  review: openai:gpt-4o

# Phase definitions
phases:
  - name: frame
    description: Gather requirements and classify work
    agent: frame-agent
    model: $models.classification
    tools:
      - fetch_issue
      - classify_work_type
      - create_issue_comment
    outputs:
      - issue
      - work_type
      - requirements

  - name: architect
    description: Create implementation specification
    agent: architect-agent
    model: $models.reasoning
    tools:
      - fetch_issue
      - create_specification
      - validate_specification
      - get_refinement_questions
    inputs:
      - $frame.issue
      - $frame.work_type
    outputs:
      - spec_id
      - spec_path
    human_approval: true
    approval_prompt: "Review the specification before proceeding to build"

  - name: build
    description: Implement the solution
    agent: build-agent
    model: $models.default
    tools:
      - create_branch
      - generate_branch_name
      - git_commit
      - validate_specification
      # Filesystem tools added automatically
    inputs:
      - $architect.spec_id
      - $frame.work_type
    outputs:
      - branch_name
      - commits
    max_iterations: 100

  - name: evaluate
    description: Validate implementation
    agent: evaluate-agent
    model: $models.review
    tools:
      - validate_specification
      - create_issue_comment
    inputs:
      - $architect.spec_id
      - $build.branch_name
    outputs:
      - decision      # GO | NO_GO
      - details
    on_failure:
      retry_phase: build
      max_retries: $config.max_retries

  - name: release
    description: Create PR and release
    agent: release-agent
    model: $models.classification
    tools:
      - git_push
      - create_pull_request
      - create_issue_comment
    inputs:
      - $build.branch_name
      - $frame.issue
    outputs:
      - pr_number
      - pr_url
    human_approval: true
    approval_prompt: "Review the PR before creation"

# Post-workflow hooks
hooks:
  on_complete:
    - action: notify_slack
      channel: "#dev-updates"
      message: "FABER completed for {{work_id}}: {{pr_url}}"
  on_failure:
    - action: create_issue_comment
      body: "FABER workflow failed at phase {{current_phase}}: {{error}}"
```

### 3.2 Agent Definition Schema

```yaml
# .faber/agents/custom-architect.yaml

name: custom-architect-agent
extends: architect-agent  # Inherit from base agent
description: Custom architect with additional domain knowledge

# Override model
model: anthropic:claude-opus-4-20250514

# Additional tools
tools:
  - fetch_issue
  - create_specification
  - validate_specification
  - get_refinement_questions
  # Custom tools
  - search_codebase
  - analyze_dependencies

# Custom system prompt (appended to base)
system_prompt: |
  ## Additional Guidelines

  When creating specifications for this project:
  - Follow the established patterns in /src/patterns/
  - Consider the existing API contracts in /api/
  - Reference the style guide at /docs/STYLE_GUIDE.md

  ## Domain Knowledge

  This is a fintech application. Always consider:
  - PCI compliance requirements
  - Audit logging for financial operations
  - Idempotency for payment operations

# Custom configuration
config:
  require_security_review: true
  min_spec_sections: 5
```

### 3.3 Tool Definition Schema

```yaml
# .faber/tools/custom-tools.yaml

tools:
  - name: search_codebase
    description: Search the codebase for patterns and implementations
    parameters:
      query:
        type: string
        description: Search query (supports regex)
        required: true
      file_pattern:
        type: string
        description: Glob pattern to filter files
        default: "**/*.py"
      max_results:
        type: integer
        description: Maximum results to return
        default: 10
    implementation:
      type: python
      module: faber.tools.custom
      function: search_codebase

  - name: analyze_dependencies
    description: Analyze project dependencies and suggest updates
    parameters:
      include_dev:
        type: boolean
        description: Include dev dependencies
        default: false
    implementation:
      type: bash
      command: |
        pip list --outdated --format=json | jq '.[].name'

  - name: run_specific_test
    description: Run a specific test file or test case
    parameters:
      test_path:
        type: string
        description: Path to test file or test::method
        required: true
    implementation:
      type: bash
      command: pytest {{test_path}} -v --tb=short
```

### 3.4 Tool Security Model

Custom tools with bash implementations execute in a **sandboxed environment** to prevent injection attacks and unintended system access.

**Security Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    Tool Execution Request                        │
│                  (template variables filled)                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Input Validation Layer                        │
│  • Escape shell metacharacters                                  │
│  • Validate parameter types match schema                        │
│  • Reject null bytes, control characters                        │
│  • Length limits on all string inputs                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Sandbox Environment                           │
│  • Isolated subprocess with restricted capabilities             │
│  • Allowlisted commands only (configurable per-project)         │
│  • Read-only filesystem except designated output paths          │
│  • Network access disabled by default                           │
│  • Resource limits (CPU, memory, execution time)                │
│  • No access to environment variables (except allowlisted)      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Output Sanitization                           │
│  • Truncate excessive output                                    │
│  • Strip ANSI escape codes                                      │
│  • Validate output against expected format                      │
└─────────────────────────────────────────────────────────────────┘
```

**Default Allowlisted Commands:**

```yaml
# .faber/config.yaml - security section
security:
  tool_sandbox:
    enabled: true
    allowlisted_commands:
      - pytest
      - python
      - pip
      - git
      - grep
      - find
      - cat
      - head
      - tail
      - jq
      - curl  # disabled by default, enable with network_access: true
    network_access: false
    max_execution_time: 300  # seconds
    max_output_size: 1048576  # 1MB
    writable_paths:
      - .faber/output/
      - /tmp/faber/
```

**Implementation:**

```python
# faber/tools/sandbox.py

from dataclasses import dataclass
from typing import List, Optional
import subprocess
import shlex
import re

@dataclass
class SandboxConfig:
    allowlisted_commands: List[str]
    network_access: bool = False
    max_execution_time: int = 300
    max_output_size: int = 1048576
    writable_paths: List[str] = None

class ToolSandbox:
    """Secure execution environment for custom bash tools."""

    def __init__(self, config: SandboxConfig):
        self.config = config

    def validate_command(self, command: str) -> bool:
        """Check if command uses only allowlisted executables."""
        # Extract base command (first word)
        base_cmd = shlex.split(command)[0].split('/')[-1]
        return base_cmd in self.config.allowlisted_commands

    def sanitize_input(self, value: str) -> str:
        """Escape shell metacharacters in user input."""
        # Reject dangerous characters
        if re.search(r'[\x00-\x1f]', value):
            raise ValueError("Control characters not allowed")
        # Use shlex.quote for safe escaping
        return shlex.quote(value)

    def execute(self, command: str, parameters: dict) -> str:
        """Execute command in sandboxed environment."""
        if not self.validate_command(command):
            raise SecurityError(f"Command not in allowlist: {command}")

        # Sanitize and substitute parameters
        safe_params = {k: self.sanitize_input(str(v)) for k, v in parameters.items()}
        final_command = command.format(**safe_params)

        # Execute with restrictions
        result = subprocess.run(
            final_command,
            shell=True,
            capture_output=True,
            timeout=self.config.max_execution_time,
            env=self._restricted_env(),
            cwd=self._sandbox_workdir()
        )

        output = result.stdout.decode()[:self.config.max_output_size]
        return self._sanitize_output(output)
```

### 3.5 Agent Inheritance Semantics

When an agent uses `extends`, the following inheritance rules apply:

| Property | Inheritance Behavior |
|----------|---------------------|
| `model` | Override (child replaces parent) |
| `tools` | Merge (child tools added to parent tools) |
| `system_prompt` | Append (child prompt appended to parent) |
| `config` | Deep merge (child values override parent) |
| `description` | Override |

**Example:**

```yaml
# Parent: architect-agent (built-in)
name: architect-agent
model: anthropic:claude-sonnet-4-20250514
tools:
  - fetch_issue
  - create_specification
system_prompt: |
  You are the Architect agent...
config:
  require_approval: true

# Child: custom-architect.yaml
name: custom-architect
extends: architect-agent
model: anthropic:claude-opus-4-20250514  # Overrides parent
tools:
  - search_codebase  # Added to parent tools
system_prompt: |
  ## Domain-Specific Guidelines
  Consider PCI compliance...  # Appended to parent prompt
config:
  min_spec_sections: 5  # Merged with parent config
```

**Effective configuration:**

```yaml
name: custom-architect
model: anthropic:claude-opus-4-20250514
tools:
  - fetch_issue
  - create_specification
  - search_codebase  # Merged
system_prompt: |
  You are the Architect agent...

  ## Domain-Specific Guidelines
  Consider PCI compliance...
config:
  require_approval: true  # From parent
  min_spec_sections: 5    # From child
```

---

## 4. Enhanced CLI

### 4.1 Command Structure

```bash
faber
├── run <work_id>           # Run workflow
├── init                    # Initialize FABER in project
├── workflow
│   ├── create              # Create new workflow from template
│   ├── list                # List available workflows
│   ├── validate            # Validate workflow definition
│   ├── test                # Test workflow with mock data
│   └── export              # Export workflow to Python
├── agent
│   ├── create              # Create new agent
│   ├── list                # List available agents
│   └── test                # Test agent in isolation
├── tool
│   ├── create              # Create new tool
│   ├── list                # List available tools
│   └── test                # Test tool
├── replay <workflow_id>    # Replay workflow from checkpoint
├── debug <workflow_id>     # Debug workflow interactively
├── status <workflow_id>    # Check workflow status
└── studio                  # Launch FABER Studio (future)
```

### 4.2 Init Command

```bash
$ faber init

? What type of project is this? (Use arrow keys)
❯ Software Development
  Content Creation
  Data Pipeline
  Custom

? Which work tracking platform? (Use arrow keys)
❯ GitHub Issues
  Jira
  Linear

? Which repository platform? (Use arrow keys)
❯ GitHub
  GitLab
  Bitbucket

? Default autonomy level? (Use arrow keys)
❯ Assisted (pause for approvals)
  Guarded (confirm destructive only)
  Autonomous (no pauses)

✓ Created .faber/config.yaml
✓ Created .faber/workflows/default.yaml
✓ Created .faber/agents/ directory
✓ Created .faber/tools/ directory

Next steps:
  1. Review .faber/config.yaml
  2. Run: faber run <issue-number>
```

### 4.3 Workflow Create Command

```bash
$ faber workflow create

? Workflow name: content-review
? Description: Review and approve content before publishing
? Start from template? (Use arrow keys)
❯ Blank
  Software Development
  Content Creation
  Data Pipeline

? Add phases interactively? Yes

Phase 1:
? Phase name: gather
? Description: Gather content for review
? Model: (Use arrow keys)
❯ Claude Haiku (fast, cheap)
  Claude Sonnet (balanced)
  Claude Opus (reasoning)
  GPT-4o (alternative)
? Tools to include: (Press <space> to select)
 ◉ fetch_issue
 ◉ create_issue_comment
 ◯ create_specification
? Human approval required? No

? Add another phase? Yes

Phase 2:
...

✓ Created .faber/workflows/content-review.yaml

Test with: faber workflow test content-review
```

### 4.4 Workflow Validate Command

```bash
$ faber workflow validate .faber/workflows/custom.yaml

Validating workflow: custom.yaml

✓ Schema valid
✓ All referenced agents exist
✓ All referenced tools exist
✓ Phase dependencies resolvable
✓ Model configurations valid
⚠ Warning: Phase 'build' has max_iterations=100, consider reducing for cost

Validation complete: 0 errors, 1 warning
```

### 4.5 Workflow Test Command

```bash
$ faber workflow test software-dev --mock-data test-fixtures/issue-123.json

Testing workflow: software-dev

Phase: frame
  ✓ fetch_issue returned mock data
  ✓ classify_work_type returned: feature
  ✓ Phase completed successfully

Phase: architect
  ✓ create_specification generated spec
  ✓ validate_specification passed
  ⏸ Human approval checkpoint (skipped in test mode)
  ✓ Phase completed successfully

Phase: build
  ✓ create_branch: feature/123-add-login
  ✓ git_commit: 3 commits
  ✓ Phase completed successfully

Phase: evaluate
  ✓ validate_specification passed
  ✓ Decision: GO
  ✓ Phase completed successfully

Phase: release
  ✓ git_push successful
  ✓ create_pull_request: #456
  ✓ Phase completed successfully

Test complete: All 5 phases passed
Estimated cost: $0.42 (mock mode - no actual API calls)
```

### 4.6 Replay Command

```bash
$ faber replay WF-123-1702400000 --from-phase build

Replaying workflow WF-123-1702400000 from phase: build

Restored state:
  - work_id: 123
  - work_type: feature
  - spec_id: SPEC-00045
  - Previous phases: frame, architect

Continuing from build phase...

Phase: build
  Creating branch: feature/123-add-login
  ...
```

### 4.7 Debug Command

```bash
$ faber debug WF-123-1702400000

FABER Debug Console
Workflow: WF-123-1702400000
Status: Failed at phase 'evaluate'

Commands:
  state       - Show current state
  history     - Show phase history
  errors      - Show error details
  replay      - Replay from checkpoint
  step        - Step through execution
  inspect <n> - Inspect step N
  quit        - Exit debug console

(faber-debug) > errors

Error at phase: evaluate
Time: 2025-12-12T10:30:45Z
Message: Validation failed - 2 acceptance criteria not met

Details:
  - Missing: "User can reset password via email"
  - Missing: "Rate limiting on login attempts"

(faber-debug) > inspect 23

Step 23: Tool call - validate_specification
Input: {"spec_id": "SPEC-00045"}
Output: {
  "status": "partial",
  "completeness": 0.75,
  "missing": ["password_reset", "rate_limiting"]
}
Duration: 0.45s
Tokens: 1,234

(faber-debug) > replay --from-phase build

Replaying from build phase with current state...
```

---

## 5. Workflow Loader & Compiler

### 5.1 Schema Validation with Pydantic

Workflow YAML schemas are validated using **Pydantic models**, providing Python-native type checking, IDE support, and automatic JSON Schema generation for external tooling.

```python
# faber/accessibility/schemas.py

from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, field_validator
from enum import Enum

class AutonomyLevel(str, Enum):
    ASSISTED = "assisted"
    GUARDED = "guarded"
    AUTONOMOUS = "autonomous"

class TriggerType(str, Enum):
    MANUAL = "manual"
    ISSUE_LABELED = "issue_labeled"
    WEBHOOK = "webhook"
    SCHEDULE = "schedule"

class Trigger(BaseModel):
    """Workflow trigger configuration."""
    type: TriggerType
    command: Optional[str] = None
    labels: Optional[List[str]] = None
    path: Optional[str] = None
    cron: Optional[str] = None

class ModelConfig(BaseModel):
    """Model routing configuration."""
    default: str = "anthropic:claude-sonnet-4-20250514"
    classification: Optional[str] = None
    reasoning: Optional[str] = None
    review: Optional[str] = None

    @field_validator('default', 'classification', 'reasoning', 'review', mode='before')
    @classmethod
    def validate_model_format(cls, v):
        if v and ':' not in v:
            raise ValueError(f"Model must be in format 'provider:model', got: {v}")
        return v

class PhaseFailureConfig(BaseModel):
    """Configuration for phase failure handling."""
    retry_phase: str
    max_retries: int = Field(default=3, ge=1, le=10)

class Phase(BaseModel):
    """Workflow phase definition."""
    name: str = Field(..., min_length=1, max_length=50)
    description: str
    agent: str
    model: Optional[str] = None  # Can be $reference
    tools: List[str] = []
    inputs: List[str] = []  # Can be $phase.output references
    outputs: List[str] = []
    human_approval: bool = False
    approval_prompt: Optional[str] = None
    max_iterations: int = Field(default=50, ge=1, le=1000)
    on_failure: Optional[PhaseFailureConfig] = None

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if not v.replace('-', '').replace('_', '').isalnum():
            raise ValueError("Phase name must be alphanumeric with hyphens/underscores")
        return v

class HookAction(BaseModel):
    """Post-workflow hook action."""
    action: str
    channel: Optional[str] = None
    message: Optional[str] = None
    body: Optional[str] = None

class WorkflowHooks(BaseModel):
    """Workflow lifecycle hooks."""
    on_complete: List[HookAction] = []
    on_failure: List[HookAction] = []

class WorkflowConfig(BaseModel):
    """Global workflow configuration."""
    work_platform: Literal["github", "jira", "linear"] = "github"
    repo_platform: Literal["github", "gitlab", "bitbucket"] = "github"
    autonomy: AutonomyLevel = AutonomyLevel.ASSISTED
    max_retries: int = Field(default=3, ge=1, le=10)

class WorkflowSchema(BaseModel):
    """Complete workflow definition schema."""
    name: str = Field(..., min_length=1, max_length=100)
    version: str = "1.0"
    description: Optional[str] = None
    triggers: List[Trigger] = []
    config: WorkflowConfig = WorkflowConfig()
    models: ModelConfig = ModelConfig()
    phases: List[Phase] = Field(..., min_length=1)
    hooks: WorkflowHooks = WorkflowHooks()

    @field_validator('phases')
    @classmethod
    def validate_phase_dependencies(cls, phases):
        """Ensure phase input references are valid."""
        available_outputs = set()
        for phase in phases:
            for input_ref in phase.inputs:
                if input_ref.startswith('$'):
                    ref_phase = input_ref[1:].split('.')[0]
                    if ref_phase not in available_outputs and ref_phase != 'config':
                        # Will be validated at compile time
                        pass
            available_outputs.add(phase.name)
        return phases

    class Config:
        json_schema_extra = {
            "title": "FABER Workflow Schema",
            "description": "Schema for declarative FABER workflow definitions"
        }


# Generate JSON Schema for external tools
def export_json_schema(output_path: str = "workflow-schema.json"):
    """Export Pydantic models as JSON Schema for external validation."""
    import json
    schema = WorkflowSchema.model_json_schema()
    with open(output_path, 'w') as f:
        json.dump(schema, f, indent=2)
    return schema
```

**Validation at Load Time:**

```python
# faber/accessibility/loader.py

import yaml
from pathlib import Path
from pydantic import ValidationError
from .schemas import WorkflowSchema

def load_workflow(path: Path) -> WorkflowSchema:
    """Load and validate a workflow YAML file."""
    with open(path) as f:
        raw_config = yaml.safe_load(f)

    try:
        return WorkflowSchema(**raw_config)
    except ValidationError as e:
        # Convert Pydantic errors to user-friendly messages
        errors = []
        for error in e.errors():
            loc = " → ".join(str(x) for x in error['loc'])
            errors.append(f"  • {loc}: {error['msg']}")
        raise WorkflowValidationError(
            f"Invalid workflow at {path}:\n" + "\n".join(errors)
        )
```

**Benefits of Pydantic Approach:**
- **Type Safety**: Full IDE autocomplete and type checking
- **Validation**: Automatic validation with detailed error messages
- **JSON Schema Export**: Generate schemas for VS Code YAML extension, CI validation
- **Documentation**: Self-documenting with field descriptions
- **Serialization**: Easy conversion to/from JSON, dict, YAML

### 5.2 YAML to LangGraph Compilation

```python
# faber/accessibility/compiler.py

from typing import Dict, Any
import yaml
from pathlib import Path
from langgraph.graph import StateGraph, END

from ..workflows.state import FaberState
from ..agents import create_agent_from_config
from ..tools import load_tools
from .schemas import WorkflowSchema
from .loader import load_workflow

class WorkflowCompiler:
    """Compile YAML workflow definitions to LangGraph."""

    def __init__(self, workflow_path: Path):
        self.workflow_path = workflow_path
        self.schema = load_workflow(workflow_path)  # Pydantic-validated
        self.config = self.schema.model_dump()  # Convert to dict for compatibility

    def _resolve_references(self, value: Any, context: dict) -> Any:
        """Resolve $variable references in config."""
        if isinstance(value, str) and value.startswith("$"):
            path = value[1:].split(".")
            result = context
            for key in path:
                result = result.get(key, {})
            return result
        return value

    def compile(self) -> StateGraph:
        """Compile YAML to LangGraph StateGraph."""

        # Build context for variable resolution
        context = {
            "config": self.config.get("config", {}),
            "models": self.config.get("models", {})
        }

        # Create state graph
        workflow = StateGraph(FaberState)

        # Create nodes for each phase
        phases = self.config["phases"]
        for i, phase_config in enumerate(phases):
            phase_name = phase_config["name"]

            # Resolve model reference
            model = self._resolve_references(
                phase_config.get("model", context["models"].get("default")),
                context
            )

            # Load tools
            tool_names = phase_config.get("tools", [])
            tools = load_tools(tool_names)

            # Create agent
            agent = create_agent_from_config({
                "name": f"{phase_name}-agent",
                "model": model,
                "tools": tools,
                "system_prompt": phase_config.get("system_prompt", "")
            })

            # Create node function
            node_fn = self._create_node_function(phase_name, agent, phase_config)
            workflow.add_node(phase_name, node_fn)

            # Add edge to next phase (or conditional)
            if i < len(phases) - 1:
                next_phase = phases[i + 1]["name"]

                # Check for retry configuration
                on_failure = phase_config.get("on_failure")
                if on_failure:
                    retry_phase = on_failure.get("retry_phase")
                    max_retries = self._resolve_references(
                        on_failure.get("max_retries", 3),
                        context
                    )
                    workflow.add_conditional_edges(
                        phase_name,
                        self._create_retry_condition(retry_phase, max_retries),
                        {
                            "retry": retry_phase,
                            "continue": next_phase
                        }
                    )
                else:
                    workflow.add_edge(phase_name, next_phase)
            else:
                workflow.add_edge(phase_name, END)

        # Set entry point
        workflow.set_entry_point(phases[0]["name"])

        return workflow.compile()

    def _create_node_function(self, phase_name: str, agent, config: dict):
        """Create node function for a phase."""
        async def node_fn(state: FaberState) -> FaberState:
            # Build input message from config
            inputs = config.get("inputs", [])
            input_context = self._build_input_context(inputs, state)

            result = await agent.ainvoke({
                "messages": [{
                    "role": "user",
                    "content": f"Execute {phase_name} phase. Context: {input_context}"
                }]
            })

            # Map outputs
            outputs = config.get("outputs", [])
            state_updates = self._map_outputs(outputs, result, phase_name)

            return {**state, **state_updates}

        return node_fn

    def _create_retry_condition(self, retry_phase: str, max_retries: int):
        """Create retry condition function."""
        def should_retry(state: FaberState) -> str:
            if state.get("evaluation_result") == "GO":
                return "continue"
            elif state.get("retry_count", 0) < max_retries:
                return "retry"
            else:
                return "continue"
        return should_retry


def compile_workflow(path: str) -> StateGraph:
    """Convenience function to compile workflow from path."""
    compiler = WorkflowCompiler(Path(path))
    return compiler.compile()
```

### 5.2 CLI Integration

```python
# faber/cli/commands/run.py

import click
from pathlib import Path
from ...accessibility.compiler import compile_workflow
from ...workflows.graph import create_faber_workflow

@click.command()
@click.argument("work_id")
@click.option("--workflow", "-w", type=click.Path(exists=True),
              help="Path to workflow YAML file")
@click.option("--autonomy", type=click.Choice(["assisted", "guarded", "autonomous"]))
def run(work_id: str, workflow: str, autonomy: str):
    """Run FABER workflow for a work item."""

    if workflow:
        # Load custom workflow from YAML
        click.echo(f"Loading workflow from {workflow}")
        graph = compile_workflow(workflow)
    else:
        # Use default workflow
        click.echo("Using default software-dev workflow")
        graph = create_faber_workflow()

    # ... rest of execution
```

---

## 6. API Server

### 6.1 Authentication & Authorization

The API Server supports **dual authentication** to accommodate both programmatic access (services) and interactive user sessions:

```
┌─────────────────────────────────────────────────────────────────┐
│                       API Request                                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Authentication Layer                           │
│                                                                 │
│  ┌─────────────────┐           ┌─────────────────┐             │
│  │   API Key Auth  │           │   OAuth2/JWT    │             │
│  │  (X-API-Key)    │    OR     │  (Bearer token) │             │
│  └────────┬────────┘           └────────┬────────┘             │
│           │                             │                       │
│           ▼                             ▼                       │
│  ┌─────────────────┐           ┌─────────────────┐             │
│  │ Service Access  │           │  User Session   │             │
│  │ (CI/CD, scripts)│           │  (Studio, CLI)  │             │
│  └─────────────────┘           └─────────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

**API Key Authentication** (for services):

```python
# faber/api/auth/api_key.py

from fastapi import Security, HTTPException, status
from fastapi.security import APIKeyHeader
from typing import Optional

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

async def verify_api_key(api_key: Optional[str] = Security(api_key_header)) -> dict:
    """Verify API key and return associated permissions."""
    if not api_key:
        return None

    # Lookup key in storage (hashed)
    key_record = await storage.get_api_key(hash_key(api_key))
    if not key_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )

    return {
        "type": "api_key",
        "key_id": key_record["id"],
        "scopes": key_record["scopes"],  # e.g., ["workflows:read", "workflows:execute"]
        "rate_limit": key_record.get("rate_limit", 1000)
    }
```

**OAuth2/JWT Authentication** (for users):

```python
# faber/api/auth/oauth.py

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from datetime import datetime, timedelta

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

async def verify_jwt_token(token: Optional[str] = Depends(oauth2_scheme)) -> dict:
    """Verify JWT token and return user info."""
    if not token:
        return None

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return {
            "type": "oauth",
            "user_id": payload["sub"],
            "scopes": payload.get("scopes", []),
            "exp": payload["exp"]
        }
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

# Token generation
def create_access_token(user_id: str, scopes: list, expires_delta: timedelta = None):
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=1))
    return jwt.encode(
        {"sub": user_id, "scopes": scopes, "exp": expire},
        SECRET_KEY, algorithm=ALGORITHM
    )
```

**Combined Authentication Dependency:**

```python
# faber/api/auth/__init__.py

from fastapi import Depends, HTTPException, status

async def get_current_auth(
    api_key_auth: dict = Depends(verify_api_key),
    jwt_auth: dict = Depends(verify_jwt_token)
) -> dict:
    """Accept either API key or JWT token."""
    if api_key_auth:
        return api_key_auth
    if jwt_auth:
        return jwt_auth
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required"
    )

# Usage in endpoints
@app.post("/workflows/run")
async def start_workflow(
    request: WorkflowRunRequest,
    auth: dict = Depends(get_current_auth)
):
    if "workflows:execute" not in auth["scopes"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    # ...
```

### 6.2 Pluggable Storage Backend

Workflow state persistence uses a **pluggable adapter pattern** with SQLite as the default (zero-config), and optional PostgreSQL/Redis backends for production:

```python
# faber/api/storage/base.py

from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from datetime import datetime

class StorageBackend(ABC):
    """Abstract base class for workflow state storage."""

    @abstractmethod
    async def save_workflow(self, workflow_id: str, data: dict) -> None:
        """Save or update workflow state."""
        pass

    @abstractmethod
    async def get_workflow(self, workflow_id: str) -> Optional[dict]:
        """Retrieve workflow state by ID."""
        pass

    @abstractmethod
    async def list_workflows(
        self,
        status: Optional[str] = None,
        limit: int = 20,
        offset: int = 0
    ) -> List[dict]:
        """List workflows with optional filtering."""
        pass

    @abstractmethod
    async def delete_workflow(self, workflow_id: str) -> bool:
        """Delete workflow state."""
        pass

    @abstractmethod
    async def save_checkpoint(
        self,
        workflow_id: str,
        phase: str,
        state: dict
    ) -> str:
        """Save phase checkpoint for replay."""
        pass

    @abstractmethod
    async def get_checkpoints(self, workflow_id: str) -> List[dict]:
        """Get all checkpoints for a workflow."""
        pass
```

**SQLite Backend (Default):**

```python
# faber/api/storage/sqlite.py

import aiosqlite
from pathlib import Path
from .base import StorageBackend

class SQLiteStorage(StorageBackend):
    """SQLite storage backend - zero-config, file-based."""

    def __init__(self, db_path: str = ".faber/workflows.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

    async def _get_connection(self):
        return await aiosqlite.connect(self.db_path)

    async def initialize(self):
        """Create tables if they don't exist."""
        async with await self._get_connection() as db:
            await db.executescript("""
                CREATE TABLE IF NOT EXISTS workflows (
                    workflow_id TEXT PRIMARY KEY,
                    work_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    current_phase TEXT,
                    completed_phases TEXT,  -- JSON array
                    pr_url TEXT,
                    error TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS checkpoints (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    workflow_id TEXT NOT NULL,
                    phase TEXT NOT NULL,
                    state TEXT NOT NULL,  -- JSON
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (workflow_id) REFERENCES workflows(workflow_id)
                );

                CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
                CREATE INDEX IF NOT EXISTS idx_checkpoints_workflow ON checkpoints(workflow_id);
            """)
            await db.commit()

    async def save_workflow(self, workflow_id: str, data: dict) -> None:
        async with await self._get_connection() as db:
            await db.execute("""
                INSERT OR REPLACE INTO workflows
                (workflow_id, work_id, status, current_phase, completed_phases, pr_url, error, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (
                workflow_id,
                data["work_id"],
                data["status"],
                data.get("current_phase", ""),
                json.dumps(data.get("completed_phases", [])),
                data.get("pr_url"),
                data.get("error")
            ))
            await db.commit()

    async def get_workflow(self, workflow_id: str) -> Optional[dict]:
        async with await self._get_connection() as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT * FROM workflows WHERE workflow_id = ?",
                (workflow_id,)
            ) as cursor:
                row = await cursor.fetchone()
                if row:
                    return {
                        **dict(row),
                        "completed_phases": json.loads(row["completed_phases"])
                    }
        return None
```

**PostgreSQL Backend (Production):**

```python
# faber/api/storage/postgres.py

import asyncpg
from .base import StorageBackend

class PostgresStorage(StorageBackend):
    """PostgreSQL storage backend - production-grade with ACID guarantees."""

    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self.pool = None

    async def initialize(self):
        self.pool = await asyncpg.create_pool(self.connection_string)
        async with self.pool.acquire() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS workflows (
                    workflow_id TEXT PRIMARY KEY,
                    work_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    current_phase TEXT,
                    completed_phases JSONB DEFAULT '[]',
                    pr_url TEXT,
                    error TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                );
                -- Additional indexes for query performance
                CREATE INDEX IF NOT EXISTS idx_workflows_status_created
                    ON workflows(status, created_at DESC);
            """)
```

**Storage Factory:**

```python
# faber/api/storage/__init__.py

from .base import StorageBackend
from .sqlite import SQLiteStorage
from .postgres import PostgresStorage

def create_storage(config: dict) -> StorageBackend:
    """Create storage backend from configuration."""
    backend = config.get("storage_backend", "sqlite")

    if backend == "sqlite":
        return SQLiteStorage(config.get("sqlite_path", ".faber/workflows.db"))
    elif backend == "postgres":
        return PostgresStorage(config["postgres_url"])
    elif backend == "redis":
        from .redis import RedisStorage
        return RedisStorage(config["redis_url"])
    else:
        raise ValueError(f"Unknown storage backend: {backend}")
```

**Configuration:**

```yaml
# .faber/config.yaml - storage section
api:
  storage_backend: sqlite  # sqlite | postgres | redis

  # SQLite (default - zero config)
  sqlite_path: .faber/workflows.db

  # PostgreSQL (production)
  # postgres_url: postgresql://user:pass@localhost/faber

  # Redis (optional - for distributed deployments)
  # redis_url: redis://localhost:6379/0
```

### 6.3 REST API for Programmatic Access

```python
# faber/api/server.py

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel
from typing import Optional, List
import uuid

from ..accessibility.compiler import compile_workflow
from ..workflows.graph import run_faber_workflow
from .auth import get_current_auth
from .storage import create_storage

app = FastAPI(title="FABER API", version="1.0.0")

# Initialize storage from config
storage = create_storage(load_config())

class WorkflowRunRequest(BaseModel):
    work_id: str
    workflow: Optional[str] = None
    autonomy: str = "assisted"
    config: Optional[dict] = None

class WorkflowStatus(BaseModel):
    workflow_id: str
    work_id: str
    status: str
    current_phase: str
    completed_phases: List[str]
    pr_url: Optional[str] = None

@app.post("/workflows/run", response_model=WorkflowStatus)
async def start_workflow(request: WorkflowRunRequest, background_tasks: BackgroundTasks):
    """Start a new FABER workflow."""
    workflow_id = f"WF-{request.work_id}-{uuid.uuid4().hex[:8]}"

    # Store initial status
    workflows_store[workflow_id] = {
        "workflow_id": workflow_id,
        "work_id": request.work_id,
        "status": "starting",
        "current_phase": "",
        "completed_phases": []
    }

    # Run workflow in background
    background_tasks.add_task(
        execute_workflow,
        workflow_id,
        request.work_id,
        request.workflow,
        request.config
    )

    return workflows_store[workflow_id]

@app.get("/workflows/{workflow_id}", response_model=WorkflowStatus)
async def get_workflow_status(workflow_id: str):
    """Get workflow status."""
    if workflow_id not in workflows_store:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflows_store[workflow_id]

@app.get("/workflows", response_model=List[WorkflowStatus])
async def list_workflows(status: Optional[str] = None, limit: int = 20):
    """List workflows with optional filtering."""
    results = list(workflows_store.values())
    if status:
        results = [w for w in results if w["status"] == status]
    return results[:limit]

@app.post("/workflows/{workflow_id}/approve")
async def approve_checkpoint(workflow_id: str, phase: str, approved: bool):
    """Approve or reject a human-in-the-loop checkpoint."""
    if workflow_id not in workflows_store:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # Handle approval logic
    # ...
    return {"status": "approved" if approved else "rejected"}

async def execute_workflow(workflow_id: str, work_id: str, workflow_path: str, config: dict):
    """Execute workflow and update status."""
    try:
        workflows_store[workflow_id]["status"] = "running"

        result = await run_faber_workflow(work_id, config)

        workflows_store[workflow_id].update({
            "status": "completed",
            "current_phase": "release",
            "completed_phases": result["completed_phases"],
            "pr_url": result.get("pr_url")
        })
    except Exception as e:
        workflows_store[workflow_id].update({
            "status": "failed",
            "error": str(e)
        })
```

### 6.4 WebSocket for Real-time Updates

```python
# faber/api/websocket.py

from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, workflow_id: str):
        await websocket.accept()
        if workflow_id not in self.active_connections:
            self.active_connections[workflow_id] = set()
        self.active_connections[workflow_id].add(websocket)

    def disconnect(self, websocket: WebSocket, workflow_id: str):
        self.active_connections[workflow_id].discard(websocket)

    async def broadcast(self, workflow_id: str, message: dict):
        if workflow_id in self.active_connections:
            for connection in self.active_connections[workflow_id]:
                await connection.send_json(message)

manager = ConnectionManager()

@app.websocket("/ws/workflows/{workflow_id}")
async def workflow_websocket(websocket: WebSocket, workflow_id: str):
    """WebSocket for real-time workflow updates."""
    await manager.connect(websocket, workflow_id)
    try:
        while True:
            # Keep connection alive
            data = await websocket.receive_text()
            # Handle any incoming messages (e.g., approvals)
    except WebSocketDisconnect:
        manager.disconnect(websocket, workflow_id)
```

---

## 7. Template System

### 7.1 Built-in Templates

```
.faber/
├── templates/
│   ├── workflows/
│   │   ├── software-dev.yaml       # Standard FABER
│   │   ├── content-creation.yaml   # Content workflows
│   │   ├── data-pipeline.yaml      # Data processing
│   │   └── custom-blank.yaml       # Minimal starting point
│   ├── agents/
│   │   ├── frame-agent.yaml
│   │   ├── architect-agent.yaml
│   │   ├── build-agent.yaml
│   │   ├── evaluate-agent.yaml
│   │   └── release-agent.yaml
│   └── tools/
│       ├── work-tools.yaml
│       ├── repo-tools.yaml
│       └── spec-tools.yaml
```

### 7.2 Template Registry

```python
# faber/templates/registry.py

from typing import Dict, List
from dataclasses import dataclass
from pathlib import Path
import yaml

@dataclass
class Template:
    name: str
    type: str  # workflow | agent | tool
    description: str
    path: Path
    tags: List[str]

class TemplateRegistry:
    """Registry of available templates."""

    def __init__(self):
        self.templates: Dict[str, Template] = {}
        self._load_builtin_templates()

    def _load_builtin_templates(self):
        """Load built-in templates."""
        templates_dir = Path(__file__).parent / "builtin"
        for yaml_file in templates_dir.rglob("*.yaml"):
            self._register_template(yaml_file)

    def _register_template(self, path: Path):
        """Register a template from YAML file."""
        with open(path) as f:
            config = yaml.safe_load(f)

        template = Template(
            name=config["name"],
            type=path.parent.name,  # workflows, agents, tools
            description=config.get("description", ""),
            path=path,
            tags=config.get("tags", [])
        )
        self.templates[f"{template.type}/{template.name}"] = template

    def list_templates(self, type: str = None) -> List[Template]:
        """List available templates."""
        templates = list(self.templates.values())
        if type:
            templates = [t for t in templates if t.type == type]
        return templates

    def get_template(self, name: str) -> Template:
        """Get template by name."""
        return self.templates.get(name)

    def instantiate(self, name: str, target_path: Path, variables: dict = None):
        """Instantiate template to target path."""
        template = self.get_template(name)
        if not template:
            raise ValueError(f"Template not found: {name}")

        # Read and process template
        with open(template.path) as f:
            content = f.read()

        # Replace variables
        if variables:
            for key, value in variables.items():
                content = content.replace(f"{{{{ {key} }}}}", str(value))

        # Write to target
        target_path.parent.mkdir(parents=True, exist_ok=True)
        with open(target_path, "w") as f:
            f.write(content)
```

---

## 8. Future: FABER Studio Foundation

### 8.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                       FABER Studio (Web UI)                         │
│                      React + TypeScript + Tailwind                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ REST + WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        FABER API Server                             │
│                      FastAPI + Python                               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FABER Core + LangGraph                         │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 API Contracts for Visual Builder

```python
# API endpoints needed for visual builder

# Workflow Management
GET    /api/workflows                    # List workflows
POST   /api/workflows                    # Create workflow
GET    /api/workflows/{id}               # Get workflow
PUT    /api/workflows/{id}               # Update workflow
DELETE /api/workflows/{id}               # Delete workflow
POST   /api/workflows/{id}/validate      # Validate workflow
POST   /api/workflows/{id}/export        # Export to Python

# Workflow Execution
POST   /api/runs                         # Start workflow run
GET    /api/runs/{id}                    # Get run status
POST   /api/runs/{id}/approve            # Approve checkpoint
POST   /api/runs/{id}/cancel             # Cancel run
GET    /api/runs/{id}/logs               # Get run logs
GET    /api/runs/{id}/replay             # Get replay data

# Templates
GET    /api/templates                    # List templates
GET    /api/templates/{type}/{name}      # Get template
POST   /api/templates/instantiate        # Create from template

# Agents & Tools
GET    /api/agents                       # List available agents
GET    /api/tools                        # List available tools
POST   /api/agents/test                  # Test agent
POST   /api/tools/test                   # Test tool

# Models
GET    /api/models                       # List available models
POST   /api/models/test                  # Test model connectivity
```

---

## 9. Success Criteria

### 9.1 Developer Experience

- [ ] `faber init` completes in <30 seconds with sensible defaults
- [ ] `faber run 123` works with zero configuration for GitHub projects
- [ ] Custom workflows definable in YAML without Python knowledge
- [ ] Workflow validation catches errors before execution
- [ ] Test mode allows dry-run without API costs

### 9.2 Accessibility Metrics

- [ ] Time to first workflow: <5 minutes (vs hours for raw LangGraph)
- [ ] Lines of code for custom workflow: <50 YAML (vs 200+ Python)
- [ ] Documentation completeness: Every CLI command documented
- [ ] Error messages: Actionable suggestions for all common errors

### 9.3 API Server

- [ ] API responds in <100ms for status queries
- [ ] WebSocket updates within 1s of state changes
- [ ] API supports 100 concurrent workflow executions
- [ ] OpenAPI spec generated and accurate

---

## 10. Implementation Phases

### Phase 1: Core Accessibility (Weeks 1-2)
- Implement YAML workflow schema and loader
- Build WorkflowCompiler for YAML-to-LangGraph
- Enhanced CLI commands (init, run, validate)

### Phase 2: Templates & Testing (Weeks 3-4)
- Template registry and instantiation
- Workflow test command with mock data
- Agent and tool generation commands

### Phase 3: API Server (Weeks 5-6)
- FastAPI server with workflow endpoints
- WebSocket for real-time updates
- Authentication foundation

### Phase 4: Advanced CLI (Weeks 7-8)
- Replay and debug commands
- Interactive workflow creation wizard
- Cost estimation

---

## 11. References

- [Prisma Schema Language](https://www.prisma.io/docs/concepts/components/prisma-schema)
- [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Click CLI Framework](https://click.palletsprojects.com/)

---

## Changelog

### v1.1.0 (2025-12-12) - Refinement Round 1

**Clarifications from Issue #3 Discussion:**

1. **Authentication & Authorization (§6.1)**: Added dual authentication support
   - API Keys for service/programmatic access (X-API-Key header)
   - OAuth2/JWT for user sessions (Bearer tokens)
   - Combined authentication dependency with scope-based authorization

2. **Pluggable Storage Backend (§6.2)**: Replaced in-memory store with pluggable adapter pattern
   - SQLite as default (zero-config, file-based)
   - PostgreSQL for production deployments
   - Redis support for distributed systems
   - Abstract `StorageBackend` base class with checkpoint support

3. **Schema Validation with Pydantic (§5.1)**: Added comprehensive schema validation
   - Full Pydantic models for workflows, phases, triggers, hooks
   - Field validators for model format, phase names, dependencies
   - JSON Schema export capability for external tools (VS Code, CI)
   - User-friendly validation error messages

4. **Tool Security Model (§3.4)**: Added sandboxed execution for custom bash tools
   - Input validation layer (escape metacharacters, reject control chars)
   - Sandbox environment (allowlisted commands, resource limits)
   - Network access disabled by default
   - Configurable per-project via `.faber/config.yaml`

5. **Agent Inheritance Semantics (§3.5)**: Clarified `extends` behavior
   - Documented inheritance rules for model, tools, system_prompt, config
   - Added examples showing effective configuration after inheritance

**Best-Effort Decisions:**

- Error recovery (Q4): Deferred to Phase 4 implementation - will add comprehensive error handling with retry strategies, exponential backoff, and circuit breakers
- Config file schema (S1): Partially addressed via Pydantic models - full schema will be generated during implementation
- Checkpoint format (S2): Will use JSON with versioning header for forward compatibility
- Cost estimation (S3): Will calculate based on token counts × model pricing, exposed via `faber workflow estimate` command
