# Bulk Issue Creation for Work Plugin

**Status**: Draft
**Created**: 2026-01-08
**Repository**: fractary/work (or relevant work plugin location)

## Overview

Create a new `issue-create-bulk` command that uses an autonomous AI agent to intelligently create multiple related issues at once. The agent analyzes project structure, conversation context, and user prompts to determine what issues to create.

## Motivation

Projects often need to create multiple similar issues:
- **Cortheon ETL**: Issues for each dataset to import (ipeds/hd, ipeds/ic, etc.)
- **Corthodex**: Issues for each API endpoint to implement
- **Corthography**: Issues for each content template to create
- **Corthonomy**: Issues for each data catalog to configure

Currently, these must be created one at a time, which is tedious and error-prone. A bulk creation capability would:
- Save time when setting up new work
- Ensure consistency across related issues
- Allow flexible discovery of what needs issues
- Leverage AI to understand project-specific patterns

## Design Principles

1. **Simplicity First**: Command interface should be simple and intuitive
2. **AI-Powered Intelligence**: Agent handles discovery and planning, not configuration
3. **Safety Through Confirmation**: Agent must show plan and get approval before creating
4. **Project Context**: Agent relies on project understanding, not exhaustive config
5. **Centralized Logic**: Core functionality in one agent, allowing project customization

## Proposed Solution

### Simple Command Interface

```bash
/fractary-work:issue-create-bulk [--prompt <description>] [--type <type>] [--label <label>] [--template <name>]
```

**Key design**: Command is lightweight and delegates to an autonomous agent for all intelligence.

**Arguments:**
- `--prompt <text>`: Description of what to create (optional, uses conversation context if omitted)
- `--type <type>`: Issue type (feature|bug|chore|patch, default: agent determines)
- `--label <label>`: Additional labels to apply (repeatable)
- `--template <name>`: GitHub issue template to use from `.github/ISSUE_TEMPLATE/`
- `--assignee <user>`: Assign all issues to user

### Agent-Based Architecture

```
User → Command (parse args, capture context)
         ↓
     Task tool invokes agent
         ↓
     issue-bulk-creator agent:
       1. Analyze prompt + project
       2. Present plan for confirmation
       3. Create issues after approval
       4. Return summary
```

## Usage Examples

### Cortheon ETL (Datasets)

```bash
# Explicit prompt
/fractary-work:issue-create-bulk \
  --prompt "Create issues for all IPEDS datasets we need to import" \
  --type feature \
  --label dataset --label etl

# With template
/fractary-work:issue-create-bulk \
  --prompt "Create issues for IPEDS datasets: hd, ic, enrollment, completions" \
  --template dataset-load.md
```

### Corthodex (API Endpoints)

```bash
# Discovery-based
/fractary-work:issue-create-bulk \
  --prompt "Create issues for all v1 API endpoints that need implementation" \
  --label api

# Explicit list
/fractary-work:issue-create-bulk \
  --prompt "Create issues for users, posts, and comments API endpoints" \
  --type feature
```

### Corthography (Content Templates)

```bash
/fractary-work:issue-create-bulk \
  --prompt "Create issues for content templates in the templates/ directory" \
  --label documentation
```

### Using Conversation Context

```bash
# After discussing: "We need authentication, authorization, and logging"
/fractary-work:issue-create-bulk

# Agent uses conversation context to create 3 issues
```

## Implementation Details

### 1. Command Definition

**File**: `/commands/issue-create-bulk.md`

```markdown
---
name: fractary-work:issue-create-bulk
description: Create multiple issues at once using AI to determine what to create
model: claude-opus-4-5
argument-hint: [--prompt <description>] [--type <type>] [--label <label>] [--template <name>]
---

Create multiple issues for similar work items (datasets, endpoints, templates, etc.).

The agent analyzes your project structure and conversation context to intelligently determine what issues to create.

## How It Works

1. Command parses arguments and captures conversation context
2. Task tool invokes `issue-bulk-creator` agent
3. Agent analyzes project structure, conversation, and prompt
4. Agent presents plan showing all issues it will create
5. After user confirmation, agent creates issues
6. Agent returns summary with issue URLs

## Integration with Templates

If `--template` is specified:
- Agent loads template from `.github/ISSUE_TEMPLATE/{name}`
- Uses template structure for all created issues
- Fills in values based on what's being created

If no template:
- Agent generates appropriate titles and descriptions
- Uses project context for structure
```

