---
name: fractary-faber-cloud:adopt
description: Adopt existing infrastructure into faber-cloud management - delegates to adopt-agent
allowed-tools: Task(fractary-faber-cloud:adopt-agent)
model: claude-haiku-4-5
argument-hint: "[--project-root <path>] [--dry-run]"
tags: [faber-cloud, adoption, infrastructure, migration]
examples:
  - trigger: "/fractary-faber-cloud:adopt"
    action: "Adopt existing infrastructure in current directory"
  - trigger: "/fractary-faber-cloud:adopt --project-root ./services/api"
    action: "Adopt infrastructure for specific service"
  - trigger: "/fractary-faber-cloud:adopt --dry-run"
    action: "Preview adoption without making changes"
---

# fractary-faber-cloud:adopt

Use **Task** tool with `adopt-agent` to discover and adopt existing infrastructure into faber-cloud management.

```
Task(
  subagent_type="fractary-faber-cloud:adopt-agent",
  description="Adopt existing infrastructure into faber-cloud management",
  prompt="Adopt infrastructure: $ARGUMENTS"
)
```
