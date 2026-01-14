---
name: fractary-faber-cloud:test
description: Run security scans and cost estimates on infrastructure - delegates to test-agent
allowed-tools: Task(fractary-faber-cloud:test-agent)
model: claude-haiku-4-5
argument-hint: '[--env <environment>] [--phase <pre-deployment|post-deployment>]'
tags: [faber-cloud, testing, security, validation]
examples:
  - trigger: "/fractary-faber-cloud:test"
    action: "Run pre-deployment tests on test environment"
  - trigger: "/fractary-faber-cloud:test --env prod --phase post-deployment"
    action: "Run post-deployment tests on prod environment"
---

# fractary-faber-cloud:test

Use **Task** tool with `test-agent` to run security scans, cost estimates, and compliance checks with provided arguments.

```
Task(
  subagent_type="fractary-faber-cloud:test-agent",
  description="Run infrastructure security scans, cost estimates, and compliance checks",
  prompt="Run infrastructure tests: $ARGUMENTS"
)
```
