---
name: fractary-faber-cloud:teardown
description: Teardown deployed infrastructure (terraform destroy) - delegates to teardown-agent
allowed-tools: Task(fractary-faber-cloud:teardown-agent)
model: claude-haiku-4-5
argument-hint: '--env <environment> [--auto-approve]'
tags: [faber-cloud, teardown, terraform, destroy]
examples:
  - trigger: "/fractary-faber-cloud:teardown --env test"
    action: "Teardown test environment infrastructure"
  - trigger: "/fractary-faber-cloud:teardown --env staging"
    action: "Teardown staging environment (requires confirmation)"
---

# fractary-faber-cloud:teardown

Use **Task** tool with `teardown-agent` to safely destroy infrastructure with provided arguments.

```
Task(
  subagent_type="fractary-faber-cloud:teardown-agent",
  description="Safely destroy infrastructure with backup and verification",
  prompt="Execute infrastructure teardown: $ARGUMENTS"
)
```
