---
name: fractary-faber-cloud:debug
description: Debug deployment errors and permission issues - delegates to debug-agent
allowed-tools: Task(fractary-faber-cloud:debug-agent)
model: claude-haiku-4-5
argument-hint: '"<description of issue to debug>"'
tags: [faber-cloud, debug, troubleshooting, errors]
examples:
  - trigger: "/fractary-faber-cloud:debug"
    action: "Enter interactive debug mode"
  - trigger: '/fractary-faber-cloud:debug "AccessDenied error during deployment"'
    action: "Debug specific permission error"
  - trigger: '/fractary-faber-cloud:debug "terraform apply failed"'
    action: "Debug deployment failure"
---

# fractary-faber-cloud:debug

Use **Task** tool with `debug-agent` to analyze deployment errors, categorize issues, and provide remediation steps.

```
Task(
  subagent_type="fractary-faber-cloud:debug-agent",
  description="Debug deployment errors and permission issues",
  prompt="Debug issue: $ARGUMENTS"
)
```
