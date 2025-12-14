# SPEC-00028: Agent & Tool Definition System

## Status: Draft
## Version: 1.0.0
## Last Updated: 2025-12-14

---

## 1. Executive Summary

This specification defines the **Agent & Tool Definition System** - a universal, declarative format for defining custom agents and tools that work across the Fractary ecosystem (SDK, CLI, FABER workflows, and web dashboard).

### 1.1 Goals

1. **Simple**: Users define agents/tools in YAML, not code
2. **Universal**: Same definitions work across SDK, CLI, workflows, and web
3. **Portable**: Not locked to any specific LLM or platform
4. **Source-controlled**: Definitions live in `.fractary/` directory alongside code
5. **Interoperable**: Web dashboard and local files stay in sync

### 1.2 Key Principles

- **Declarative over imperative**: Describe WHAT, not HOW
- **YAML-first**: All definitions are YAML files (JSON also supported)
- **Schema-validated**: Pydantic validates structure (internal implementation)
- **Project-specific**: Each project defines its own agents/tools
- **Reusable**: Agents/tools can be referenced in workflows

---

## 2. Directory Structure

Projects using the Agent & Tool Definition System have this structure:

```
my-project/
├── .fractary/
│   ├── agents/              # Agent definitions (YAML)
│   │   ├── data-engineer.yaml
│   │   ├── data-validator.yaml
│   │   └── infrastructure-deployer.yaml
│   ├── tools/               # Tool definitions (YAML)
│   │   ├── glue-execute.yaml
│   │   ├── terraform-deploy.yaml
│   │   └── schema-analyzer.yaml
│   ├── workflows/           # FABER workflows (YAML)
│   │   └── dataset-maintain.yaml
│   └── docs/                # Documentation to cache
│       ├── STANDARDS.md
│       ├── TEMPLATES.md
│       └── PATTERNS.md
├── src/                     # Application code
└── README.md
```

---

## 3. Agent Definition Format

### 3.1 Complete Agent Schema

Agents are defined in `.fractary/agents/{name}.yaml`:

```yaml
# .fractary/agents/example-agent.yaml

# ============================================================================
# Metadata (Required)
# ============================================================================

name: example-agent
description: Single-line description of what this agent does
type: agent  # Must be "agent"

# ============================================================================
# LLM Configuration (Required)
# ============================================================================

llm:
  provider: anthropic  # anthropic | openai | google
  model: claude-sonnet-4-20250514
  temperature: 0.0    # 0.0-1.0, default 0.0
  max_tokens: 4096    # Optional, default 4096

# ============================================================================
# System Prompt (Required)
# ============================================================================

system_prompt: |
  You are the Example Agent in the Fractary system.

  ## Mission
  Your primary goal is to...

  ## Responsibilities
  1. Do this
  2. Do that
  3. Do another thing

  ## Guidelines
  - Follow the project standards
  - Use the templates as starting points
  - Ensure all code passes validation

# ============================================================================
# Tools (Optional)
# ============================================================================

# Built-in tools this agent can use
tools:
  - read_file           # Read files from filesystem
  - write_file          # Write files to filesystem
  - glob                # Find files by pattern
  - grep                # Search file contents
  - bash                # Execute bash commands
  - create_specification  # Create specs
  - validate_specification  # Validate specs

# Custom tools specific to this agent
custom_tools:
  - name: get_source_schema
    description: Fetch schema definition from source system
    parameters:
      dataset:
        type: string
        description: Dataset name (e.g., "claims")
        required: true
      table:
        type: string
        description: Table name (e.g., "medical_claims")
        required: true
    implementation:
      type: python
      module: custom.tools.schema
      function: get_source_schema

  - name: validate_etl_script
    description: Validate ETL script against coding standards
    parameters:
      script_path:
        type: string
        description: Path to ETL script
        required: true
    implementation:
      type: bash
      command: |
        pylint ${script_path}
        pytest tests/test_${script_path}

# ============================================================================
# Prompt Caching (Optional)
# ============================================================================

caching:
  enabled: true  # Enable Claude API prompt caching
  cache_sources:
    # Cache a single file
    - type: file
      path: .fractary/docs/STANDARDS.md
      label: "Project Standards"

    # Cache multiple files matching a pattern
    - type: glob
      pattern: .fractary/templates/*.py
      label: "Code Templates"

    # Cache inline content
    - type: inline
      label: "Domain Knowledge"
      content: |
        This is a fintech application handling sensitive data.
        Always ensure PCI compliance...

# ============================================================================
# Configuration (Optional)
# ============================================================================

config:
  max_iterations: 50      # Max agent loops
  require_approval: false # Pause for human approval
  timeout_seconds: 300    # Timeout

# ============================================================================
# Metadata (Optional)
# ============================================================================

version: "1.0"
author: "Your Name"
tags:
  - data-engineering
  - etl
  - aws-glue
```

