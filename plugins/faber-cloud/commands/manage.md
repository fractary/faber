---
name: fractary-faber-cloud:manage
description: Unified infrastructure lifecycle management - routes operations to infra-manager agent
allowed-tools: Task(fractary-faber-cloud:manage-agent)
model: claude-haiku-4-5
argument-hint: <operation> [--env <environment>] [--complete]
tags: [faber-cloud, infrastructure, deployment, management]
examples:
  - trigger: "/fractary-faber-cloud:manage deploy-apply --env test"
    action: "Deploy infrastructure to test environment"
  - trigger: "/fractary-faber-cloud:manage design \"Add monitoring\""
    action: "Design infrastructure from requirements"
  - trigger: "/fractary-faber-cloud:manage debug --complete"
    action: "Analyze and fix deployment errors with complete resolution"
---

# fractary-faber-cloud:manage

Use **Task** tool with `manage-agent` to orchestrate infrastructure lifecycle operations and FABER workflows.

```
Task(
  subagent_type="fractary-faber-cloud:manage-agent",
  description="Execute infrastructure lifecycle management",
  prompt="Manage infrastructure: $ARGUMENTS"
)
```
