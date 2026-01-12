---
name: fractary-faber-cloud:init
description: Initialize faber-cloud plugin configuration - delegates to init-agent
allowed-tools: Task(fractary-faber-cloud:init-agent)
model: claude-haiku-4-5
argument-hint: '[--provider aws] [--iac terraform]'
tags: [faber-cloud, initialization, configuration, setup]
examples:
  - trigger: "/fractary-faber-cloud:init"
    action: "Initialize faber-cloud configuration"
  - trigger: "/fractary-faber-cloud:init --provider aws --iac terraform"
    action: "Initialize with specified provider and IaC tool"
---

# fractary-faber-cloud:init

Use **Task** tool with `init-agent` to initialize faber-cloud configuration with provided arguments.

```
Task(
  subagent_type="fractary-faber-cloud:init-agent",
  description="Initialize faber-cloud plugin configuration",
  prompt="Initialize faber-cloud configuration: $ARGUMENTS"
)
```
