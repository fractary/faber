# SPEC-00029: Agent & Tool System Implementation Plan

## Status: Draft
## Version: 1.0.0
## Last Updated: 2025-12-14
## Depends On: SPEC-00028

---

## 1. Overview

This specification details the implementation tasks required in both the **FABER SDK (Python)** and **Fractary CLI** to support the Agent & Tool Definition System defined in SPEC-00028.

---

## 2. FABER SDK Implementation (Python)

### 2.1 Schema Definitions

**File**: `python/faber/definitions/schemas.py`

**Purpose**: Pydantic models for validating YAML definitions

**Tasks**:
- [ ] Create `LLMConfig` model
- [ ] Create `CachingSource` model
- [ ] Create `CachingConfig` model
- [ ] Create `ToolParameter` model
- [ ] Create `BashImplementation` model
- [ ] Create `PythonImplementation` model
- [ ] Create `HTTPImplementation` model
- [ ] Create `ToolImplementation` model (union type)
- [ ] Create `AgentDefinition` model (main agent schema)
- [ ] Create `ToolDefinition` model (main tool schema)
- [ ] Add field validators for model strings, paths, etc.
- [ ] Add JSON schema generation method

**Dependencies**: `pydantic`, `typing`

**Estimated Time**: 3-4 hours

**Example Structure**:
```python
from pydantic import BaseModel, Field, field_validator
from typing import List, Dict, Any, Optional, Literal

class LLMConfig(BaseModel):
    provider: Literal["anthropic", "openai", "google"] = "anthropic"
    model: str
    temperature: float = 0.0
    max_tokens: int = 4096

class AgentDefinition(BaseModel):
    name: str
    description: str
    type: Literal["agent"] = "agent"
    llm: LLMConfig
    system_prompt: str
    tools: List[str] = []
    custom_tools: List["ToolDefinition"] = []
    caching: Optional[CachingConfig] = None
    config: Dict[str, Any] = {}
    version: str = "1.0"
    author: Optional[str] = None
    tags: List[str] = []
```

---

### 2.2 Registry System

**File**: `python/faber/definitions/registry.py`

**Purpose**: Discover and load agent/tool definitions from `.fractary/`

**Tasks**:
- [ ] Create `DefinitionRegistry` class
- [ ] Implement `discover()` - scan `.fractary/agents/` and `.fractary/tools/`
- [ ] Implement `_load_agent(path)` - load and validate YAML
- [ ] Implement `_load_tool(path)` - load and validate YAML
- [ ] Implement `get_agent(name)` - retrieve agent by name
- [ ] Implement `get_tool(name)` - retrieve tool by name
- [ ] Implement `list_agents(tags)` - list with optional tag filtering
- [ ] Implement `list_tools(tags)` - list with optional tag filtering
- [ ] Implement `save_agent(agent_def)` - save to YAML
- [ ] Implement `save_tool(tool_def)` - save to YAML
- [ ] Create global singleton: `get_registry()`
- [ ] Add error handling for invalid YAML
- [ ] Add caching to avoid re-scanning filesystem

**Dependencies**: `pathlib`, `yaml`, `schemas.py`

**Estimated Time**: 4-5 hours

**Example Structure**:
```python
class DefinitionRegistry:
    def __init__(self, project_root: Optional[Path] = None):
        self.project_root = project_root or Path.cwd()
        self.agents_dir = self.project_root / ".fractary/agents"
        self.tools_dir = self.project_root / ".fractary/tools"
        self._agents: Dict[str, AgentDefinition] = {}
        self._tools: Dict[str, ToolDefinition] = {}
        self.discover()

    def discover(self) -> None:
        """Scan .fractary/ for definitions"""
        pass

    def get_agent(self, name: str) -> Optional[AgentDefinition]:
        """Get agent by name"""
        return self._agents.get(name)
```

---

### 2.3 Tool Execution Engine

**File**: `python/faber/definitions/tool_executor.py`

**Purpose**: Execute tools based on their implementation type

