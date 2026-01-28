---
id: KB-net-001
title: Research phase timeout due to large codebase
category: network
severity: medium
symptoms:
  - "Research taking too long"
  - "Timeout during codebase analysis"
  - "Context limit exceeded"
agents:
  - research
phases:
  - frame
context_type: agent
tags:
  - research
  - timeout
  - large-codebase
created: 2026-01-28
verified: true
success_count: 5
---

# Research Phase Timeout Due to Large Codebase

## Symptoms

The research phase fails or times out when analyzing large codebases. Common indicators:
- Research agent runs for extended periods without progress
- "Timeout" errors in workflow state
- "Context limit exceeded" warnings
- Incomplete research output

## Root Cause

Large codebases can overwhelm the research phase due to:
- Too many files to analyze in a single pass
- Deep directory structures causing recursive scanning issues
- Large files consuming context window
- Missing `.faberignore` or overly broad include patterns

## Solution

Optimize the research scope and configuration to handle large codebases efficiently.

### Actions

1. Create or update `.faberignore` to exclude non-essential directories:
   ```
   node_modules/
   dist/
   build/
   .git/
   *.min.js
   *.map
   ```

2. Focus research on specific directories using `--scope` parameter:
   ```bash
   /faber-software:research --scope src/
   ```

3. Increase timeout in workflow configuration if needed:
   ```json
   {
     "timeout": 600000
   }
   ```

4. Break large research into multiple focused passes by module

5. Re-run the research step with optimized configuration

## Prevention

- Always maintain an up-to-date `.faberignore` file
- Configure reasonable research scope before starting workflows
- For very large codebases, consider modular workflow runs
- Monitor research phase duration and adjust timeouts proactively
