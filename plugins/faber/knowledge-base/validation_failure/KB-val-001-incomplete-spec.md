---
id: KB-val-001
title: Incomplete specification missing required sections
category: validation_failure
severity: high
symptoms:
  - "Specification validation failed"
  - "Missing required section"
  - "Incomplete architecture document"
agents:
  - architect
  - validate-architecture
phases:
  - architect
context_type: agent
tags:
  - specification
  - validation
  - architecture
created: 2026-01-28
verified: true
success_count: 8
---

# Incomplete Specification Missing Required Sections

## Symptoms

The architect phase fails validation because the generated specification is incomplete:
- Validation error: "Missing required section: [section-name]"
- Specification file exists but validation fails
- Build phase cannot proceed due to incomplete spec

## Root Cause

Specification incompleteness typically results from:
- Insufficient research output from frame phase
- Ambiguous or incomplete work item requirements
- Agent context limit reached before completing all sections
- Template mismatch between architect and validator expectations

## Solution

Complete the specification with all required sections.

### Actions

1. Check which sections are missing from the validation output

2. Review the specification template requirements:
   ```bash
   cat .fractary/faber/templates/specification.md
   ```

3. Manually add missing sections or re-run architect with more context:
   ```bash
   /faber-software:architect --verbose
   ```

4. Ensure the research output contains sufficient information for all required sections

5. Re-run validation:
   ```bash
   /faber-software:validate-architecture
   ```

## Prevention

- Ensure work items have clear, detailed requirements
- Verify research phase output is comprehensive before proceeding
- Use specification templates that match validator expectations
- Consider breaking complex features into smaller, focused work items
