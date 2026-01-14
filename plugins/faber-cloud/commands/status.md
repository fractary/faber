---
name: fractary-faber-cloud:status
description: Check deployment status and configuration - delegates to status-agent
allowed-tools: Task(fractary-faber-cloud:status-agent)
model: claude-haiku-4-5
argument-hint: "[--env <environment>]"
tags: [faber-cloud, status, monitoring, configuration]
examples:
  - trigger: "/fractary-faber-cloud:status"
    action: "Check status for all environments"
  - trigger: "/fractary-faber-cloud:status --env prod"
    action: "Check status for production environment"
---

# fractary-faber-cloud:status

Use **Task** tool with `status-agent` to check deployment status and configuration with provided arguments.

```
Task(
  subagent_type="fractary-faber-cloud:status-agent",
  description="Check deployment status and configuration",
  prompt="Check status: $ARGUMENTS"
)
```