**Tasks**:
- [ ] Create `ToolExecutor` base class
- [ ] Create `BashToolExecutor` - execute bash commands in sandbox
- [ ] Create `PythonToolExecutor` - call Python functions
- [ ] Create `HTTPToolExecutor` - make HTTP requests
- [ ] Implement parameter validation
- [ ] Implement parameter substitution (${var} replacement)
- [ ] Implement sandbox for bash (allowlist, timeouts, network control)
- [ ] Implement output parsing and validation
- [ ] Add error handling and logging
- [ ] Create factory: `create_tool_executor(tool_def)`

**Dependencies**: `subprocess`, `shlex`, `importlib`, `httpx`

**Estimated Time**: 6-8 hours

**Example Structure**:
```python
class ToolExecutor(ABC):
    @abstractmethod
    async def execute(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        pass

class BashToolExecutor(ToolExecutor):
    def __init__(self, tool_def: ToolDefinition):
        self.tool_def = tool_def
        self.sandbox_config = tool_def.implementation.bash.sandbox

    async def execute(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        # Validate parameters
        # Substitute ${vars}
        # Run in sandbox
        # Return output
        pass

def create_tool_executor(tool_def: ToolDefinition) -> ToolExecutor:
    if tool_def.implementation.type == "bash":
        return BashToolExecutor(tool_def)
    elif tool_def.implementation.type == "python":
        return PythonToolExecutor(tool_def)
    elif tool_def.implementation.type == "http":
        return HTTPToolExecutor(tool_def)
```

---

### 2.4 Agent Factory

**File**: `python/faber/definitions/agent_factory.py`

**Purpose**: Create executable agents from AgentDefinition YAML

**Tasks**:
- [ ] Create `AgentFactory` class
- [ ] Implement `create_agent(agent_def)` - main factory method
- [ ] Load and bind built-in tools (from tool names)
- [ ] Create custom tools (from custom_tools in definition)
- [ ] Build system prompt
- [ ] Handle prompt caching configuration
- [ ] Create `CachedClaudeAgent` if caching enabled
- [ ] Create regular `NativeMiddleware` agent if caching disabled
- [ ] Support different LLM providers (anthropic, openai, google)

**Dependencies**: `agents/base.py`, `agents/cached_claude_agent.py`, `langchain_anthropic`, `langchain_openai`

**Estimated Time**: 5-6 hours

**Example Structure**:
```python
class AgentFactory:
    def __init__(self, registry: DefinitionRegistry):
        self.registry = registry

    def create_agent(self, agent_name: str) -> Any:
        agent_def = self.registry.get_agent(agent_name)

        # Load tools
        tools = self._load_tools(agent_def.tools)

        # Add custom tools
        for custom_tool in agent_def.custom_tools:
            tools.append(self._create_custom_tool(custom_tool))

        # Create model
        model = self._create_model(agent_def.llm)

        # Create agent with or without caching
        if agent_def.caching and agent_def.caching.enabled:
            return self._create_cached_agent(agent_def, tools, model)
        else:
            return self._create_regular_agent(agent_def, tools, model)

    def _create_cached_agent(self, agent_def, tools, model):
        # Build cached context
        context = self._build_cached_context(agent_def.caching)

        return CachedClaudeAgent(
            model=f"{agent_def.llm.provider}:{agent_def.llm.model}",
            agent_name=agent_def.name,
            agent_prompt=agent_def.system_prompt,
            tools=tools,
            context=context,
        )
```

---

### 2.5 Cached Context Builder

**File**: `python/faber/agents/cached_context.py`

**Purpose**: Build cacheable context from caching configuration

**Tasks**:
- [ ] Create `CachedAgentContext` class
- [ ] Implement `add_cached_block(label, content)` - add a cacheable block
- [ ] Implement `load_from_file(path, label)` - load file for caching
- [ ] Implement `load_from_glob(pattern, label)` - load multiple files
- [ ] Implement `load_inline(content, label)` - add inline content
- [ ] Implement `build_system_blocks()` - create message blocks with cache_control
- [ ] Order blocks for optimal caching (static content first)

**Dependencies**: `pathlib`, `glob`