### 2. Agent Definition

**File**: `/agents/issue-bulk-creator.md`

```markdown
---
name: fractary-work:issue-bulk-creator
description: Autonomous agent for creating multiple related issues
model: claude-opus-4-5
---

You are the issue-bulk-creator agent for the fractary-work plugin.

Your role is to analyze the user's request and project context to intelligently create multiple related issues.

## Your Process

### Step 1: Understand What to Create

Analyze:
- User's prompt (what they want issues for)
- Conversation context (recent discussion)
- Project structure (filesystem, code, docs)
- Existing issues (avoid duplicates)

Determine:
- What items/targets need issues
- What type of work (feature, bug, chore)
- Appropriate titles and descriptions
- Relevant labels and workflow
- Whether to use an issue template

### Step 2: Present Plan for Confirmation

**CRITICAL**: You MUST show the user what you plan to create before creating anything.

Present a clear list:
```
I will create <N> issues:

[1] <Title>
    Type: <feature|bug|chore>
    Labels: <label1>, <label2>, ...

[2] <Title>
    Type: <feature|bug|chore>
    Labels: <label1>, <label2>, ...

Workflow: <workflow-name> (if same for all)
OR
[1] ... Workflow: <workflow-1>
[2] ... Workflow: <workflow-2>

Template: <template-name> (if using one)

Proceed with creation? [Y/n]
```

Wait for user confirmation before proceeding.

### Step 3: Create Issues

For each issue in the plan:
1. Use issue-creator skill to create the issue
2. Apply appropriate labels
3. Add workflow label if specified
4. Use template if specified
5. Track results (success/failure)

### Step 4: Return Summary

```
Created <N> issue(s) successfully:

- #123: <Title> - <URL>
- #124: <Title> - <URL>
- #125: <Title> - <URL>

All issues labeled with: <labels>
Workflow: <workflow-name>
```

## Project Context Intelligence

Different projects have different patterns:
- **Cortheon ETL**: Datasets in directories, ETL patterns
- **Corthodex**: API endpoint definitions, REST patterns
- **Corthography**: Template files, content patterns
- **General**: Analyze structure to understand project type

## Smart Defaults

- Prompt mentions "datasets" → look for data directories
- Prompt mentions "endpoints" → look for API code
- Prompt mentions "templates" → look for template files
- Use filesystem structure for discovery

## Issue Quality

- Generate meaningful titles (not generic "Work on X")
- Create useful descriptions with context
- Apply appropriate labels based on work type
- Select correct workflow based on issue type

## Template Usage

- If `--template` specified, use it
- If no template but one exists for work type, suggest it
- Templates in `.github/ISSUE_TEMPLATE/` directory

## Error Handling

- If unclear what to create, ask clarifying questions
- If no items found, explain and suggest alternatives
- Track creation failures and report them

## Tools Available

- **Bash**: Explore filesystem, search for patterns
- **Read**: Read project files, templates, existing issues
- **Glob/Grep**: Search for files and code patterns
- **Task**: Invoke issue-creator skill for each issue (via work-manager)

## Example Scenarios

### Scenario 1: Datasets
```
User: "Create issues for all IPEDS datasets"

Your process:
1. Search for datasets (check datasets/, data/, etc.)
2. Find: ipeds/hd, ipeds/ic, ipeds/enrollment
3. Present plan:
   - Issue for each dataset
   - Type: feature
   - Labels: dataset, etl, ipeds
   - Workflow: etl (if project has etl workflow)
4. Get confirmation
5. Create issues
6. Return summary
```

### Scenario 2: API Endpoints
```
User: "Create issues for v1 endpoints that need implementing"

Your process:
1. Search codebase for API definitions
2. Find: src/api/v1/users.ts, src/api/v1/posts.ts
3. Determine which are incomplete (TODOs, stubs)
4. Present plan with specific endpoints
5. Get confirmation
6. Create issues
7. Return summary
```

### Scenario 3: Conversation Context
```
User previously discussed: "We need authentication, authorization, and audit logging"
User: "/fractary-work:issue-create-bulk"

