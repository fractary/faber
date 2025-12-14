# Agent & Tool Definition System

This module provides the core infrastructure for defining, discovering, and executing custom agents and tools using YAML definitions.

## Architecture

```
.fractary/agents/*.yaml  →  DefinitionRegistry  →  AgentFactory  →  Executable Agent
.fractary/tools/*.yaml   →  DefinitionRegistry  →  ToolExecutor  →  Tool Results
```

## Components

### 1. **schemas.py** - Pydantic Models
Defines the schema for YAML agent and tool definitions with validation.

Key models:
- `AgentDefinition` - Complete agent schema
- `ToolDefinition` - Complete tool schema
- `LLMConfig` - LLM provider configuration
- `CachingConfig` - Prompt caching configuration

### 2. **registry.py** - Discovery & Loading
Scans `.fractary/agents/` and `.fractary/tools/` directories, loads and validates YAML files.

```python
from faber.definitions.registry import get_registry

registry = get_registry()
agent = registry.get_agent("my-agent")
tools = registry.list_tools(tags=["infrastructure"])
```

### 3. **tool_executor.py** - Tool Execution
Executes tools based on their implementation type (bash, python, http) with sandboxing.

```python
from faber.definitions.tool_executor import create_tool_executor

executor = create_tool_executor(tool_def)
result = await executor.execute({"param": "value"})
```

### 4. **agent_factory.py** - Agent Creation
Creates executable agents from YAML definitions, handles tools and caching.

```python
from faber.definitions.agent_factory import AgentFactory

factory = AgentFactory()
agent = factory.create_agent("my-agent")
```

### 5. **api.py** - High-Level API
Simple, user-friendly SDK API for programmatic use.

```python
from faber.definitions.api import AgentAPI, ToolAPI

# Use an agent
agent_api = AgentAPI()
result = await agent_api.invoke_agent(
    "my-agent",
    "Do something",
    context={"key": "value"}
)

# Use a tool
tool_api = ToolAPI()
result = await tool_api.invoke_tool(
    "my-tool",
    param="value"
)
```

### 6. **converters.py** - Migration Utilities
Convert Claude Code agents/skills to YAML format.

```python
from faber.definitions.converters import convert_claude_agent

agent_def = convert_claude_agent(
    Path(".claude/agents/my-agent.md"),
    "my-agent"
)
```

## Usage Examples

### Define an Agent

Create `.fractary/agents/data-engineer.yaml`:

```yaml
name: data-engineer
description: Create and maintain ETL pipelines
type: agent

llm:
  provider: anthropic
  model: claude-opus-4-20250514
  temperature: 0.0

system_prompt: |
  You are a data engineering agent that creates ETL pipelines.

  Follow best practices for data processing.

tools:
  - read_file
  - write_file

custom_tools:
  - name: validate_etl
    description: Validate ETL script
    parameters:
      script_path:
        type: string
        required: true
    implementation:
      type: bash
      command: |
        pylint ${script_path}

caching:
  enabled: true
  cache_sources:
    - type: file
      path: .fractary/docs/ETL_STANDARDS.md
      label: "ETL Standards"

tags:
  - data-engineering
  - etl
```

### Define a Tool

Create `.fractary/tools/deploy.yaml`:

```yaml
name: deploy
description: Deploy infrastructure using Terraform
type: tool

parameters:
  environment:
    type: string
    required: true
    enum: [dev, test, prod]

  target:
    type: string
    required: false

implementation:
  type: bash
  command: |
    cd terraform/${environment}
    terraform apply -target=${target}

  sandbox:
    allowlisted_commands: [terraform, aws]
    network_access: true
    max_execution_time: 600

tags:
  - infrastructure
  - terraform
```

### Use from SDK

```python
from faber.definitions.api import AgentAPI

# Load and invoke agent
api = AgentAPI()
result = await api.invoke_agent(
    "data-engineer",
    "Create ETL pipeline for claims data",
    context={"dataset": "claims", "table": "medical"}
)

print(result["output"])
```

### Use from CLI

```bash
# List agents
fractary agent list

# Invoke agent
fractary agent invoke data-engineer "Create ETL pipeline"

# Invoke tool
fractary tool invoke deploy --environment=test
```

## Features

### Prompt Caching (Claude)
Save ~90% on input tokens by caching standards, templates, and patterns:

```yaml
caching:
  enabled: true
  cache_sources:
    - type: file
      path: .fractary/docs/STANDARDS.md
      label: "Standards"

    - type: codex
      uri: codex://fractary/standards/api-design.md
      label: "API Design Standards (from Codex)"

    - type: glob
      pattern: .fractary/templates/*.py
      label: "Templates"
```

**Cache Source Types**:
- `file` - Single file from project
- `glob` - Multiple files matching pattern
- `inline` - Inline content in YAML
- `codex` - Content from Codex (requires fractary-codex plugin integration)

**Codex Integration Status**:

The `codex://` cache source type is **designed and documented** but requires integration with the fractary-codex plugin to function. Currently:

✅ Schema validation works - YAML files with `type: codex` are accepted
✅ Agents load successfully - codex sources are processed without errors
⚠️ Fetching is placeholder - logs warning and skips codex sources

**To enable codex caching**:
Integration with fractary-codex plugin is needed (tracked in follow-up issue). Options being considered:
1. Pass a `codex_fetcher` callback to `CachedAgentContext`
2. Import `fractary_codex` Python module if available
3. Use codex MCP server if configured

See `python/faber/agents/cached_context.py:109-150` for the placeholder implementation and TODO comments.
```

### Tool Sandboxing
Bash tools run in a sandboxed environment:
- Command allowlist
- Network access control
- Execution time limits
- Environment variable restrictions

### Multi-LLM Support
Support for multiple LLM providers:
- Anthropic (Claude)
- OpenAI (GPT)
- Google (Gemini)

## Testing

```bash
# Run tests
pytest python/tests/test_definitions/

# Test specific component
pytest python/tests/test_definitions/test_registry.py
```

## See Also

- [SPEC-00028](../../../specs/SPEC-00028-agent-tool-definitions.md) - Complete specification
- [PROJECT_IMPLEMENTATION_GUIDE](../../../docs/PROJECT_IMPLEMENTATION_GUIDE.md) - Implementation guide
- [Agent & Tool Examples](../../../examples/) - Example projects