**Estimated Time**: 3-4 hours

**Example Structure**:
```python
class CachedAgentContext:
    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.blocks: List[Dict[str, Any]] = []

    def add_cached_block(self, label: str, content: str):
        self.blocks.append({
            "type": "text",
            "text": f"## {label}\n\n{content}",
            "cache_control": {"type": "ephemeral"}
        })

    def load_from_file(self, path: str, label: str):
        content = (self.project_root / path).read_text()
        self.add_cached_block(label, content)

    def load_from_glob(self, pattern: str, label: str):
        files = self.project_root.glob(pattern)
        content = "\n\n".join(f"# {f.name}\n{f.read_text()}" for f in files)
        self.add_cached_block(label, content)

    def build_system_blocks(self, agent_prompt: str) -> List[Dict]:
        # Agent prompt first (not cached)
        blocks = [{"type": "text", "text": agent_prompt}]
        # Then cached blocks
        blocks.extend(self.blocks)
        return blocks
```

---

### 2.6 Enhanced Cached Claude Agent

**File**: `python/faber/agents/cached_claude_agent.py`

**Purpose**: Agent that uses Anthropic SDK with prompt caching

**Tasks**:
- [ ] Update `CachedClaudeAgent` to use `CachedAgentContext`
- [ ] Implement tool execution loop with caching
- [ ] Handle multi-turn conversations (cache persists)
- [ ] Parse tool calls from Claude responses
- [ ] Execute tools via `ToolExecutor`
- [ ] Return structured results with usage stats
- [ ] Add logging for cache hits/misses

**Dependencies**: `anthropic`, `cached_context.py`, `tool_executor.py`

**Estimated Time**: 4-5 hours

---

### 2.7 SDK Public API

**File**: `python/faber/definitions/api.py`

**Purpose**: High-level API for programmatic use

**Tasks**:
- [ ] Create `AgentAPI` class
- [ ] Implement `load_agent(name)` - load and return executable agent
- [ ] Implement `invoke_agent(name, task, context)` - one-shot invocation
- [ ] Implement `list_agents(tags)` - list available agents
- [ ] Create `ToolAPI` class
- [ ] Implement `load_tool(name)` - load and return executable tool
- [ ] Implement `invoke_tool(name, **kwargs)` - one-shot invocation
- [ ] Implement `list_tools(tags)` - list available tools

**Dependencies**: `registry.py`, `agent_factory.py`, `tool_executor.py`

**Estimated Time**: 3-4 hours

**Example Usage**:
```python
from faber.definitions.api import AgentAPI, ToolAPI

# Use an agent
agent_api = AgentAPI()
result = await agent_api.invoke_agent(
    "corthion-loader-engineer",
    "Create loader for claims.medical",
    context={"dataset": "claims", "table": "medical"}
)

# Use a tool
tool_api = ToolAPI()
result = tool_api.invoke_tool(
    "terraform-deploy",
    environment="test",
    target="aws_glue_job.claims_medical"
)
```

---

### 2.8 Workflow Compiler Updates

**File**: `python/faber/accessibility/compiler.py`

**Purpose**: Update workflow compiler to support step-level agents/tools

**Current State**: Compiler treats each phase as single agent invocation

**Needed Changes**:
- [ ] Add `Step` schema to `schemas.py` (id, name, description, agent/tool, inputs, outputs)
- [ ] Update `Phase` schema to have `steps: List[Step]`
- [ ] In `compile()`, iterate through steps within each phase
- [ ] For each step, check if it's an agent or tool
- [ ] If agent: load from registry, create node
- [ ] If tool: load from registry, create node that executes tool
- [ ] Connect steps sequentially within a phase
- [ ] Pass state between steps (step outputs become inputs to next step)

**Estimated Time**: 6-8 hours

**Example**:
```python
# Current: One node per phase
workflow.add_node("build", build_phase_node)

# New: Multiple nodes per phase
workflow.add_node("build.loader-engineer", agent_step_node)
workflow.add_node("build.loader-validate", tool_step_node)
workflow.add_node("build.loader-deploy", tool_step_node)
workflow.add_edge("build.loader-engineer", "build.loader-validate")
workflow.add_edge("build.loader-validate", "build.loader-deploy")
```