Your process:
1. Review conversation - identify: auth, authz, audit
2. Present plan:
   [1] Implement user authentication
   [2] Implement role-based authorization
   [3] Add audit logging system
3. Get confirmation
4. Create issues
5. Return summary
```
```

### 3. Command Implementation

The command script should:

1. Parse command arguments (prompt, type, labels, template, assignee)
2. Capture conversation context (recent messages)
3. Build request for agent with all parameters
4. Invoke agent using Task tool with `subagent_type="general-purpose"`
5. Return agent response to user

**Key point**: Command does NOT implement creation logic - agent does all the work.

## Integration Points

### work-manager Agent

Does NOT need modification - the new agent is invoked directly via Task tool, not routed through work-manager.

### Project Customization

Projects can create wrapper commands that:
1. Add project-specific prompt context
2. Set default labels/templates for the project
3. Delegate to `issue-bulk-creator` agent

Example project-specific command:
```bash
# In Cortheon ETL project
/cortheon:create-dataset-issues --datasets "hd,ic,enrollment"

# This command:
# 1. Builds prompt: "Create issues for IPEDS datasets: hd, ic, enrollment"
# 2. Adds labels: --label dataset --label etl
# 3. Sets template: --template dataset-load.md
# 4. Invokes: /fractary-work:issue-create-bulk with these params
```

This centralizes core logic while allowing project-specific shortcuts.

## Verification Plan

### 1. Test with Explicit Prompt

```bash
/fractary-work:issue-create-bulk \
  --prompt "Create test issues for: test1, test2, test3" \
  --type feature
```

**Verify:**
- Agent presents plan with 3 issues
- Shows clear confirmation request
- Creates issues after approval
- Returns summary with URLs

### 2. Test with Conversation Context

```bash
# In conversation, discuss: "We need authentication, authorization, and logging"
# Then run:
/fractary-work:issue-create-bulk
```

**Verify:**
- Agent uses conversation context
- Presents plan with 3 relevant issues
- Issues have meaningful titles and descriptions

### 3. Test with Template

```bash
# Create simple template
cat > .github/ISSUE_TEMPLATE/test.md << 'EOF'
---
name: Test Template
labels: test
---
# Test Issue
## Requirements
- [ ] Implement feature
EOF

/fractary-work:issue-create-bulk \
  --prompt "Create issues for: feature1, feature2" \
  --template test.md
```

**Verify:**
- Issues use template structure
- Template labels are applied
- Placeholders filled correctly

### 4. Test Project Intelligence

```bash
# In a project with datasets/ directory containing ipeds/hd, ipeds/ic
/fractary-work:issue-create-bulk \
  --prompt "Create issues for all datasets in the ipeds folder"
```

**Verify:**
- Agent explores filesystem
- Identifies dataset files
- Creates appropriate issues with relevant names

### 5. Test Error Handling

```bash
/fractary-work:issue-create-bulk \
  --prompt "Create issues for nonexistent items"
```

**Verify:**
- Agent explains it found nothing
- Suggests alternatives
- Does not create issues

### 6. Test Workflow Selection

```bash
/fractary-work:issue-create-bulk \
  --prompt "Create issues for IPEDS datasets" \
  --label "workflow:etl"
```

**Verify:**
- Issues include workflow label
- Workflow shown in confirmation (once if all same)

## Files to Create

1. **`/commands/issue-create-bulk.md`** - Command definition
2. **`/agents/issue-bulk-creator.md`** - Agent definition
3. **`/docs/guides/bulk-issue-creation.md`** - User guide (see below)

## Files to Modify

**None** - Agent is invoked directly via Task tool, not through work-manager routing.

## User Documentation

Create `/docs/guides/bulk-issue-creation.md`:

```markdown
# Bulk Issue Creation Guide

## Overview

Create multiple issues at once using AI-powered analysis of your project and requirements.

## Quick Start

```bash
# Simple prompt
/fractary-work:issue-create-bulk --prompt "Create issues for all IPEDS datasets"

