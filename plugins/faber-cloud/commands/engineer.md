---
name: fractary-faber-cloud:engineer
description: Generate Infrastructure as Code from architecture design, specification, or direct instructions - delegates to engineer-agent
allowed-tools: Task(fractary-faber-cloud:engineer-agent)
model: claude-haiku-4-5
argument-hint: '[instructions]'
tags: [faber-cloud, engineer, terraform, iac, code-generation]
examples:
  - trigger: '/fractary-faber-cloud:engineer "user-uploads.md"'
    action: 'Generate IaC from design document'
  - trigger: '/fractary-faber-cloud:engineer ".faber/specs/123-add-uploads.md"'
    action: 'Generate IaC from FABER spec'
  - trigger: '/fractary-faber-cloud:engineer "Fix IAM permissions - Lambda needs s3:PutObject"'
    action: 'Generate IaC from direct instructions'
---

# fractary-faber-cloud:engineer

Use **Task** tool with `engineer-agent` to generate Infrastructure as Code with provided instructions.

```
Task(
  subagent_type="fractary-faber-cloud:engineer-agent",
  description="Generate Infrastructure as Code from architecture design, specification, or instructions",
  prompt="Generate Infrastructure as Code: $ARGUMENTS"
)
```