---

### 2.9 Converters

**File**: `python/faber/definitions/converters.py`

**Purpose**: Convert Claude Code agents/skills to YAML format

**Tasks**:
- [ ] Implement `convert_claude_agent(path, output_name)`
- [ ] Parse markdown to extract title, description
- [ ] Extract system prompt
- [ ] Create `AgentDefinition` with defaults
- [ ] Implement `convert_claude_skill(path, output_name)`
- [ ] Extract bash commands from code blocks
- [ ] Create `ToolDefinition` with bash implementation
- [ ] Handle edge cases (no code blocks, multiple blocks, etc.)

**Dependencies**: `re`, `schemas.py`

**Estimated Time**: 4-5 hours

---

### 2.10 Built-in Tool Registry

**File**: `python/faber/tools/__init__.py`

**Purpose**: Registry of built-in tools that agents can use

**Tasks**:
- [ ] Create `BUILTIN_TOOLS` dict mapping names to tool functions
- [ ] Register existing tools (fetch_issue, create_branch, etc.)
- [ ] Create `get_builtin_tool(name)` function
- [ ] Update agent factory to load built-in tools by name

**Dependencies**: Existing tools in `faber/tools/`

**Estimated Time**: 2 hours

---

## 3. CLI Implementation

### 3.1 Agent Commands

**File**: `cli/commands/agent.py` (or fractary-cli if separate repo)

**Tasks**:
- [ ] Create `agent` command group
- [ ] Implement `agent list [--tags]` - list agents
- [ ] Implement `agent show <name>` - display agent details
- [ ] Implement `agent create` - interactive agent creation wizard
- [ ] Implement `agent invoke <name> <task>` - invoke agent
- [ ] Implement `agent test <name> [--dry-run]` - test agent
- [ ] Implement `agent validate <name>` - validate YAML
- [ ] Implement `agent convert <path> <name>` - convert from Claude Code
- [ ] Add rich output formatting (tables, colors)
- [ ] Add progress indicators for long operations

**Dependencies**: `click`, `rich`, `faber.definitions.api`

**Estimated Time**: 6-8 hours

**Example**:
```python
@click.group()
def agent():
    """Manage agents."""
    pass

@agent.command()
@click.option("--tags", help="Filter by tags")
def list(tags):
    """List available agents."""
    from faber.definitions.api import AgentAPI
    api = AgentAPI()
    agents = api.list_agents(tags=tags.split(",") if tags else None)

    for agent in agents:
        click.echo(f"• {agent.name} - {agent.description}")
```

---

### 3.2 Tool Commands

**File**: `cli/commands/tool.py`

**Tasks**:
- [ ] Create `tool` command group
- [ ] Implement `tool list [--tags]`
- [ ] Implement `tool show <name>`
- [ ] Implement `tool create` - interactive tool creation wizard
- [ ] Implement `tool invoke <name> [params]`
- [ ] Implement `tool test <name> [--dry-run]`
- [ ] Implement `tool validate <name>`
- [ ] Implement `tool convert <path> <name>`

**Dependencies**: `click`, `rich`, `faber.definitions.api`

**Estimated Time**: 6-8 hours

---

### 3.3 Init Command

**File**: `cli/commands/init.py`

**Tasks**:
- [ ] Create `init` command
- [ ] Interactive wizard for project setup
- [ ] Create `.fractary/` directory structure
- [ ] Create example agent and tool
- [ ] Create `.fractary.yaml` config file
- [ ] Optionally create example workflow

**Dependencies**: `click`, `pathlib`

**Estimated Time**: 3-4 hours

**Example**:
```bash
$ fractary init

? Project name: my-project
? What type of project?
  > Software Development
    Data Engineering
    Infrastructure

✓ Created .fractary/agents/
✓ Created .fractary/tools/
✓ Created .fractary/workflows/
✓ Created .fractary/docs/
✓ Created example agent: .fractary/agents/example.yaml

Next steps:
  1. Edit .fractary/agents/example.yaml
  2. Run: fractary agent list
  3. Test: fractary agent invoke example "Hello"
```