# Use conversation context
# (after discussing what needs to be done)
/fractary-work:issue-create-bulk

# With configuration
/fractary-work:issue-create-bulk \
  --prompt "Create issues for API endpoints: users, posts, comments" \
  --type feature \
  --label api \
  --template api-endpoint.md
```

## How It Works

The `issue-bulk-creator` agent:
1. Analyzes your prompt and conversation context
2. Explores project structure to understand what you're working on
3. Presents a plan showing what it will create
4. Waits for your confirmation
5. Creates the issues after you approve

## Project-Specific Examples

### Cortheon ETL (Datasets)
```bash
/fractary-work:issue-create-bulk \
  --prompt "Create issues for IPEDS datasets: hd, ic, enrollment, completions" \
  --type feature \
  --label dataset --label etl \
  --template dataset-load.md
```

### Corthodex (API Endpoints)
```bash
/fractary-work:issue-create-bulk \
  --prompt "Create issues for all v1 API endpoints that need implementation" \
  --label api
```

### Corthography (Content Templates)
```bash
/fractary-work:issue-create-bulk \
  --prompt "Create issues for content templates in the templates/ directory" \
  --label documentation
```

## GitHub Issue Templates

Optionally use templates in `.github/ISSUE_TEMPLATE/` for consistency:

```bash
/fractary-work:issue-create-bulk \
  --prompt "Create issues for all IPEDS datasets" \
  --template dataset-load.md
```

The agent will use the template structure for all created issues.

## Best Practices

1. **Be specific in prompts**: "Create issues for IPEDS datasets: hd, ic, enrollment"
2. **Use conversation context**: Discuss what needs to be done first, then run command
3. **Review confirmation**: Agent shows exactly what it will create before proceeding
4. **Use templates**: For consistent issue structure across related work items
5. **Add workflow labels**: Specify `--label workflow:etl` for correct workflow selection

## Confirmation Step

Before creating any issues, the agent will show you:

```
I will create 3 issues:

[1] Load IPEDS hd dataset
    Type: feature
    Labels: dataset, etl, ipeds

[2] Load IPEDS ic dataset
    Type: feature
    Labels: dataset, etl, ipeds

[3] Load IPEDS enrollment dataset
    Type: feature
    Labels: dataset, etl, ipeds

Workflow: etl
Template: dataset-load.md

Proceed with creation? [Y/n]
```

You can review and approve before anything is created.

## Troubleshooting

### Agent can't find items
- Be more specific in your prompt
- Provide explicit list: "Create issues for: item1, item2, item3"
- Check that files/directories exist in your project

### Wrong workflow selected
- Add explicit workflow label: `--label workflow:etl`
- Agent will detect and use it

### Need different structure
- Use `--template` to specify an issue template
- Or let agent generate and edit issues afterward
```

## Success Criteria

- [ ] Command delegates to autonomous agent
- [ ] Agent analyzes project structure and conversation context
- [ ] Agent presents clear confirmation before creating issues
- [ ] Agent creates issues with appropriate titles, labels, and workflows
- [ ] Agent returns summary with issue URLs
- [ ] Works without configuration (relies on project context)
- [ ] Supports GitHub issue templates
- [ ] Error handling for unclear requests
- [ ] User documentation created
- [ ] All test scenarios pass

## Future Enhancements

Potential future additions (not in this spec):
- Support for other work trackers (Jira, Linear) beyond GitHub
- Batch operations (update labels on multiple issues)
- Templates with more advanced placeholder systems
- Integration with project-specific metadata systems
- Dry-run mode to preview without creating

## Notes

### Why Agent-Based vs. Configuration-Based?

**Agent-based approach chosen because:**
- Projects vary widely in what they work on
- Configuration would require exhaustive lists that need maintenance
- AI can understand project structure from context
- Flexible to different project types without config changes
- Simpler for users - just describe what you want

**Configuration approach not chosen because:**
- Would require defining every target in config
- Brittle - breaks when project structure changes
- Different config schema for each project type
- Less flexible for ad-hoc bulk creation

The agent-based approach leverages AI intelligence to be both simpler and more powerful.
