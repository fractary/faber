---
name: fractary-faber-cloud:deploy-apply
description: Apply infrastructure deployment (terraform apply) - delegates to deploy-apply-agent
allowed-tools: Task(fractary-faber-cloud:deploy-apply-agent)
model: claude-haiku-4-5
argument-hint: '--env <environment> [--auto-approve]'
tags: [faber-cloud, deployment, terraform, apply]
examples:
  - trigger: "/fractary-faber-cloud:deploy-apply --env test"
    action: "Deploy to test environment"
  - trigger: "/fractary-faber-cloud:deploy-apply --env prod"
    action: "Deploy to production environment (requires confirmation)"
---

# fractary-faber-cloud:deploy-apply

Use **Task** tool with `deploy-apply-agent` to execute infrastructure deployment with provided arguments.

```
Task(
  subagent_type="fractary-faber-cloud:deploy-apply-agent",
  description="Apply infrastructure deployment to AWS",
  prompt="Execute infrastructure deployment: $ARGUMENTS"
)
```