---

### 3.4 Validation Command

**File**: `cli/commands/validate.py`

**Tasks**:
- [ ] Create `validate-all` command
- [ ] Validate all agents in `.fractary/agents/`
- [ ] Validate all tools in `.fractary/tools/`
- [ ] Validate all workflows in `.fractary/workflows/`
- [ ] Display validation errors with helpful messages
- [ ] Return exit code 0 for success, 1 for errors (for CI)

**Dependencies**: `click`, `faber.definitions.registry`

**Estimated Time**: 2-3 hours

---

### 3.5 Schema Export Command

**File**: `cli/commands/schema.py`

**Tasks**:
- [ ] Create `schema export <type>` command
- [ ] Export AgentDefinition JSON schema
- [ ] Export ToolDefinition JSON schema
- [ ] Export WorkflowSchema JSON schema
- [ ] Format output for VS Code YAML extension

**Dependencies**: `click`, `json`, `faber.definitions.schemas`

**Estimated Time**: 2 hours

**Example**:
```bash
$ fractary schema export agent > agent-schema.json
$ fractary schema export tool > tool-schema.json

# Use in VS Code
# .vscode/settings.json:
{
  "yaml.schemas": {
    "./agent-schema.json": ".fractary/agents/*.yaml"
  }
}
```

---

## 4. Testing

### 4.1 Unit Tests

**Tasks**:
- [ ] Test `DefinitionRegistry` - discovery, loading, saving
- [ ] Test `AgentFactory` - agent creation, tool binding
- [ ] Test `ToolExecutor` - bash, python, http execution
- [ ] Test `CachedAgentContext` - block building
- [ ] Test converters - Claude Code → YAML
- [ ] Test schema validation - valid/invalid YAML

**Files**: `tests/test_definitions/`

**Estimated Time**: 8-10 hours

---

### 4.2 Integration Tests

**Tasks**:
- [ ] Test end-to-end agent invocation
- [ ] Test end-to-end tool execution
- [ ] Test workflow with agent/tool steps
- [ ] Test prompt caching (verify cache hits)
- [ ] Test CLI commands

**Files**: `tests/integration/`

**Estimated Time**: 6-8 hours

---

### 4.3 Example Projects

**Tasks**:
- [ ] Create example: Data engineering project with Glue agents/tools
- [ ] Create example: Infrastructure project with Terraform agents/tools
- [ ] Create example: Web app project with development agents/tools
- [ ] Document each example with README

**Files**: `examples/`

**Estimated Time**: 6-8 hours

---

## 5. Documentation

### 5.1 API Documentation

**Tasks**:
- [ ] Add docstrings to all public classes/methods
- [ ] Generate Sphinx/MkDocs documentation
- [ ] Add usage examples to docstrings
- [ ] Create API reference

**Estimated Time**: 4-5 hours

---

### 5.2 User Guides

**Tasks**:
- [ ] Quick start guide (already have: PROJECT_IMPLEMENTATION_GUIDE.md)
- [ ] Agent definition guide (already have: SPEC-00028)
- [ ] Tool definition guide (already have: SPEC-00028)
- [ ] Migration guide (already have in SPEC-00028)
- [ ] Troubleshooting guide (already have in SPEC-00028)

**Estimated Time**: 2-3 hours (mostly done!)

---

## 6. Dependencies to Add

### 6.1 Python Dependencies

Add to `pyproject.toml` or `requirements.txt`:

```toml
[tool.poetry.dependencies]
python = "^3.10"
pydantic = "^2.0"
PyYAML = "^6.0"
anthropic = "^0.40.0"  # For Claude API with caching
langchain-core = "^0.3"
langchain-anthropic = "^0.3"
langchain-openai = "^0.2"
langgraph = "^0.2"
httpx = "^0.27"  # For HTTP tool execution

[tool.poetry.group.cli.dependencies]
click = "^8.1"
rich = "^13.0"  # For beautiful CLI output
```