### 3.2 Minimal Agent Example

Simplest possible agent:

```yaml
# .fractary/agents/simple-agent.yaml

name: simple-agent
description: A simple agent that does one thing well
type: agent

llm:
  provider: anthropic
  model: claude-sonnet-4-20250514

system_prompt: |
  You are a helpful assistant that helps with code reviews.
  Review code for bugs, security issues, and best practices.

tools:
  - read_file
  - grep
```

### 3.3 Real-World Example: Data Engineer

```yaml
# .fractary/agents/corthion-loader-engineer.yaml

name: corthion-loader-engineer
description: Create or update AWS Glue ETL loaders following Data-First Workflow
type: agent

llm:
  provider: anthropic
  model: claude-opus-4-20250514  # Use Opus for complex reasoning
  temperature: 0.0

system_prompt: |
  You are the Corthion Loader Engineer agent.

  ## Mission
  Create or modify AWS Glue ETL loaders that follow Data-First Workflow principles.

  ## Responsibilities
  1. Analyze source data structure and data dictionaries
  2. Generate or update Glue ETL Python code using Spark DataFrames
  3. Follow established patterns in /loaders/patterns/
  4. Ensure idempotency, error handling, and comprehensive logging
  5. Create unit tests for all transformations

  ## Code Standards
  - Use Spark DataFrame API (not RDD)
  - Follow naming: {dataset}_{table}_loader.py
  - Include type hints and docstrings
  - Handle schema evolution gracefully
  - Log at INFO level for major steps, DEBUG for details

  ## Output Requirements
  - Loader code in /loaders/{dataset}/
  - Unit tests in /tests/loaders/{dataset}/
  - Update LOADER.md documentation

tools:
  - read_file
  - write_file
  - glob
  - grep
  - bash

custom_tools:
  - name: get_source_schema
    description: Fetch schema from source data dictionary
    parameters:
      dataset:
        type: string
        required: true
      table:
        type: string
        required: true
    implementation:
      type: python
      module: corthion.tools.schema
      function: get_source_schema

  - name: validate_glue_script
    description: Validate Glue script syntax and patterns
    parameters:
      script_path:
        type: string
        required: true
    implementation:
      type: bash
      command: |
        # Validate Python syntax
        python -m py_compile ${script_path}

        # Run pylint with project config
        pylint ${script_path} --rcfile=.pylintrc

        # Check for required patterns
        grep -q "from pyspark.sql import DataFrame" ${script_path} || exit 1
        grep -q "def transform(" ${script_path} || exit 1

caching:
  enabled: true
  cache_sources:
    - type: file
      path: .fractary/docs/DATA_FIRST_WORKFLOW.md
      label: "Data-First Workflow Guide"

    - type: file
      path: .fractary/docs/CODING_STANDARDS.md
      label: "Coding Standards"

    - type: codex
      uri: codex://fractary/standards/etl-best-practices.md
      label: "ETL Best Practices (from Codex)"

    - type: glob
      pattern: loaders/patterns/*.py
      label: "Established Loader Patterns"

    - type: glob
      pattern: .fractary/templates/glue_*.py
      label: "Glue Templates"

tags:
  - data-engineering
  - etl
  - aws-glue
  - corthion

version: "1.0"
author: "Fractary Team"
```

