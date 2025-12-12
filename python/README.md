# FABER Python SDK

AI-assisted development workflows powered by LangGraph.

FABER (Frame, Architect, Build, Evaluate, Release) provides enterprise-grade workflow orchestration for AI-assisted software development.

## Installation

```bash
# Basic installation
pip install -e .

# With all optional dependencies
pip install -e ".[all]"

# With specific backends
pip install -e ".[postgres]"  # PostgreSQL checkpointing
pip install -e ".[redis]"     # Redis checkpointing
```

## Quick Start

### Run a FABER Workflow

```bash
# Run workflow for issue #123
faber run 123

# Run with specific options
faber run 123 --autonomy assisted --max-retries 5 --budget 10.0

# Run without tracing
faber run 123 --no-trace
```

### Initialize Configuration

```bash
faber init
```

This creates `.faber/config.yaml` with default settings.

### Programmatic Usage

```python
import asyncio
from faber import create_faber_workflow, run_faber_workflow

# Run a workflow
async def main():
    result = await run_faber_workflow(work_id="123")
    print(f"Workflow completed: {result['workflow_id']}")
    print(f"PR URL: {result.get('pr_url')}")

asyncio.run(main())
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 5: FABER CLI / Studio                   │
│              User interfaces (CLI commands, visual builder)      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 4: FABER Workflow Definitions           │
│         Declarative YAML/JSON workflow configs + templates       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 3: FABER Phase Agents                   │
│         Middleware for Frame/Architect/Build/Evaluate/Release    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 2: FABER Tools                          │
│         LangChain @tool wrappers around FABER primitives         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 1: FABER Primitives                     │
│         WorkManager, RepoManager, SpecManager, LogManager        │
│         (Framework-agnostic, portable Python)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Foundation: LangGraph + LangChain             │
│         Orchestration, state management, model providers         │
└─────────────────────────────────────────────────────────────────┘
```

## FABER Phases

1. **Frame** - Gather requirements and classify work type
2. **Architect** - Create detailed specification (human approval checkpoint)
3. **Build** - Implement the solution with semantic commits
4. **Evaluate** - Validate against spec (GO/NO-GO decision, may retry Build)
5. **Release** - Create PR and deliver (human approval checkpoint)

## Configuration

Create `.faber/config.yaml`:

```yaml
workflow:
  autonomy: assisted  # assisted | guarded | autonomous
  max_retries: 3

  models:
    frame: anthropic:claude-3-5-haiku-20241022
    architect: anthropic:claude-sonnet-4-20250514
    build: anthropic:claude-sonnet-4-20250514
    evaluate: anthropic:claude-sonnet-4-20250514
    release: anthropic:claude-3-5-haiku-20241022

  human_approval:
    architect: true
    release: true

  approval:
    notify_channels:
      - cli
      - github
    response_channels:
      - cli
      - github
    timeout_minutes: 60

  checkpointing:
    backend: sqlite  # sqlite | postgres | redis
    sqlite:
      path: .faber/checkpoints.db

  cost:
    budget_limit_usd: 10.0
    warning_threshold: 0.8
    require_approval_at: 0.9

work:
  platform: github

repo:
  platform: github
  default_branch: main

observability:
  langsmith:
    enabled: true
    project: faber-workflows
```

## Environment Variables

```bash
# LangSmith tracing (optional)
export LANGSMITH_API_KEY=your-key

# Model providers
export ANTHROPIC_API_KEY=your-key
export OPENAI_API_KEY=your-key

# Database backends (optional)
export FABER_POSTGRES_URL=postgresql://...
export FABER_REDIS_URL=redis://...
```

## CLI Commands

```bash
# Run workflow
faber run <work_id> [options]
  --autonomy, -a    Autonomy level (assisted, guarded, autonomous)
  --max-retries, -r Maximum retry attempts
  --skip-phase, -s  Phases to skip
  --budget, -b      Budget limit in USD
  --trace/--no-trace Enable LangSmith tracing

# Initialize configuration
faber init [--force]

# List workflows
faber workflow list [--status <status>] [--limit <n>]

# View workflow details
faber workflow view <workflow_id>

# Show version
faber version
```

## Development

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Type checking
mypy faber

# Linting
ruff check faber
```

## License

MIT
