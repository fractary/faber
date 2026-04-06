# FABER Workflow Framework

This project uses FABER skills for SDLC workflow management.

Skills in `plugins/faber/skills/` provide detailed guidance for each operation.

IMPORTANT: To plan and execute workflows, use SKILLS (not CLI commands).
Invoke skills by describing the intent — the platform will route to the correct skill.

Available workflow skills:
- `fractary-faber-workflow-plan` — plan workflows for a work item
- `fractary-faber-workflow-run` — execute a planned workflow for a work item
- `fractary-faber-workflow-batch-plan` — plan multiple workflows at once
- `fractary-faber-workflow-batch-run` — execute a batch of planned workflows

Utility CLI commands (inspection/config only — these are OK to run via shell):
- `fractary-faber config init|update|validate` — manage configuration
- `fractary-faber runs verify-complete <run-id>` — verify run completion
- `fractary-faber run-inspect <id>` — inspect workflow status

Configuration is at `.fractary/config.yaml`.
