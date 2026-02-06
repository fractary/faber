# FABER → Forge Migration Guide

**Last Updated:** 2025-12-15
**Status:** Active Migration (v1.x → v2.0)

---

## Overview

Starting with FABER v1.x, **agent and tool definitions are being migrated from Python to TypeScript** and managed by the [`@fractary/forge`](https://github.com/fractary/forge) SDK.

This guide will help you migrate your FABER workflows to use Forge-managed agents.

---

## Why the Migration?

| Before (Python) | After (Forge) |
|----------------|---------------|
| Python-only definitions | Cross-platform TypeScript |
| FABER-specific | Universal across Fractary ecosystem |
| Limited versioning | Semantic versioning + registries |
| No marketplace | Stockyard marketplace (future) |
| Monolithic | Modular, composable agents |

---

## Migration Timeline

| Version | Status | Changes |
|---------|--------|---------|
| **v1.x** (Current) | Dual-mode support | Both Python and Forge work |
| **v2.0** (Future) | Forge required | Python definitions removed |

You have time to migrate gradually during the v1.x lifecycle.

---

## Quick Start: Enable Forge Mode

### Step 1: Update Configuration

Add Forge settings to your `.fractary/config.yaml` under the `faber:` section:

```json
{
  "workflow": {
    "autonomy": "assisted"
  },
  "forge": {
    "enabled": true,
    "prefer_local": true
  },
  "phases": {
    "frame": { "enabled": true },
    "architect": { "enabled": true, "refineSpec": true },
    "build": { "enabled": true },
    "evaluate": { "enabled": true, "maxRetries": 3 },
    "release": { "enabled": true, "requestReviews": true, "reviewers": [] }
  }
}
```

**Key change:** Set `"forge.enabled": true`

### Step 2: Install FABER Agents (Future)

Once agent YAML definitions are available in Forge:

```bash
# Install all FABER phase agents
forge install frame-agent
forge install architect-agent
forge install build-agent
forge install evaluate-agent
forge install release-agent

# Or install all at once
forge install frame-agent architect-agent build-agent evaluate-agent release-agent
```

### Step 3: Verify Setup

```typescript
import { FaberWorkflow } from '@fractary/faber';

const workflow = new FaberWorkflow({
  config: {
    forge: {
      enabled: true,
      prefer_local: true,
    },
  },
});

// Run workflow - will use Forge agents
const result = await workflow.run({
  workId: '123',
  autonomy: 'assisted',
});
```

---

## Detailed Migration Steps

### For TypeScript Users

#### Before (Legacy Mode)

```typescript
import { FaberWorkflow } from '@fractary/faber';

// Uses Python definitions by default
const workflow = new FaberWorkflow();
const result = await workflow.run({ workId: '123' });
```

#### After (Forge Mode)

```typescript
import { FaberWorkflow } from '@fractary/faber';

// Enable Forge mode
const workflow = new FaberWorkflow({
  config: {
    forge: {
      enabled: true,
      prefer_local: true,
    },
  },
});

const result = await workflow.run({ workId: '123' });
```

### For Python Users

⚠️ **Important:** FABER's Python SDK will be deprecated. Migrate to TypeScript for continued support.

**Migration path:**
1. Use FABER v1.x with Python definitions (legacy mode)
2. Plan migration to TypeScript SDK
3. Contact maintainers if you need Python support beyond v2.0

---

## Custom Phase Agents

You can override the default agents for any phase:

```json
{
  "forge": {
    "enabled": true
  },
  "phases": {
    "frame": {
      "enabled": true,
      "agent": "my-custom-frame-agent@1.0.0"
    },
    "build": {
      "enabled": true,
      "agent": "specialized-builder"
    }
  }
}
```

This allows you to:
- Use custom agents for specific phases
- Pin specific versions
- Mix default and custom agents

---

## Creating Custom Agents

### Agent Definition Format (YAML)

Create `.fractary/agents/my-agent.yaml`:

```yaml
name: my-custom-agent
type: agent
description: Custom agent for specialized tasks

llm:
  provider: anthropic
  model: claude-sonnet-4-20250514
  temperature: 0.0
  max_tokens: 8192

system_prompt: |
  You are a specialized agent for...

  Your responsibilities:
  - Task 1
  - Task 2

tools:
  - read_file
  - write_file
  - execute_bash

version: "1.0.0"
author: "Your Name"
tags:
  - custom
  - specialized
```

### Use Custom Agent

```json
{
  "forge": { "enabled": true },
  "phases": {
    "build": {
      "enabled": true,
      "agent": "my-custom-agent"
    }
  }
}
```

---

## Troubleshooting

### Error: Agent not found

```
Error: Agent 'frame-agent' not found.
Run 'forge install frame-agent' or check your .fractary/agents/ directory.
```

**Solution:**
1. Install the agent: `forge install frame-agent`
2. Or create a local definition in `.fractary/agents/frame-agent.yaml`
3. Or disable Forge temporarily: `"forge.enabled": false`

### Error: Forge not configured

```
Error: @fractary/forge is not configured
```

**Solution:**
1. Ensure `@fractary/forge` is installed: `npm install @fractary/forge`
2. Run `forge init` to configure

### Workflow still using Python agents

**Check:**
1. Is `forge.enabled` set to `true` in your config?
2. Are you passing config to FaberWorkflow constructor?
3. Check logs for "Legacy phase execution" messages

**Debug:**
```typescript
const workflow = new FaberWorkflow({
  config: {
    forge: { enabled: true }
  }
});

// Check mode
console.log('Forge enabled:', workflow.agentExecutor.isForgeEnabled());
```

### Performance issues

**Agent resolution is slow:**
- Agents are cached after first resolution
- Check network connectivity to Stockyard
- Use local agents for better performance

**Solution:**
```json
{
  "forge": {
    "enabled": true,
    "prefer_local": true  // Prefer .fractary/agents/ over remote
  }
}
```

---

## Breaking Changes in v2.0

When v2.0 releases:

### Removed
- ❌ `python/faber/definitions/` module
- ❌ `python/faber/agents/` module
- ❌ Python-based agent definitions
- ❌ Legacy mode (`forge.enabled: false`)

### Required
- ✅ `@fractary/forge` dependency
- ✅ `forge.enabled: true` in config
- ✅ YAML agent definitions

### Changed
- Default config: `forge.enabled` changes from `false` to `true`
- Configuration validation enforces Forge settings

---

## FAQ

### When should I migrate?

**Answer:** Migrate during v1.x at your own pace. v2.0 will require Forge, so migrate before upgrading.

### Will my workflows break?

**Answer:** No, v1.x supports both modes. Your existing workflows continue working unchanged.

### Can I use custom Python agents?

**Answer:** In v1.x, yes. In v2.0, you'll need to convert them to YAML definitions.

### How do I convert a Python agent to YAML?

**Answer:** See the [Creating Custom Agents](#creating-custom-agents) section above. Extract:
- System prompt from Python
- Tool list
- LLM configuration
- Format as YAML

**Example conversion:**

```python
# Before: Python
class MyAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="my-agent",
            system_prompt="You are...",
            tools=["tool1", "tool2"]
        )
```

```yaml
# After: YAML
name: my-agent
type: agent
system_prompt: "You are..."
tools:
  - tool1
  - tool2
llm:
  provider: anthropic
  model: claude-sonnet-4-20250514
version: "1.0.0"
```

### Where are agent definitions stored?

**Answer:**
- **Project-local:** `.fractary/agents/` (highest priority)
- **Global:** `~/.fractary/registry/agents/` (shared across projects)
- **Stockyard:** Remote marketplace (future)

### Can I use both local and remote agents?

**Answer:** Yes! Forge checks in order:
1. Project-local (`.fractary/agents/`)
2. Global (`~/.fractary/registry/`)
3. Stockyard (remote)

### What if I need Python support beyond v2.0?

**Answer:** Contact the maintainers. If there's sufficient demand, we may consider:
- Extended v1.x support
- Python bindings for Forge
- Community-maintained Python fork

---

## Migration Checklist

Use this checklist to track your migration progress:

- [ ] **Step 1:** Read this migration guide
- [ ] **Step 2:** Update FABER to latest v1.x
- [ ] **Step 3:** Install `@fractary/forge`: `npm install @fractary/forge`
- [ ] **Step 4:** Update config: Set `forge.enabled: true`
- [ ] **Step 5:** Install FABER agents: `forge install frame-agent ...`
- [ ] **Step 6:** Test workflows in Forge mode
- [ ] **Step 7:** Convert custom Python agents to YAML (if any)
- [ ] **Step 8:** Update CI/CD to use Forge mode
- [ ] **Step 9:** Remove Python agent imports (if any)
- [ ] **Step 10:** Update documentation and team

---

## Getting Help

- **GitHub Issues:** [fractary/faber/issues](https://github.com/fractary/faber/issues)
- **Discussions:** [fractary/faber/discussions](https://github.com/fractary/faber/discussions)
- **Forge Docs:** [@fractary/forge README](https://github.com/fractary/forge)

---

## Related Resources

- [SPEC-FABER-002: Forge Integration Interface](../specs/SPEC-FABER-002-forge-integration.md)
- [SPEC-FORGE-001: Agent & Tool Definition System](../specs/SPEC-FORGE-001-agent-tool-definition-system.md)
- [SPEC-FORGE-002: Agent Registry & Resolution](../specs/SPEC-FORGE-002-agent-registry-resolution.md)
- [Implementation Spec: Phase 3 Integration](../specs/IMPL-20251215012620-faber-forge-phase3-integration.md)
