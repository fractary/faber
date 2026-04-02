---
name: fractary-faber-github-installer
description: Install FABER GitHub Actions workflows in a project with interactive setup and checklist
user-invocable: true
argument-hint: "[--setup-script <cmd>] [--trigger-phrase <phrase>]"
allowed-tools:
  - Bash
  - Read
  - Write
  - Glob
  - Grep
  - AskUserQuestion
---

# FABER GitHub Installer

Sets up FABER GitHub Actions integration in a consumer project by generating `.github/workflows/faber.yml` and providing a GitHub setup checklist.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `--setup-script <cmd>` | Shell command to run before FABER (e.g., `npm install`) |
| `--trigger-phrase <phrase>` | Custom trigger phrase (default: `@faber`) |

## Algorithm

Read `docs/install-protocol.md` for the full step-by-step protocol including:
- Detection of existing configuration (faber.yml, config.yaml)
- Interactive setup script selection
- Overwrite confirmation for existing files
- Template-based faber.yml generation
- GitHub setup checklist with secrets, labels, and testing instructions

## Critical Rules

1. **Detect before writing** — always check what exists first
2. **Ask before overwriting** — confirm if faber.yml already exists
3. **No secrets in files** — only reference `${{ secrets.* }}`
4. **Use the template** — generate from canonical template, don't improvise
