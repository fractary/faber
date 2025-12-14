# Project Implementation Guide: Agent & Tool Definitions

This guide helps you implement the Agent & Tool Definition System in any project.

## Prerequisites

- [ ] Fractary SDK installed: `pip install faber-sdk`
- [ ] Project uses git for version control
- [ ] Access to app.fractary.com (for web dashboard integration)

## Quick Start (5 minutes)

### 1. Initialize Directory Structure

```bash
cd your-project/

# Create .fractary structure
mkdir -p .fractary/{agents,tools,workflows,docs}

# Initialize with example
fractary init
```

This creates:
```
your-project/
├── .fractary/
│   ├── agents/
│   ├── tools/
│   ├── workflows/
│   └── docs/
└── .fractary.yaml  # Project config
```

### 2. Define Your First Agent

Create `.fractary/agents/my-first-agent.yaml`:

```yaml
name: my-first-agent
description: A simple agent to get started
type: agent

llm:
  provider: anthropic
  model: claude-sonnet-4-20250514

system_prompt: |
  You are a helpful assistant for this project.
  Help with code review, analysis, and answering questions.

tools:
  - read_file
  - grep
  - bash
```

### 3. Test It

```bash
# Verify it loaded
fractary agent list

# Test it
fractary agent invoke my-first-agent "Review the README"
```

## Step-by-Step Implementation

### Phase 1: Inventory Existing Agents/Skills (30 minutes)

If you have existing Claude Code agents or skills:

```bash
# List current Claude agents
ls .claude/agents/

# List current Claude skills
ls .claude/skills/

# Convert them
for agent in .claude/agents/*.md; do
  name=$(basename "$agent" .md)
  fractary agent convert "$agent" "$name"
done

for skill in .claude/skills/*.md; do
  name=$(basename "$skill" .md)
  fractary tool convert "$skill" "$name"
done
```

### Phase 2: Define Project-Specific Agents (1-2 hours)

For each major workflow in your project, create an agent.

#### Example: Data Engineering Project

```bash
# Create data engineering agents
fractary agent create
  Name: etl-engineer
  Description: Create and maintain ETL pipelines
  Provider: anthropic
  Model: claude-opus-4-20250514

fractary agent create
  Name: data-validator
  Description: Validate data quality and schemas
  Provider: anthropic
  Model: claude-sonnet-4-20250514
```

Then edit `.fractary/agents/etl-engineer.yaml` to add:
- System prompt with domain knowledge
- Custom tools specific to your stack
- Caching for your standards/templates

#### Example: Infrastructure Project

```bash
fractary agent create
  Name: infra-architect
  Description: Design and deploy cloud infrastructure

fractary agent create
  Name: security-reviewer
  Description: Review infrastructure for security issues
```

### Phase 3: Define Project-Specific Tools (1-2 hours)

For each deterministic operation, create a tool.

#### Common Tools

```bash
# Deployment tool
fractary tool create
  Name: deploy
  Type: bash
  Description: Deploy application to environment

# Test runner
fractary tool create
  Name: run-tests
  Type: bash
  Description: Run test suite

# Database migration
fractary tool create
  Name: migrate-db
  Type: bash
  Description: Run database migrations
```

### Phase 4: Document Standards for Caching (30 minutes)

Create documentation that agents will cache:

```bash
# Standards document
cat > .fractary/docs/STANDARDS.md <<EOF
# Project Standards

## Coding Standards
- Use TypeScript strict mode
- All functions must have JSDoc comments
- Follow Airbnb style guide

## Testing Standards
- Minimum 80% coverage
- Unit tests for all business logic
- Integration tests for APIs

## Security Standards
- No secrets in code
- Use environment variables
- Validate all inputs
EOF

# Templates
mkdir -p .fractary/templates/
# Add your code templates here
```

Then reference in agents:

```yaml
# .fractary/agents/etl-engineer.yaml
caching:
  enabled: true
  cache_sources:
    - type: file
      path: .fractary/docs/STANDARDS.md
      label: "Project Standards"
    - type: glob
      pattern: .fractary/templates/*.py
      label: "Code Templates"
```

### Phase 5: Create FABER Workflow (1 hour)

Define how agents/tools work together:

```yaml
# .fractary/workflows/feature-development.yaml

name: feature-development
description: Implement a new feature from issue to PR

phases:
  frame:
    steps:
      - agent: requirements-analyzer
        inputs:
          issue_id: "{issue_id}"

  architect:
    steps:
      - agent: solution-designer
        inputs:
          requirements: "{frame.requirements}"

  build:
    steps:
      - agent: code-generator
        inputs:
          spec: "{architect.spec}"

      - tool: run-tests
        inputs:
          target: "all"

  evaluate:
    steps:
      - agent: code-reviewer
        inputs:
          branch: "{build.branch}"

  release:
    steps:
      - tool: deploy
        inputs:
          environment: "staging"
```

## Validation Checklist

After implementation, verify:

### Discovery
- [ ] `fractary agent list` shows all agents
- [ ] `fractary tool list` shows all tools
- [ ] No validation errors: `fractary validate-all`

### Agent Functionality
- [ ] Each agent has clear system prompt
- [ ] Agents have appropriate tools
- [ ] Caching enabled for agents with large context
- [ ] Right model selected (Opus for complex, Sonnet for balanced)

