---
name: fractary-faber-cloud:validate
description: Validate Terraform configuration syntax and structure - delegates to validate-agent
allowed-tools: Task(fractary-faber-cloud:validate-agent)
model: claude-haiku-4-5
argument-hint: "[--env <environment>]"
tags: [faber-cloud, validation, terraform, syntax-check]
examples:
  - trigger: "/fractary-faber-cloud:validate"
    action: "Validate Terraform configuration in test environment"
  - trigger: "/fractary-faber-cloud:validate --env prod"
    action: "Validate Terraform configuration in prod environment"
---

# fractary-faber-cloud:validate

Use **Task** tool with `validate-agent` to validate Terraform configuration with provided arguments.

```
Task(
  subagent_type="fractary-faber-cloud:validate-agent",
  description="Validate Terraform configuration syntax and structure",
  prompt="Validate infrastructure configuration: $ARGUMENTS"
)
```
