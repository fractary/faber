# SPEC-00026: FABER Accessibility Layer

## Status: Draft
## Version: 1.0.0
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

### 5.1 YAML to LangGraph Compilation

```python
# faber/accessibility/compiler.py

from typing import Dict, Any
import yaml
from pathlib import Path
from langgraph.graph import StateGraph, END

from ..workflows.state import FaberState
from ..agents import create_agent_from_config
from ..tools import load_tools

class WorkflowCompiler:
    """Compile YAML workflow definitions to LangGraph."""

    def __init__(self, workflow_path: Path):
        self.workflow_path = workflow_path
        self.config = self._load_yaml(workflow_path)

    def _load_yaml(self, path: Path) -> dict:
        """Load and validate YAML workflow definition."""
        with open(path) as f:
            config = yaml.safe_load(f)
        self._validate_schema(config)
        return config

    def _validate_schema(self, config: dict):
        """Validate workflow schema."""
        required_fields = ["name", "phases"]
        for field in required_fields:
            if field not in config:
                raise ValueError(f"Missing required field: {field}")

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

### 6.1 REST API for Programmatic Access

```python
# faber/api/server.py

from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
import uuid

from ..accessibility.compiler import compile_workflow
from ..workflows.graph import run_faber_workflow

app = FastAPI(title="FABER API", version="1.0.0")

# In-memory store (replace with proper storage)
workflows_store = {}

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

### 6.2 WebSocket for Real-time Updates

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
