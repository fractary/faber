---
name: fractary-faber-cloud:configure
description: Configure faber-cloud - initialization, updates, and infrastructure settings
allowed-tools: Task(fractary-faber-cloud:config-manager)
model: claude-haiku-4-5
argument-hint: '[--context "description of changes"] [--provider aws] [--iac terraform] [--force]'
tags: [faber-cloud, configuration, setup, infrastructure]
examples:
  - trigger: "/fractary-faber-cloud:configure"
    action: "Initialize or update faber-cloud configuration interactively"
  - trigger: "/fractary-faber-cloud:configure --provider aws --iac terraform"
    action: "Initialize with specified provider and IaC tool"
  - trigger: "/fractary-faber-cloud:configure --context \"add staging environment\""
    action: "Update configuration based on natural language description"
---

# fractary-faber-cloud:configure

Use **Task** tool with `config-manager` agent to configure faber-cloud with provided arguments.

```
Task(
  subagent_type="fractary-faber-cloud:config-manager",
  description="Configure faber-cloud plugin",
  prompt="Configure faber-cloud: $ARGUMENTS"
)
```
