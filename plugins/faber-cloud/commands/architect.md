---
name: fractary-faber-cloud:architect
description: Design cloud infrastructure architecture from requirements - delegates to architect-agent
allowed-tools: Task(fractary-faber-cloud:architect-agent)
model: claude-haiku-4-5
argument-hint: '"<description of infrastructure to build>"'
tags: [faber-cloud, architecture, design, infrastructure]
examples:
  - trigger: "/fractary-faber-cloud:architect \"S3 bucket for user uploads\""
    action: "Design S3 bucket architecture with best practices"
  - trigger: "/fractary-faber-cloud:architect \"VPC with public and private subnets\""
    action: "Design VPC network architecture"
  - trigger: "/fractary-faber-cloud:architect \"Lambda function with API Gateway\""
    action: "Design serverless API architecture"
---

# fractary-faber-cloud:architect

Use **Task** tool with `architect-agent` to design cloud infrastructure architecture from requirements.

```
Task(
  subagent_type="fractary-faber-cloud:architect-agent",
  description="Design cloud infrastructure architecture from requirements",
  prompt="Design infrastructure: $ARGUMENTS"
)
```