### Tool Functionality
- [ ] Each tool has all required parameters
- [ ] Bash tools have sandbox configuration
- [ ] Python tools have correct module paths
- [ ] All tools tested: `fractary tool test <name> --dry-run`

### Workflow Integration
- [ ] Workflow references correct agents/tools
- [ ] Step inputs/outputs properly connected
- [ ] Test workflow: `fractary workflow test <name>`

### Documentation
- [ ] Standards documented in `.fractary/docs/`
- [ ] Templates available in `.fractary/templates/`
- [ ] README updated with agent/tool usage

## Project-Specific Examples

### Data Engineering (AWS Glue)

**Agents Needed**:
- `loader-engineer`: Generate Glue ETL code
- `data-validator`: Validate data quality
- `schema-analyzer`: Analyze source schemas

**Tools Needed**:
- `glue-execute`: Run Glue jobs
- `athena-query`: Query data
- `s3-sync`: Sync data files

**Cache**:
- ETL coding standards
- Glue job templates
- Schema patterns

### Infrastructure (Terraform)

**Agents Needed**:
- `infra-architect`: Design infrastructure
- `security-reviewer`: Review for security
- `cost-optimizer`: Optimize costs

**Tools Needed**:
- `terraform-deploy`: Deploy infrastructure
- `terraform-validate`: Validate configs
- `cost-estimate`: Estimate costs

**Cache**:
- IaC standards
- Terraform modules
- Security policies

### Web Application (React/Node)

**Agents Needed**:
- `feature-developer`: Implement features
- `code-reviewer`: Review code
- `api-designer`: Design APIs

**Tools Needed**:
- `run-tests`: Run test suite
- `deploy`: Deploy to environment
- `build`: Build application

**Cache**:
- Coding standards
- Component templates
- API patterns

## Migration from Claude Code

### Step 1: Audit Current Setup

```bash
# Count agents
ls .claude/agents/ | wc -l

# Count skills
ls .claude/skills/ | wc -l

# Count commands
ls .claude/commands/ | wc -l
```

### Step 2: Categorize

For each file, determine:
- **Agent**: Needs LLM reasoning → Convert to `.fractary/agents/`
- **Tool**: Deterministic logic → Convert to `.fractary/tools/`
- **Command**: Workflow step → Reference in `.fractary/workflows/`

### Step 3: Convert

```bash
# Convert agents
for file in .claude/agents/*.md; do
  name=$(basename "$file" .md | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
  fractary agent convert "$file" "$name"
  echo "✓ Converted $file → .fractary/agents/$name.yaml"
done

# Convert skills
for file in .claude/skills/*.md; do
  name=$(basename "$file" .md | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
  fractary tool convert "$file" "$name"
  echo "✓ Converted $file → .fractary/tools/$name.yaml"
done
```

### Step 4: Enhance

The conversions are basic - enhance them:

```bash
# Edit each agent to add:
# 1. Better system prompts
# 2. Appropriate model (Opus vs Sonnet)
# 3. Caching for large context
# 4. Custom tools

# Edit each tool to add:
# 1. Complete parameter definitions
# 2. Sandbox configuration for bash
# 3. Output schema
# 4. Error handling
```

### Step 5: Test

```bash
# Test each agent
for agent in .fractary/agents/*.yaml; do
  name=$(basename "$agent" .yaml)
  echo "Testing $name..."
  fractary agent test "$name" --dry-run
done

# Test each tool
for tool in .fractary/tools/*.yaml; do
  name=$(basename "$tool" .yaml)
  echo "Testing $name..."
  fractary tool test "$name" --dry-run
done
```

## Web Dashboard Setup

### 1. Connect Repository

1. Go to https://app.fractary.com
2. Click "Connect Repository"
3. Select your repository
4. Grant permissions

### 2. Sync Definitions

Your `.fractary/` definitions will automatically sync to the dashboard.

### 3. Edit in Dashboard

- Browse agents/tools visually
- Edit with schema validation
- Test interactively
- Changes create PRs back to repo

### 4. Approve Changes

When you edit in the dashboard:
1. Changes create a PR
2. Review the PR
3. Merge to update local definitions

## Troubleshooting

### Agents Not Discovered

**Problem**: `fractary agent list` shows nothing

**Solution**:
```bash
# Check directory exists
ls -la .fractary/agents/

# Check file extension
# Must be .yaml (not .yml)

# Check file syntax
fractary agent validate <name>
```

### Caching Not Working

**Problem**: No cache hits in usage stats

**Solution**:
```bash
# Verify enabled
grep -A5 "caching:" .fractary/agents/my-agent.yaml

# Check file paths exist
ls -la .fractary/docs/STANDARDS.md

# Check content size (should be >1000 tokens)
wc -w .fractary/docs/STANDARDS.md
```

### Tool Execution Fails

**Problem**: Tool fails with permission denied

**Solution**:
```yaml
# Add to tool definition
implementation:
  type: bash
  sandbox:
    allowlisted_commands:
      - your-command-here  # Add missing command
    network_access: true   # If needs internet
```

## Next Steps

1. **Start Simple**: One agent, one tool
2. **Test Thoroughly**: Use `--dry-run` mode
3. **Iterate**: Enhance prompts based on results
4. **Document**: Update standards as patterns emerge
5. **Share**: Use web dashboard for team collaboration

## Getting Help

- Documentation: https://docs.fractary.com
- Examples: https://github.com/fractary/examples
- Community: https://discord.gg/fractary
- Support: support@fractary.com
