---
name: fractary-faber-cloud:config
description: Configure faber-cloud - initialization, updates, and infrastructure settings
allowed-tools: Task(fractary-faber-cloud:config-agent)
model: claude-haiku-4-5
argument-hint: '[--context "description of changes"] [--provider aws] [--iac terraform] [--force]'
tags: [faber-cloud, configuration, setup, infrastructure]
examples:
  - trigger: "/fractary-faber-cloud:config"
    action: "Initialize or update faber-cloud configuration interactively"
  - trigger: "/fractary-faber-cloud:config --provider aws --iac terraform"
    action: "Initialize with specified provider and IaC tool"
  - trigger: "/fractary-faber-cloud:config --context \"add staging environment\""
    action: "Update configuration based on natural language description"
---

# fractary-faber-cloud:config

Use **Task** tool with `config-agent` to configure faber-cloud with provided arguments.

```
Task(
  subagent_type="fractary-faber-cloud:config-agent",
  description="Configure faber-cloud plugin",
  prompt="Configure faber-cloud: $ARGUMENTS"
)
```