---

## 4. Tool Definition Format

### 4.1 Complete Tool Schema

Tools are defined in `.fractary/tools/{name}.yaml`:

```yaml
# .fractary/tools/example-tool.yaml

# ============================================================================
# Metadata (Required)
# ============================================================================

name: example-tool
description: Single-line description of what this tool does
type: tool  # Must be "tool"

# ============================================================================
# Parameters (Required)
# ============================================================================

parameters:
  param1:
    type: string  # string | integer | boolean | object | array
    description: Description of this parameter
    required: true
    enum:  # Optional: restrict to specific values
      - value1
      - value2

  param2:
    type: integer
    description: Another parameter
    required: false
    default: 10

  param3:
    type: object
    description: Complex object parameter
    required: false
    properties:
      nested_field:
        type: string

# ============================================================================
# Implementation (Required - pick ONE type)
# ============================================================================

# Option 1: Bash implementation
implementation:
  type: bash
  command: |
    echo "Executing with ${param1} and ${param2}"
    # Your bash script here

  # Optional: Sandbox configuration
  sandbox:
    enabled: true
    allowlisted_commands:
      - echo
      - aws
      - terraform
    network_access: true  # Required for API calls
    max_execution_time: 600  # seconds
    env_vars:  # Environment variables to expose
      - AWS_REGION
      - AWS_PROFILE

# Option 2: Python implementation
implementation:
  type: python
  module: myproject.tools.custom  # Python module path
  function: my_function_name      # Function name

# Option 3: HTTP implementation
implementation:
  type: http
  method: POST  # GET | POST | PUT | DELETE
  url: https://api.example.com/v1/resource
  headers:
    Content-Type: application/json
    Authorization: Bearer ${API_TOKEN}
  body_template: |
    {
      "param1": "${param1}",
      "param2": ${param2}
    }

# ============================================================================
# Output Schema (Optional)
# ============================================================================

output:
  type: object
  properties:
    status:
      type: string
      enum: [success, failure]
    result:
      type: string
    details:
      type: object

# ============================================================================
# Metadata (Optional)
# ============================================================================

version: "1.0"
author: "Your Name"
tags:
  - infrastructure
  - deployment
```

### 4.2 Real-World Example: Terraform Deploy

```yaml
# .fractary/tools/terraform-deploy.yaml

name: terraform-deploy
description: Deploy infrastructure using Terraform with safety checks
type: tool

parameters:
  environment:
    type: string
    description: Target environment
    required: true
    enum:
      - dev
      - test
      - prod

  target:
    type: string
    description: Terraform target resource (optional, deploys all if not specified)
    required: false
    default: null

  auto_approve:
    type: boolean
    description: Skip approval prompt (use with caution)
    required: false
    default: false

implementation:
  type: bash
  command: |
    set -e  # Exit on error

    cd terraform/${environment}

    # Initialize Terraform
    terraform init

    # Create plan
    if [ -n "${target}" ]; then
      terraform plan -out=tfplan -target="${target}"
    else
      terraform plan -out=tfplan
    fi

    # Apply (with or without approval)
    if [ "${auto_approve}" = "true" ]; then
      terraform apply -auto-approve tfplan
    else
      terraform apply tfplan
    fi

    # Output results
    terraform output -json

  sandbox:
    enabled: true
    allowlisted_commands:
      - terraform
      - aws
      - cd
      - set
    network_access: true  # Needed for AWS API
    max_execution_time: 1800  # 30 minutes
    env_vars:
      - AWS_REGION
      - AWS_PROFILE
      - TF_VAR_project_name

output:
  type: object
  properties:
    status:
      type: string
      enum: [success, failure]
    resources_changed:
      type: integer
    terraform_output:
      type: object

version: "1.0"
author: "Infrastructure Team"
tags:
  - infrastructure
  - terraform
  - deployment
  - iac
```

### 4.3 Real-World Example: AWS Glue Job Execution

