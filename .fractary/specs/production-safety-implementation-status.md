---
org: corthos
system: etl.corthion.ai
title: Production Safety Implementation Status
description: Status of production safety rules implementation across commands and agents
tags: [standards, production, safety, implementation, status]
audience: [all-engineers, claude-code]
created: 2025-10-11
updated: 2025-10-11
visibility: internal
---

# Production Safety Implementation Status

## Overview

This document tracks the implementation status of mandatory production safety rules requiring explicit user confirmation before ANY production operation.

**Reference**: `/docs/standards/production-safety-rules.md`

---

## ✅ Completed Updates

### Core Documentation

- [x] **Production Safety Rules** (`/docs/standards/production-safety-rules.md`)
  - Established Rule #0: Mandatory User Confirmation for ALL Production Operations
  - Defined exact 3-question confirmation protocol
  - Provided pseudo-code for confirmation handling
  - Documented agent and manager responsibilities
  - Created comprehensive examples

### Commands Updated with Production Confirmation

- [x] **`/dataset-loader-deploy`** (`.claude/commands/project/dataset-loader-deploy.md`)
  - Added `⚠️ PRODUCTION SAFETY ⚠️` section
  - Documented mandatory production confirmation protocol
  - Updated Implementation section with confirmation flow
  - Added `ProductionConfirmed` flag to agent invocation
  - Examples show explicit confirmation requirements

- [x] **`/dataset-data-load`** (`.claude/commands/project/dataset-data-load.md`)
  - Added `⚠️ PRODUCTION SAFETY ⚠️` section
  - Documented mandatory production confirmation for data loads
  - Emphasized DANGER of production data writes
  - Updated parameters with confirmation requirements

- [x] **`/manage-dataset`** (`.claude/commands/project/manage-dataset.md`)
  - Added `⚠️ PRODUCTION SAFETY - BATCH OPERATIONS ⚠️` section
  - Documented enhanced 4-question protocol for batch operations
  - Emphasized EXTREME RISK of batch production operations
  - Strongly recommended `--dry-run` for production
  - Documented batch impact calculation requirements

---

## ⚠️ Remaining Updates Required

### Commands Needing Production Safety Sections

The following commands need `⚠️ PRODUCTION SAFETY ⚠️` sections added:

- [ ] **`/dataset-deploy`** (`.claude/commands/project/dataset-deploy.md`)
  - Add production confirmation requirements
  - Update implementation section
  - Add confirmation protocol

- [ ] **`/dataset-loader-update`** (`.claude/commands/project/dataset-loader-update.md`)
  - If supports `--complete` with deployment, add production safety
  - Otherwise, note that it's code-only (no deployment)

- [ ] **`/dataset-update`** (`.claude/commands/project/dataset-update.md`)
  - Add production confirmation if workflow includes deployment

### Agents Needing Production Confirmation Instructions

ALL agents that perform deployments or data loads need explicit production confirmation instructions:

- [x] **`dataset-deployer`** (`.claude/agents/project/dataset-deployer.md`)
  - ✅ Added `⚠️ CRITICAL: MANDATORY PRODUCTION CONFIRMATION PROTOCOL ⚠️` section at top
  - ✅ Agent checks environment at START
  - ✅ Agent requests confirmation if `environment==prod` AND `ProductionConfirmed==false`
  - ✅ Documented defense-in-depth: agent confirms even if command already did
  - ✅ Updated workflow descriptions to include confirmation step

- [x] **`dataset-developer`** (`.claude/agents/project/dataset-developer.md`)
  - ✅ Added production safety section for code development
  - ✅ Clarified that agent does NOT deploy (only writes code)
  - ✅ Documented environment pass-through when delegating to dataset-deployer
  - ✅ Clear examples of correct vs. wrong behavior

- [x] **`dataset-manager`** (`.claude/agents/project/dataset-manager.md`)
  - ✅ Added CRITICAL instructions: NEVER auto-deploy to production
  - ✅ Manager can assess production readiness but MUST NOT deploy
  - ✅ Manager provides explicit commands for user to run
  - ✅ For batch operations with `--environment=prod`, confirm ONCE before starting batch
  - ✅ Documented that manager delegates to other agents with environment preserved

