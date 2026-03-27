---
name: fractary-faber-install-github-app
description: Install FABER GitHub Actions workflows in this project - generates faber.yml and guides GitHub Secrets setup
argument-hint: '[--setup-script <cmd>] [--trigger-phrase <phrase>]'
allowed-tools: Agent(fractary-faber-github-installer)
model: claude-haiku-4-5
---

Use **Agent** tool with `fractary-faber-github-installer` agent to install FABER GitHub Actions workflows.

```
Agent(
  subagent_type="fractary-faber-github-installer",
  description="Install FABER GitHub workflows",
  prompt="Install FABER GitHub workflows: $ARGUMENTS"
)
```
