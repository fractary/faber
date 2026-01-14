---
name: fractary-faber-cloud:deploy-plan
description: Generate and preview deployment plan (terraform plan) - delegates to deploy-plan-agent
allowed-tools: Task(fractary-faber-cloud:deploy-plan-agent)
model: claude-haiku-4-5
argument-hint: '[--env <environment>]'
tags: [faber-cloud, deployment, terraform, plan, preview]
examples:
  - trigger: "/fractary-faber-cloud:deploy-plan"
    action: "Preview deployment changes for current workspace"
  - trigger: "/fractary-faber-cloud:deploy-plan --env test"
    action: "Preview deployment changes for test environment"
  - trigger: "/fractary-faber-cloud:deploy-plan --env prod"
    action: "Preview deployment changes for production environment"
---

# fractary-faber-cloud:deploy-plan

Use **Task** tool with `deploy-plan-agent` to generate and preview deployment plan with provided arguments.

```
Task(
  subagent_type="fractary-faber-cloud:deploy-plan-agent",
  description="Generate and preview infrastructure deployment plan (terraform plan)",
  prompt="Generate deployment plan: $ARGUMENTS"
)
```