- [ ] **`dataset-tester`** (`.claude/agents/project/dataset-tester.md`)
  - Clarify that testing is read-only (no confirmation needed)
  - Document that tests can run in production for validation
  - No deployment actions

- [ ] **`dataset-documenter`** (`.claude/agents/project/dataset-documenter.md`)
  - Clarify that documentation is environment-agnostic (no confirmation needed)
  - No deployment actions

- [ ] **`dataset-inspector`** (`.claude/agents/project/dataset-inspector.md`)
  - Clarify that inspection is read-only (no confirmation needed)
  - No deployment actions

- [ ] **`data-engineer-etl`** (`.claude/agents/project/data-engineer-etl.md`)
  - Add production confirmation instructions if agent performs deployments
  - Clarify scope of responsibilities

### Core Documentation Updates

- [ ] **`CLAUDE.md`** (root)
  - Add reference to Production Safety Rules as MANDATORY
  - Update "Development Standards" section
  - Add prominent link in "Infrastructure & Deployment" section
  - Emphasize production confirmation requirement

- [ ] **`/docs/guides/dataset-deployment-guide.md`**
  - Add production confirmation workflow examples
  - Update deployment procedures with confirmation steps
  - Add safety checklist

- [ ] **`/docs/guides/agent-guide.md`**
  - Document production confirmation requirements for agents
  - Add examples of correct agent behavior
  - Emphasize defense-in-depth safety

---

## Implementation Guidelines

### For Commands

Every command that accepts `--environment` parameter MUST include:

```markdown
## ⚠️ PRODUCTION SAFETY ⚠️

**CRITICAL**: This command defaults to TEST environment and REQUIRES explicit user confirmation for production operations.

- **Default**: `--environment=test` (SAFE - no confirmation required)
- **Production**: `--environment=prod` (HIGH RISK - MANDATORY confirmation required)

### Mandatory Production Confirmation

When `--environment=prod` is specified, Claude MUST:
1. **STOP immediately** before any operation
2. **Display production warning** with impact assessment
3. **Request explicit user confirmation** using the 3-question protocol:
   - Have you validated this in TEST? (y/n)
   - Do you understand this affects PRODUCTION? (y/n)
   - Type 'PRODUCTION' to confirm
4. **Only proceed if user explicitly confirms** all three checks
5. **Cancel operation** if any confirmation fails

**NO EXCEPTIONS**: Production operations NEVER proceed without user confirmation.
```

### For Agents

Every agent that performs deployments or data loads MUST include at the TOP:

```markdown
## ⚠️ CRITICAL: MANDATORY PRODUCTION CONFIRMATION PROTOCOL ⚠️

**ABSOLUTE RULE**: You MUST NEVER deploy to production without explicit user confirmation.

### Production Safety Checks (MANDATORY)

At the START of EVERY execution, you MUST:

1. **Check target environment**:
   ```python
   if environment in ['prod', 'production']:
       # STOP IMMEDIATELY - Production detected
   ```

2. **If production detected AND ProductionConfirmed flag is FALSE**:
   - **STOP all operations immediately**
   - **Display production warning** (use standard 3-question protocol)
   - **Wait for user confirmation**
   - **Only proceed if user explicitly confirms**
   - **Exit immediately if any confirmation fails**

3. **If ProductionConfirmed flag is TRUE**:
   - User has already confirmed via the invoking command
   - You may proceed with production operations
   - Still log production environment clearly in all output

**DEFENSE-IN-DEPTH**: Even if invoking command passed `--environment=prod`, verify ProductionConfirmed flag or request confirmation yourself.
```

### For Non-Deployment Agents

Agents that do NOT deploy or modify environments should include:

```markdown
## Environment Handling

**IMPORTANT**: This agent performs [read-only operations / documentation generation / testing] and does NOT require production confirmation.

- Operations are [read-only / environment-agnostic]
- No infrastructure changes
- No data modifications
- Safe to run in any environment

However, you MUST still respect the environment parameter when provided and clearly indicate which environment you're operating in.
```

