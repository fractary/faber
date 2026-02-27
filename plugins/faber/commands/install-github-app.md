---
name: fractary-faber:install-github-app
description: Install FABER GitHub Actions workflows in this project - generates faber.yml and guides GitHub Secrets setup
argument-hint: '[--setup-script <cmd>] [--trigger-phrase <phrase>]'
allowed-tools: Task(fractary-faber:faber-github-installer)
model: claude-haiku-4-5
---

Use **Task** tool with `fractary-faber:faber-github-installer` agent to install FABER GitHub Actions workflows.

```
Task(
  subagent_type="fractary-faber:faber-github-installer",
  description="Install FABER GitHub workflows",
  prompt="Install FABER GitHub workflows: $ARGUMENTS"
)
```