```yaml
# .fractary/tools/glue-execute.yaml

name: glue-execute
description: Execute an AWS Glue ETL job and wait for completion
type: tool

parameters:
  job_name:
    type: string
    description: Name of the Glue job to execute
    required: true

  environment:
    type: string
    description: Environment (affects which Glue job name to use)
    required: true
    enum: [dev, test, prod]

  arguments:
    type: object
    description: Job arguments as key-value pairs
    required: false
    default: {}

  wait_for_completion:
    type: boolean
    description: Wait for job to complete before returning
    required: false
    default: true

  timeout_minutes:
    type: integer
    description: Maximum time to wait for job completion
    required: false
    default: 60

implementation:
  type: python
  module: corthion.tools.glue
  function: execute_glue_job

output:
  type: object
  properties:
    status:
      type: string
      enum: [SUCCEEDED, FAILED, STOPPED, RUNNING, STARTING]
    job_run_id:
      type: string
    duration_seconds:
      type: integer
    error_message:
      type: string
    logs_url:
      type: string

version: "1.0"
author: "Data Engineering Team"
tags:
  - aws
  - glue
  - etl
  - data-pipeline
```

---

## 5. Using Definitions in FABER Workflows

### 5.1 Referencing Agents in Workflow Steps

```yaml
# .fractary/workflows/dataset-maintain.yaml

name: dataset-maintain
description: Maintain dataset health and standards compliance

phases:
  build:
    description: Engineer loader and deploy infrastructure
    steps:
      # Step using an AGENT (LLM-powered)
      - id: loader-engineer
        name: Engineer Loader
        description: Create or update ETL code
        agent: corthion-loader-engineer  # References .fractary/agents/
        inputs:
          dataset: "{dataset}"
          table: "{table}"
        outputs:
          - loader_path
          - tests_created

      # Step using a TOOL (deterministic)
      - id: loader-deploy
        name: Deploy Infrastructure
        description: Deploy via Terraform
        tool: terraform-deploy  # References .fractary/tools/
        inputs:
          environment: "{environment}"
          target: "aws_glue_job.{dataset}_{table}"
          auto_approve: false
```

### 5.2 When to Use Agent vs Tool

**Use an AGENT when:**
- You need LLM reasoning and decision-making
- The task requires understanding context or natural language
- Multiple approaches exist and intelligent selection is needed
- Examples: code generation, analysis, review, planning

**Use a TOOL when:**
- The logic is deterministic
- You just need to execute a specific command or API call
- No reasoning required
- Examples: deploying infrastructure, running tests, executing jobs

---

## 6. Implementation Reference

### 6.1 Parameter Types

| Type | Description | Example |
|------|-------------|---------|
| `string` | Text value | `"hello"` |
| `integer` | Whole number | `42` |
| `boolean` | True/false | `true` |
| `number` | Decimal number | `3.14` |
| `object` | Nested structure | `{key: value}` |
| `array` | List of values | `[1, 2, 3]` |

### 6.2 Tool Implementation Types

#### Bash Implementation

```yaml
implementation:
  type: bash
  command: |
    # Your shell script here
    # Can use ${param_name} for parameter substitution
    echo "Processing ${dataset}"

  sandbox:
    enabled: true
    allowlisted_commands: [echo, aws, terraform]
    network_access: true
    max_execution_time: 600
    env_vars: [AWS_REGION]
```

**Security**: Bash tools run in a sandboxed environment with:
- Command allowlist (only specified commands permitted)
- Network access control
- Execution time limits
- Environment variable restrictions

#### Python Implementation

```yaml
implementation:
  type: python
  module: myproject.tools.analytics
  function: analyze_dataset
```

**Requirements**:
- Python function must exist at `myproject.tools.analytics.analyze_dataset`
- Function signature must match parameters defined in tool
- Function should return dict matching output schema

Example Python implementation:

```python
# myproject/tools/analytics.py

def analyze_dataset(dataset: str, table: str) -> dict:
    """Analyze dataset and return statistics."""
    # Your implementation
    return {
        "status": "success",
        "row_count": 12345,
        "column_count": 42,
    }
```

#### HTTP Implementation

