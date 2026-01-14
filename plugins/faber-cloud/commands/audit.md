---
name: fractary-faber-cloud:audit
description: Audit infrastructure status, health, and compliance without changes - delegates to audit-agent
allowed-tools: Task(fractary-faber-cloud:audit-agent)
model: claude-haiku-4-5
argument-hint: "--env <environment> [--check <type>]"
tags: [faber-cloud, audit, infrastructure, health, compliance]
examples:
  - trigger: "/fractary-faber-cloud:audit --env test"
    action: "Audit test environment (config validation)"
  - trigger: "/fractary-faber-cloud:audit --env prod --check drift"
    action: "Check for drift in production"
  - trigger: "/fractary-faber-cloud:audit --env prod --check full"
    action: "Comprehensive production audit"
---

# fractary-faber-cloud:audit

Use **Task** tool with `audit-agent` to audit infrastructure status, health, and compliance without modifications.

```
Task(
  subagent_type="fractary-faber-cloud:audit-agent",
  description="Audit infrastructure: $ARGUMENTS",
  prompt="Audit infrastructure with arguments: $ARGUMENTS"
)
```
