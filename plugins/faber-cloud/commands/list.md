---
name: fractary-faber-cloud:list
description: List deployed infrastructure resources - delegates to list-agent
allowed-tools: Task(fractary-faber-cloud:list-agent)
model: claude-haiku-4-5
argument-hint: "--env <environment>"
tags: [faber-cloud, infrastructure, resources, listing]
examples:
  - trigger: "/fractary-faber-cloud:list --env test"
    action: "List test environment resources"
  - trigger: "/fractary-faber-cloud:list --env prod"
    action: "List production resources"
---

# fractary-faber-cloud:list

Use **Task** tool with `list-agent` to list deployed infrastructure resources with provided arguments.

```
Task(
  subagent_type="fractary-faber-cloud:list-agent",
  description="List deployed infrastructure resources",
  prompt="List infrastructure resources: $ARGUMENTS"
)
```