```yaml
implementation:
  type: http
  method: POST
  url: https://api.example.com/v1/jobs
  headers:
    Authorization: Bearer ${API_TOKEN}
  body_template: |
    {
      "dataset": "${dataset}",
      "environment": "${environment}"
    }
```

**Features**:
- Supports GET, POST, PUT, DELETE
- Template variables in URL, headers, and body
- Response parsed as JSON

### 6.3 Prompt Caching Sources

#### File Source

```yaml
cache_sources:
  - type: file
    path: .fractary/docs/STANDARDS.md
    label: "Project Standards"
```

Loads a single file for caching.

#### Glob Source

```yaml
cache_sources:
  - type: glob
    pattern: .fractary/templates/*.py
    label: "Code Templates"
```

Loads all files matching pattern, concatenates them.

#### Inline Source

```yaml
cache_sources:
  - type: inline
    label: "Domain Knowledge"
    content: |
      Multi-line content here...
```

Inline content to cache.

#### Codex Source

```yaml
cache_sources:
  - type: codex
    uri: codex://fractary/standards/api-design.md
    label: "API Design Standards"
```

Automatically fetches and caches content from Codex URIs. This is perfect for:
- Shared organizational standards
- Cross-project documentation
- Common patterns and templates

**Benefits**:
- Content from `codex://` is automatically cached (no manual config needed)
- Standards stay consistent across projects
- Updates propagate when cache expires (5 minutes)
- Requires `fractary-codex` plugin

**Cache Benefits**:
- ~90% savings on input tokens for cache hits
- Cache lasts 5 minutes
- Ideal for standards, templates, patterns that don't change

---

## 7. CLI Usage

### 7.1 Agent Commands

```bash
# List all agents
fractary agent list

# List agents by tag
fractary agent list --tags data-engineering

# View agent details
fractary agent show corthion-loader-engineer

# Create new agent interactively
fractary agent create

# Invoke an agent
fractary agent invoke corthion-loader-engineer "Create loader for claims.medical"

# Test an agent
fractary agent test corthion-loader-engineer

# Convert Claude Code agent to .fractary format
fractary agent convert .claude/agents/old-agent.md new-agent
```

### 7.2 Tool Commands

```bash
# List all tools
fractary tool list

# View tool details
fractary tool show terraform-deploy

# Create new tool interactively
fractary tool create

# Invoke a tool
fractary tool invoke terraform-deploy --environment=test --target=glue_job

# Test a tool
fractary tool test terraform-deploy

# Convert Claude Code skill to .fractary format
fractary tool convert .claude/skills/old-skill.md new-tool
```

---

## 8. SDK Usage

### 8.1 Using Agents Programmatically

```python
from faber.definitions.api import AgentAPI

# Initialize API
api = AgentAPI()

# List all agents
agents = api.list_agents()

# Load an agent
agent = api.load_agent("corthion-loader-engineer")

# Invoke an agent
result = await api.invoke_agent(
    "corthion-loader-engineer",
    "Create loader for claims.medical_claims",
    context={
        "dataset": "claims",
        "table": "medical_claims",
        "environment": "test"
    }
)

print(result["output"])
```

### 8.2 Using Tools Programmatically

```python
from faber.definitions.api import ToolAPI

# Initialize API
api = ToolAPI()

# List all tools
tools = api.list_tools()

# Invoke a tool
result = api.invoke_tool(
    "terraform-deploy",
    environment="test",
    target="aws_glue_job.claims_medical",
    auto_approve=False
)

print(result["status"])
```

---

## 9. Migration from Claude Code

### 9.1 Converting Agents

**Before** (`.claude/agents/data-engineer.md`):

```markdown
# Data Engineer Agent

You are a data engineering agent that creates ETL pipelines.

## Instructions

- Analyze source data
- Generate Glue code
- Follow best practices
```

**After** (`.fractary/agents/data-engineer.yaml`):

