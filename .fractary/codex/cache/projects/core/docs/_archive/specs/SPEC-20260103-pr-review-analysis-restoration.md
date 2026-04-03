# SPEC-20260103: PR Review Analysis Restoration

## Status
**Status**: Approved
**Created**: 2026-01-03
**Owner**: fractary-repo plugin

## Problem Statement

The `fractary-repo:pr-review` command currently just wraps `gh pr review` without analyzing PR comments, CI results, or providing intelligent recommendations. The archived implementation had comprehensive analysis (1434 lines in pr-manager skill) that was lost during the plugin v3 refactoring.

### Current Behavior
- Simple command that calls `gh pr view` and `gh pr diff`
- No analysis of PR comments for blocking issues
- No CI status checking
- No intelligent recommendations
- Missing: The analysis features users rely on for informed review decisions

### User Report
User ran `fractary-repo:pr-review` and noticed it didn't look at:
- Issue comments with detailed code review feedback
- CI workflow results (claude-review check had run and posted detailed analysis)
- Existing review states and blocking conditions

## User Requirements

1. **Restore key analysis features**: Comment parsing for blocking issues, CI status analysis, recommendation engine
2. **Analyze and summarize**: Parse comments and CI failures, provide recommendations on whether to approve
3. **Agent-based architecture**: Command should delegate to an agent for the analysis work

## Solution Architecture

### Pattern: Command → Agent

```
/fractary-repo:pr-review <pr_number>
    ↓
Command (delegate to agent)
    ↓
Agent (analyze + optionally submit review)
    ↓ uses gh CLI to fetch
PR data (comments, reviews, statusCheckRollup)
```

**Why Command → Agent pattern:**
- Follows established patterns in fractary-repo plugin
- Self-contained (~180 lines vs 1434 in archived skill)
- No skill layer bloat for single-plugin functionality
- Easy to maintain and extend
- Can extract to skill later if needed

## Technical Design

### Data Fetching

Agent fetches comprehensive PR data via single gh CLI call:

```bash
gh pr view <pr_number> --json \
  number,title,body,state,url,headRefName,baseRefName,author,isDraft,\
  mergeable,reviewDecision,statusCheckRollup,comments,reviews,\
  createdAt,updatedAt,additions,deletions,changedFiles
```

**New fields being fetched** (not in current implementation):
- `statusCheckRollup`: Array of CI check results
- `comments`: Issue comments array
- `reviews`: Review objects with state and body

### Analysis Decision Tree

Priority-based decision tree (first match wins):

| Priority | Condition | Recommendation | Rationale |
|----------|-----------|----------------|-----------|
| **P0** | `mergeable === "CONFLICTING"` | CANNOT MERGE | Merge conflicts block everything |
| **P0** | CI checks failing (FAILURE/ERROR) | DO NOT APPROVE - FIX CI | CI must pass before approval |
| **P0** | Any reviewer: `CHANGES_REQUESTED` | DO NOT APPROVE - CHANGES REQUESTED | Explicit reviewer block |
| **P0** | `reviewDecision === "CHANGES_REQUESTED"` | DO NOT APPROVE | GitHub-level block |
| **P1** | Blocking keywords in comments | DO NOT APPROVE - ADDRESS ISSUES | Implicit block from code review |
| **P2** | `reviewDecision === "REVIEW_REQUIRED"` | REVIEW REQUIRED | Process requirement |
| **P3** | No blocking conditions | READY TO APPROVE | Can proceed |

### Comment Analysis Logic

**Blocking Keywords** (case-insensitive search):

Critical Issues:
- "critical issue", "critical bug", "critical problem"

Blocking:
- "blocking", "blocker", "blocks"

Must Fix:
- "must fix", "need to fix", "needs to be fixed", "has to be fixed"

Security:
- "security issue", "security vulnerability", "security risk"

Approval Blockers:
- "do not approve", "don't approve", "not ready", "not approved"

Failures:
- "fails", "failing", "failed"

Breakage:
- "broken", "breaks", "breaking"

Code Issues:
- "memory leak", "race condition", "deadlock"
- "incorrect", "wrong", "error", "bug"

**Context Clues**:
- "before approving" or "before merge" → Makes issues blocking
- "nice to have" or "optional" → NOT blocking
- From PR author → Usually addressing feedback, not raising issues

**Parsing Process**:
1. Collect comments from `comments` array and `reviews[].body`
2. Sort by timestamp (most recent first)
3. Identify most recent substantial comment (>50 chars, not bot/trivial)
4. Search for blocking keywords
5. Apply context clues
6. Extract structured issues from numbered/bullet lists

### Output Format

