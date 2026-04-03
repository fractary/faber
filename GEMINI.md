# FABER Workflow Framework

This project uses the `fractary-faber` CLI for SDLC workflow management.

Skills in `plugins/faber/skills/` provide detailed guidance for each operation.

Run `fractary-faber --help` for full CLI usage. Key commands:
- `fractary-faber workflow-plan --work-id <ids>` — plan workflows
- `fractary-faber workflow-run --work-id <ids>` — execute workflows
- `fractary-faber config init|update|validate` — manage configuration
- `fractary-faber runs verify-complete <run-id>` — verify run completion

Configuration is at `.fractary/config.yaml`.