```yaml
name: data-engineer
description: Creates ETL pipelines for data processing
type: agent

llm:
  provider: anthropic
  model: claude-sonnet-4-20250514

system_prompt: |
  You are a data engineering agent that creates ETL pipelines.

  ## Instructions

  - Analyze source data
  - Generate Glue code
  - Follow best practices

tools:
  - read_file
  - write_file
```

**Convert automatically**:

```bash
fractary agent convert .claude/agents/data-engineer.md data-engineer
```

### 9.2 Converting Skills

**Before** (`.claude/skills/deploy.md`):

```markdown
# Deploy Infrastructure

Deploy using Terraform.

## Implementation

```bash
cd terraform/$1
terraform apply
```
```

**After** (`.fractary/tools/deploy.yaml`):

```yaml
name: deploy
description: Deploy using Terraform
type: tool

parameters:
  environment:
    type: string
    required: true

implementation:
  type: bash
  command: |
    cd terraform/${environment}
    terraform apply
```

**Convert automatically**:

```bash
fractary tool convert .claude/skills/deploy.md deploy
```

---

## 10. Web Dashboard Integration

### 10.1 Editing in app.fractary.com

The web dashboard at **app.fractary.com** provides a visual interface for managing agents and tools:

1. **Browse**: View all agents/tools with search and filtering
2. **Create**: Visual form builder with schema validation
3. **Edit**: YAML editor with syntax highlighting and autocomplete
4. **Test**: Test agents/tools directly in the browser
5. **Sync**: Changes sync bidirectionally with your git repository

### 10.2 Sync Workflow

```
┌─────────────────────┐
│  Local Repository   │
│  .fractary/agents/  │
└──────────┬──────────┘
           │
           │ git push
           ▼
┌─────────────────────┐
│   GitHub/GitLab     │
└──────────┬──────────┘
           │
           │ webhook
           ▼
┌─────────────────────┐
│  app.fractary.com   │
│  (Dashboard)        │
└──────────┬──────────┘
           │
           │ edit
           ▼
┌─────────────────────┐
│  Commit & PR        │
│  Back to repo       │
└─────────────────────┘
```

**Benefits**:
- Visual editing with validation
- Collaborative editing
- Version history
- PR workflow for changes
- No context switching

---

## 11. Best Practices

### 11.1 Agent Design

1. **Single Responsibility**: Each agent should have one clear purpose
2. **Comprehensive Prompts**: Include mission, responsibilities, and guidelines
3. **Cache Static Content**: Use prompt caching for standards, templates, patterns
4. **Right-Size the Model**: Use Opus for complex reasoning, Sonnet for balanced, Haiku for simple
5. **Provide Context**: Give agents access to relevant documentation

### 11.2 Tool Design

1. **Idempotent**: Tools should be safe to run multiple times
2. **Error Handling**: Return structured errors, not exceptions
3. **Validation**: Validate inputs before execution
4. **Logging**: Log important steps for debugging
5. **Secure**: Use sandbox for bash tools, validate all inputs

### 11.3 Prompt Caching

1. **Cache Large Content**: Standards, templates, patterns (>1000 tokens)
2. **Order Matters**: Put cached content at the start of system message
3. **Stable Content**: Only cache content that doesn't change frequently
4. **Measure Impact**: Check usage.cache_* fields in responses

### 11.4 Naming Conventions

- **Agents**: `{domain}-{purpose}` (e.g., `corthion-loader-engineer`)
- **Tools**: `{action}-{noun}` (e.g., `terraform-deploy`)
- **Tags**: Use lowercase, hyphenated (e.g., `data-engineering`)

---

## 12. Validation & Testing

### 12.1 Schema Validation

All YAML files are validated against Pydantic schemas:

```bash
# Validate an agent definition
fractary agent validate corthion-loader-engineer

# Validate a tool definition
fractary tool validate terraform-deploy

# Validate all definitions
fractary validate-all
```

### 12.2 Testing Agents

```bash
# Test with sample task
fractary agent test corthion-loader-engineer \
  --task "Create loader for test.sample_table" \
  --context '{"dataset": "test", "table": "sample_table"}'

# Dry run (don't execute tools)
fractary agent test corthion-loader-engineer --dry-run
```

### 12.3 Testing Tools

