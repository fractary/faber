# Step Hierarchy Guidelines for Entity Tracking

## Overview

When entity-level state tracking is enabled, FABER tracks per-step status across all workflows that operate on the same entity. For this to work effectively, **step naming must be consistent across workflows**.

This document provides guidelines for naming steps using the three-level hierarchy:
- **step_id** (required): Unique identifier within a workflow
- **step_action** (optional): Groups similar steps across workflows
- **step_type** (optional): Broad category for reporting and analytics

## Why Step Hierarchy Matters

### The Problem

Consider two workflows operating on the same blog post entity:
- **Workflow A** (draft creation): Has a step `draft-commit` that commits content
- **Workflow B** (seo enhancement): Has a step `seo-commit` that commits SEO changes

Without consistent naming, the entity state shows two separate steps:
```json
{
  "step_status": {
    "draft-commit": {"execution_status": "completed"},
    "seo-commit": {"execution_status": "completed"}
  }
}
```

This makes it impossible to query "which entities need a github-commit?" because the step names vary.

### The Solution

Use consistent **step_action** and **step_type** across workflows:

**Workflow A:**
```json
{
  "id": "draft-commit",
  "step_action": "github-commit",
  "step_type": "repo-actions",
  "skill": "fractary-repo:commit"
}
```

**Workflow B:**
```json
{
  "id": "seo-commit",
  "step_action": "github-commit",
  "step_type": "repo-actions",
  "skill": "fractary-repo:commit"
}
```

Now the entity state groups them by action:
```json
{
  "step_status": {
    "draft-commit": {
      "step_id": "draft-commit",
      "step_action": "github-commit",
      "step_type": "repo-actions",
      "execution_status": "completed"
    },
    "seo-commit": {
      "step_id": "seo-commit",
      "step_action": "github-commit",
      "step_type": "repo-actions",
      "execution_status": "completed"
    }
  }
}
```

And you can query by step_action:
```bash
# Get all entities where github-commit is pending
scripts/entity-query-step.sh --step-action github-commit --execution-status pending
```

## Three-Level Hierarchy

### Level 1: step_id (Required)

**Purpose**: Unique identifier within a workflow
**Pattern**: `{phase-context}-{action-verb}`
**Examples**: `build-github-commit`, `architect-generate-spec`, `release-create-pr`

**Rules**:
- MUST be unique within the workflow
- Use lowercase with hyphens
- Include phase context for clarity
- Keep it specific to the workflow's purpose

### Level 2: step_action (Optional, Recommended)

**Purpose**: Groups similar actions across workflows
**Pattern**: `{verb}-{object}` or `{action-name}`
**Examples**: `github-commit`, `generate-spec`, `run-tests`, `create-pr`

**Rules**:
- Use the SAME name across all workflows that perform the same action
- Focus on WHAT the step does, not WHICH workflow it's in
- Keep it generic enough for reuse
- Use lowercase with hyphens

**Common step_actions:**
| Action | Purpose | Used In |
|--------|---------|---------|
| `fetch-requirements` | Fetch work item details | frame phase |
| `generate-spec` | Generate specification | architect phase |
| `github-commit` | Commit code to GitHub | build phase, evaluate phase |
| `run-tests` | Execute test suite | build phase, evaluate phase |
| `run-lint` | Run code quality checks | build phase, evaluate phase |
| `create-pr` | Create pull request | release phase |
| `merge-pr` | Merge pull request | release phase |
| `deploy-staging` | Deploy to staging | release phase |
| `deploy-production` | Deploy to production | release phase |
| `publish` | Publish content/artifact | release phase |

### Level 3: step_type (Optional)

**Purpose**: Broad category for grouping and analytics
**Pattern**: `{category-name}`
**Examples**: `repo-actions`, `testing`, `deployment`, `content-ops`

