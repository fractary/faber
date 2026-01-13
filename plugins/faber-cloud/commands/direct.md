---
name: fractary-faber-cloud:direct
description: Natural language entry point for fractary-faber-cloud - routes requests to appropriate commands
allowed-tools: Task(fractary-faber-cloud:direct-agent)
model: claude-haiku-4-5
argument-hint: '"<natural-language-request>"'
tags: [faber-cloud, natural-language, routing, director]
examples:
  - trigger: "/fractary-faber-cloud:direct \"Deploy my infrastructure to production\""
    action: "Route to deploy-apply command"
  - trigger: "/fractary-faber-cloud:direct \"Design an S3 bucket for uploads\""
    action: "Route to architect command"
  - trigger: "/fractary-faber-cloud:direct \"Validate my Terraform configuration\""
    action: "Route to validate command"
---

# fractary-faber-cloud:direct

Use **Task** tool with `direct-agent` to parse natural language requests and route to appropriate faber-cloud commands.

```
Task(
  subagent_type="fractary-faber-cloud:direct-agent",
  description="Parse natural language request and route to appropriate command",
  prompt="Process user request: $ARGUMENTS"
)
```