```
PR ANALYSIS: #{pr_number}
Title: ...
Branch: head -> base
Author: ...
Status: ...
---

MERGE STATUS:
[MERGEABLE | CONFLICTING | UNKNOWN]
[List conflicting files if applicable]

CI STATUS:
[No CI checks | List checks with status]
Summary: X passing, Y failing, Z pending

REVIEW STATUS:
Overall Decision: [reviewDecision]
Reviews by user (most recent):
- user1: APPROVED at timestamp
- user2: CHANGES_REQUESTED at timestamp
Summary: X approved, Y changes requested, Z commented

COMMENT ANALYSIS:
Total comments: X
Most Recent Substantial Comment:
  From: user
  Date: timestamp
  [BLOCKING INDICATORS: keyword1, keyword2 if found]
  Content Preview: ...
  [Outstanding Issues: list if extracted]

CRITICAL ISSUES SUMMARY:
[List all blocking conditions found]

---
RECOMMENDATION: [recommendation]
Priority: [P0|P1|P2|P3]
Reason: [detailed explanation with evidence]

---
SUGGESTED NEXT STEPS:
[Context-aware action items based on recommendation]
```

## Implementation Steps

### 1. Create PR Review Agent

**File**: `plugins/repo/agents/fractary-faber-pr-review-agent.md` (NEW - ~180 lines)

**Sections**:
- Frontmatter (name, description, tools, color, model)
- Context (comprehensive analysis purpose)
- Critical Rules (fetch comprehensive data, never approve if blocking issues)
- Arguments (pr_number, action, comment, context)
- Workflow (parse args → fetch data → analyze → present → submit if action)
- Decision Tree (P0-P3 priorities)
- Blocking Keywords (full list)
- Output Format (structured template)

### 2. Update PR Review Command

**File**: `plugins/repo/commands/fractary-faber-pr-review.md` (MODIFY)

**Changes**:
- `allowed-tools`: Change from `Bash(gh pr review:*)...` to `Task(fractary-repo:pr-review-agent)`
- Task description: "Delegate to fractary-repo:pr-review-agent for PR analysis and review"
- Keep argument-hint unchanged for backward compatibility

### 3. Update Plugin Manifest

**File**: `plugins/repo/.claude-plugin/plugin.json` (MODIFY)

**Changes**:
```json
{
  "name": "fractary-repo",
  "version": "2.4.0",  // Bump from 2.3.4
  "agents": [
    "./agents/fractary-faber-init.md",
    "./agents/fractary-faber-pr-review-agent.md"  // Add new agent
  ]
}
```

### 4. Update Marketplace Manifest

**File**: `.claude-plugin/marketplace.json` (MODIFY)

**Changes**:
- Update fractary-repo version: "2.3.4" → "2.4.0"

## Backward Compatibility

All existing usage patterns continue to work:

| Usage | Before | After |
|-------|--------|-------|
| Analyze PR | Basic view + diff | Comprehensive analysis with recommendation |
| Approve PR | Direct gh pr review | Analysis first, then approve |
| Request changes | Direct gh pr review | Analysis first, then request changes |

**Changes are purely additive** - analysis is shown before any review submission.

## Success Criteria

Technical:
- ✅ Agent fetches comments, reviews, and statusCheckRollup
- ✅ Merge conflicts detected and reported
- ✅ CI failures block approval with P0 priority
- ✅ CHANGES_REQUESTED reviews block approval
- ✅ Blocking keywords in comments trigger P1 recommendation
- ✅ Decision tree produces correct recommendations
- ✅ Output is structured and actionable
- ✅ Review submission still works (approve, request_changes, comment)

Compatibility:
- ✅ Backward compatible with existing command usage
- ✅ Same command signature and arguments
- ✅ Same error handling for gh CLI failures

## Testing Scenarios

1. **PR with merge conflicts** → Recommendation: CANNOT MERGE (P0)
2. **PR with failing CI** → Recommendation: DO NOT APPROVE - FIX CI (P0)
3. **PR with CHANGES_REQUESTED review** → Recommendation: DO NOT APPROVE (P0)
4. **PR with blocking keywords in comments** → Recommendation: DO NOT APPROVE - ADDRESS ISSUES (P1)
5. **PR requiring reviews** → Recommendation: REVIEW REQUIRED (P2)
6. **Clean PR ready to approve** → Recommendation: READY TO APPROVE (P3)
7. **Submit approve action** → Shows analysis, then submits review

## Implementation Priority

**Phase 1 (Core)** - Must Have:
- Agent file creation with all sections
- Command update to delegate
- Manifest updates
- Basic decision tree (P0-P3)
- Structured output format

**Phase 2 (Analysis)** - Should Have:
- Comment keyword detection
- Context clues ("before approving" vs "nice to have")
- Next steps suggestions

**Phase 3 (Polish)** - Nice to Have:
- Structured issue extraction from lists
- Enhanced error handling
- Performance optimization

## Reference Files

- `plugins/repo/archived/skills/fractary-faber-pr-manager/SKILL.md` (lines 176-538): Original analysis logic
- `plugins/repo/archived/agents/fractary-faber-pr-review.md`: Original agent design
- `sdk/js/src/repo/providers/github.ts`: gh CLI usage patterns
- `docs/plugin-development/context-argument-standard.md`: Context argument specification

## Version History

- **2.4.0** (This spec): Restore PR review analysis features
- **2.3.4** (Current): Simple command wrapping gh pr review
- **Pre-refactoring**: Comprehensive pr-manager skill with 1434 lines of analysis logic