---

## Testing Checklist

Before considering implementation complete, test these scenarios:

### Single Dataset - Test Environment
- [ ] Command runs without confirmation
- [ ] Agent operates normally
- [ ] All steps complete successfully

### Single Dataset - Production (With Flag)
- [ ] Command detects `--environment=prod`
- [ ] Command displays production warning
- [ ] Command requests 3-question confirmation
- [ ] Command only proceeds if all three confirmed
- [ ] Command cancels if any confirmation fails
- [ ] Agent receives `ProductionConfirmed=true` flag
- [ ] Agent proceeds without additional confirmation
- [ ] All operations use production environment

### Batch - Test Environment
- [ ] Manager processes multiple datasets in test
- [ ] No confirmation required
- [ ] All datasets processed successfully

### Batch - Production (With Flag)
- [ ] Manager detects `--environment=prod` with multiple datasets
- [ ] Manager calculates and displays batch impact
- [ ] Manager requests 4-question confirmation for batch
- [ ] Manager only proceeds if all four confirmed
- [ ] Manager cancels entire batch if any confirmation fails
- [ ] All datasets processed in production
- [ ] Environment maintained across all datasets

### `--complete` Workflow - Test
- [ ] Entire workflow runs in test
- [ ] No environment switching
- [ ] No production suggestions

### `--complete` Workflow - Production
- [ ] Confirmation requested ONCE at start
- [ ] Entire workflow runs in production after confirmation
- [ ] No additional confirmations per step
- [ ] Environment maintained throughout

### Error Cases
- [ ] User says "n" to question 1 → operation cancelled
- [ ] User says "n" to question 2 → operation cancelled
- [ ] User types "PROD" instead of "PRODUCTION" → operation cancelled
- [ ] Command provides helpful message on cancellation
- [ ] Command suggests test environment command

---

## Rollout Plan

### Phase 1: Critical Commands (COMPLETED)
- [x] `/dataset-loader-deploy`
- [x] `/dataset-data-load`
- [x] `/manage-dataset`

### Phase 2: Critical Agents (COMPLETED)
- [x] `dataset-deployer`
- [x] `dataset-manager`
- [x] `dataset-developer`

### Phase 3: Supporting Commands
- [ ] `/dataset-deploy`
- [ ] `/dataset-update`
- [ ] Other deployment commands

### Phase 4: Documentation
- [ ] `CLAUDE.md`
- [ ] Deployment guides
- [ ] Agent guides

### Phase 5: Testing & Validation
- [ ] Test all scenarios
- [ ] Update test scripts
- [ ] Validate with real workflows

---

## Success Criteria

Implementation is complete when:
- [ ] ALL commands with `--environment` parameter have production safety sections
- [ ] ALL deployment agents have mandatory confirmation instructions
- [ ] ALL documentation references production safety rules
- [ ] ALL test scenarios pass
- [ ] Production operations NEVER proceed without explicit user confirmation
- [ ] Claude Code behavior is 100% predictable and safe

---

## Priority for Immediate Implementation

**HIGHEST PRIORITY** (Complete First):

1. **`dataset-deployer` agent** - Most critical, performs all infrastructure deployments
2. **`dataset-manager` agent** - Can operate on multiple datasets, high risk
3. **`CLAUDE.md`** - Central reference that all other docs point to

**HIGH PRIORITY** (Complete Soon):

4. **`dataset-developer` agent** - May trigger deployments via `--complete`
5. **`/dataset-deploy` command** - Alternative deployment command
6. **Deployment guide updates** - User-facing documentation

---

## Notes

- Production confirmation protocol is intentionally verbose and requires multiple checks
- Defense-in-depth: Both commands AND agents should verify production intent
- Batch operations have even stricter requirements (4 questions instead of 3)
- `--dry-run` never requires confirmation (read-only operation)
- Environment-agnostic operations (documentation, read-only inspections) don't require confirmation

---

## Contact

For questions about production safety implementation:
- Review: `/docs/standards/production-safety-rules.md`
- Reference: This document for implementation status
- All changes must comply with Rule #0: Mandatory User Confirmation