**Rules**:
- Use very broad categories (5-10 total across entire system)
- Focus on operational grouping
- Keep it stable (don't change frequently)

**Recommended step_types:**
| Type | Purpose | Examples |
|------|---------|----------|
| `repo-actions` | Git/repository operations | commit, branch, merge, rebase |
| `testing` | Test execution | unit tests, integration tests, e2e tests |
| `linting` | Code quality checks | eslint, prettier, type-check |
| `deployment` | Deployment operations | deploy to staging/prod, rollback |
| `content-ops` | Content operations | generate, optimize, validate content |
| `data-ops` | Data operations | fetch, transform, validate data |
| `review` | Review/approval operations | code review, approval gate |
| `notification` | Notification/comment operations | post comment, send alert |

## Step Naming Examples

### Example 1: GitHub Commit Step

**Scenario**: Multiple workflows need to commit code to GitHub

**Workflow A (draft creation):**
```json
{
  "id": "build-github-commit",
  "step_action": "github-commit",
  "step_type": "repo-actions",
  "description": "Commit draft content to GitHub",
  "skill": "fractary-repo:commit"
}
```

**Workflow B (bug fix):**
```json
{
  "id": "evaluate-github-commit",
  "step_action": "github-commit",
  "step_type": "repo-actions",
  "description": "Commit bug fix to GitHub",
  "skill": "fractary-repo:commit"
}
```

**Result**: Both workflows use `step_action: "github-commit"`, enabling queries like:
```bash
# Find entities where github-commit failed
entity-query-step.sh --step-action github-commit --execution-status failed
```

### Example 2: Testing Steps

**Scenario**: Test execution across different phases

**Build phase:**
```json
{
  "id": "build-run-tests",
  "step_action": "run-tests",
  "step_type": "testing",
  "description": "Run unit and integration tests",
  "skill": "fractary-test:run-all"
}
```

**Evaluate phase:**
```json
{
  "id": "evaluate-run-tests",
  "step_action": "run-tests",
  "step_type": "testing",
  "description": "Re-run tests after fixes",
  "skill": "fractary-test:run-all"
}
```

**Result**: Entity state shows both executions under `step_action: "run-tests"`.

### Example 3: Content Operations

**Scenario**: SEO-specific steps for blog posts

**Draft workflow:**
```json
{
  "id": "build-generate-content",
  "step_action": "generate-content",
  "step_type": "content-ops",
  "description": "Generate initial blog post content"
}
```

**SEO workflow:**
```json
{
  "id": "build-seo-optimization",
  "step_action": "seo-optimization",
  "step_type": "content-ops",
  "description": "Optimize content for search engines"
}
```

**Note**: Here `step_action` differs because the actions are fundamentally different. Use the same `step_action` only when workflows perform the same operation.

## Best Practices

### DO:
✅ Use consistent `step_action` across workflows for the same operation
✅ Document your step_action registry for your project
✅ Use verb-noun format for step_action (`run-tests`, `create-pr`)
✅ Keep step_type broad and stable
✅ Include phase context in step_id for clarity

### DON'T:
❌ Use workflow-specific prefixes in step_action (`draft-commit` → use `github-commit`)
❌ Create too many step_types (keep it to 5-10 total)
❌ Change step_action names after deployment (breaks historical tracking)
❌ Forget to set step_action when entity tracking is enabled
❌ Use the same step_id across different workflows (must be unique)

## Entity-Specific Step Registries

For entity types that span multiple workflows, maintain a step registry:

### Example: Blog Post Entity Registry

**Entity Type**: `blog-post`

**Standard step_actions:**
| Action | Type | Purpose | Used By |
|--------|------|---------|---------|
| `fetch-requirements` | `content-ops` | Fetch blog post requirements | draft-workflow |
| `generate-spec` | `content-ops` | Generate blog post spec | draft-workflow |
| `generate-content` | `content-ops` | Generate initial content | draft-workflow |
| `seo-optimization` | `content-ops` | Optimize for SEO | seo-workflow, draft-workflow |
| `grammar-check` | `content-ops` | Check grammar and style | review-workflow |
| `github-commit` | `repo-actions` | Commit to repository | All workflows |
| `create-pr` | `repo-actions` | Create pull request | All workflows |
| `publish` | `content-ops` | Publish to blog platform | publish-workflow |

**Usage**: All workflows operating on `blog-post` entities should use these standard step_actions.

## Validation

When creating a new workflow with entity tracking:

1. **Check existing step_actions** for your entity type
2. **Reuse** existing step_actions where applicable
3. **Document** any new step_actions you create
4. **Validate** consistency with teammates
5. **Update** the entity-specific step registry

## Migration Guide

If you have existing workflows without step_action/step_type:

### Step 1: Audit Current Steps

List all step_ids across workflows:
```bash
grep -r '"id":' .fractary/faber/workflows/*.json | cut -d'"' -f4 | sort | uniq
```

### Step 2: Group Similar Steps

Identify which steps perform the same action:
```
build-commit-code    } → step_action: "github-commit"
evaluate-commit-fix  }

build-test           } → step_action: "run-tests"
evaluate-test        }
```

### Step 3: Add Fields to Workflow Config

Update workflow JSON files:
```json
{
  "id": "build-commit-code",
  "step_action": "github-commit",
  "step_type": "repo-actions",
  "skill": "fractary-repo:commit"
}
```

### Step 4: Verify

Check resolved workflow includes step hierarchy:
```bash
plugins/faber/skills/faber-config/scripts/resolve-workflow.sh \
  --workflow-id my-workflow | jq '.phases.build.steps[] | {id, step_action, step_type}'
```

## Query Examples

With consistent step naming, you can query entities:

```bash
# Find entities where testing failed
entity-query-step.sh --step-action run-tests --execution-status failed

# Find entities pending SEO optimization
entity-query-step.sh --step-action seo-optimization --execution-status pending

# List all entities with recent github-commit activity
entity-list.sh --type blog-post --step-action github-commit --limit 20

# Get entities by step_type
# (Requires custom query - iterate entities and filter by step_type)
```

## Conclusion

Consistent step naming is **critical** for effective entity-level tracking. By following these guidelines:

- ✅ Multiple workflows can track unified progress on the same entity
- ✅ Dashboards can show step-level bottlenecks across workflows
- ✅ Queries can find "which entities need step X" regardless of workflow
- ✅ Historical tracking remains stable and queryable
- ✅ New workflows integrate seamlessly with existing entity states

**Remember**: `step_action` is the key to cross-workflow consistency. When in doubt, reuse existing step_actions from your entity-specific registry.