### 6.2 CLI Dependencies

If CLI is separate package:

```toml
[tool.poetry.dependencies]
faber-sdk = "^1.0"  # Depend on SDK
click = "^8.1"
rich = "^13.0"
```

---

## 7. Implementation Timeline

### Phase 1: Core Foundation (Week 1-2)
**Total: 30-35 hours**

- [x] Schema definitions (3-4h)
- [x] Registry system (4-5h)
- [x] Tool executor (6-8h)
- [x] Agent factory (5-6h)
- [x] Cached context builder (3-4h)
- [x] Enhanced cached agent (4-5h)
- [x] Built-in tool registry (2h)
- [x] Unit tests for above (8-10h)

**Milestone**: Can define agents/tools in YAML and load them programmatically

---

### Phase 2: SDK API & Converters (Week 3)
**Total: 15-18 hours**

- [x] SDK public API (3-4h)
- [x] Converters from Claude Code (4-5h)
- [x] Workflow compiler updates (6-8h)
- [x] Integration tests (6h)

**Milestone**: Can use agents/tools via SDK, convert from Claude Code

---

### Phase 3: CLI Commands (Week 4)
**Total: 20-25 hours**

- [x] Agent commands (6-8h)
- [x] Tool commands (6-8h)
- [x] Init command (3-4h)
- [x] Validation command (2-3h)
- [x] Schema export (2h)
- [x] CLI integration tests (2h)

**Milestone**: Full CLI functionality

---

### Phase 4: Examples & Documentation (Week 5)
**Total: 12-16 hours**

- [x] Example projects (6-8h)
- [x] API documentation (4-5h)
- [x] Final user guides (2-3h)

**Milestone**: Production-ready with examples and docs

---

## 8. Success Criteria

- [ ] YAML agent definition can be loaded and executed
- [ ] YAML tool definition can be loaded and executed
- [ ] Agents can use both built-in and custom tools
- [ ] Prompt caching works and saves tokens
- [ ] CLI can create, list, invoke agents/tools
- [ ] Can convert Claude Code agents/skills to YAML
- [ ] Workflows can reference agents/tools by name
- [ ] All tests passing
- [ ] Examples work end-to-end
- [ ] Documentation complete

---

## 9. File Checklist

### New Files to Create

**SDK (python/faber/)**:
```
definitions/
├── __init__.py
├── schemas.py              ✓ Define
├── registry.py             ✓ Implement
├── agent_factory.py        ✓ Implement
├── tool_executor.py        ✓ Implement
├── api.py                  ✓ Implement
└── converters.py           ✓ Implement

agents/
└── cached_context.py       ✓ Implement

tools/
└── __init__.py             ✓ Update (builtin registry)
```

**CLI (cli/commands/)**:
```
agent.py                    ✓ Implement
tool.py                     ✓ Implement
init.py                     ✓ Implement
validate.py                 ✓ Implement
schema.py                   ✓ Implement
```

**Tests**:
```
tests/
├── test_definitions/
│   ├── test_schemas.py
│   ├── test_registry.py
│   ├── test_agent_factory.py
│   ├── test_tool_executor.py
│   └── test_converters.py
└── integration/
    ├── test_agent_invocation.py
    ├── test_tool_execution.py
    └── test_cli_commands.py
```

**Examples**:
```
examples/
├── data-engineering/
│   ├── .fractary/agents/
│   ├── .fractary/tools/
│   └── README.md
├── infrastructure/
└── web-app/
```

### Files to Update

**SDK**:
- `python/faber/accessibility/compiler.py` - Add step-level support
- `python/faber/accessibility/schemas.py` - Add Step schema
- `python/faber/agents/cached_claude_agent.py` - Enhance caching

**CLI**:
- `cli/main.py` - Register new command groups

---

## 10. Next Steps

1. **Review this plan** with team
2. **Prioritize phases** based on needs
3. **Assign tasks** to developers
4. **Set up project board** to track progress
5. **Start with Phase 1** (core foundation)

**Recommended First Task**: Implement `schemas.py` - everything else builds on this.