```bash
# Test with parameters
fractary tool test terraform-deploy \
  --environment=dev \
  --target=test_resource \
  --auto-approve=false

# Dry run (validate but don't execute)
fractary tool test terraform-deploy --dry-run
```

---

## 13. Examples by Use Case

### 13.1 Data Engineering

**Agent**: ETL Code Generator
**Tools**: Schema Analyzer, Glue Executor, Data Validator

```yaml
# .fractary/agents/etl-engineer.yaml
name: etl-engineer
llm:
  provider: anthropic
  model: claude-opus-4-20250514
system_prompt: |
  Generate AWS Glue ETL code following best practices...
tools:
  - read_file
  - write_file
custom_tools:
  - name: analyze_schema
  - name: execute_glue_job
caching:
  enabled: true
  cache_sources:
    - type: file
      path: .fractary/docs/ETL_STANDARDS.md
```

### 13.2 Infrastructure as Code

**Agent**: Infrastructure Architect
**Tools**: Terraform Deploy, CloudFormation Deploy, kubectl Apply

```yaml
# .fractary/agents/infra-architect.yaml
name: infra-architect
llm:
  provider: anthropic
  model: claude-sonnet-4-20250514
system_prompt: |
  Design and deploy cloud infrastructure using IaC...
tools:
  - read_file
  - write_file
custom_tools:
  - name: terraform-deploy
  - name: validate-terraform
```

### 13.3 Code Review

**Agent**: Code Reviewer
**Tools**: Run Tests, Lint Code, Security Scan

```yaml
# .fractary/agents/code-reviewer.yaml
name: code-reviewer
llm:
  provider: anthropic
  model: claude-opus-4-20250514
system_prompt: |
  Review code for bugs, security, and best practices...
tools:
  - read_file
  - grep
  - bash
custom_tools:
  - name: run-tests
  - name: security-scan
caching:
  enabled: true
  cache_sources:
    - type: file
      path: .fractary/docs/CODE_STANDARDS.md
```

---

## 14. Troubleshooting

### 14.1 Agent Not Found

**Error**: `Agent not found: my-agent`

**Solutions**:
- Check file exists: `.fractary/agents/my-agent.yaml`
- Verify filename matches agent name
- Run `fractary agent list` to see discovered agents
- Check YAML syntax: `fractary agent validate my-agent`

### 14.2 Tool Execution Failed

**Error**: `Tool execution failed: permission denied`

**Solutions**:
- Check sandbox allowlist includes required commands
- Verify network_access is true if tool needs internet
- Check environment variables are in env_vars list
- Test tool in dry-run mode: `fractary tool test my-tool --dry-run`

### 14.3 Prompt Caching Not Working

**Error**: No cache hits in usage stats

**Solutions**:
- Verify `caching.enabled: true`
- Check cache_sources paths exist
- Ensure cached content is >1000 tokens
- Cache only lasts 5 minutes - check timing
- View cache stats: `fractary agent stats my-agent`

---

## 15. JSON Schema Export

Generate JSON Schema for external validation:

```bash
# Export agent schema
fractary schema export agent > agent-schema.json

# Export tool schema
fractary schema export tool > tool-schema.json

# Use in VS Code for autocomplete
# Add to .vscode/settings.json:
{
  "yaml.schemas": {
    "./agent-schema.json": ".fractary/agents/*.yaml",
    "./tool-schema.json": ".fractary/tools/*.yaml"
  }
}
```

---

## 16. Changelog

### v1.0.0 (2025-12-14)

- Initial specification
- Agent definition schema
- Tool definition schema
- Caching configuration
- CLI command reference
- SDK API reference
- Migration guide from Claude Code
- Web dashboard integration
- Best practices and examples

---

## 17. References

- SPEC-00025: LangGraph Integration Architecture
- SPEC-00026: FABER Accessibility Layer
- SPEC-00027: Multi-Workflow Orchestration
- [Pydantic Documentation](https://docs.pydantic.dev/)
- [YAML Specification](https://yaml.org/spec/)
- [Anthropic Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
