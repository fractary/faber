# SPEC-00033: PR Review CI Comment Recency Fix

**Status**: Draft
**Priority**: High
**Type**: Bug Fix
**Target Plugin**: fractary-repo
**Target Version**: v4.1.0
**Issue**: #33
**Date**: 2026-01-07

## Executive Summary

Fix the `fractary-repo:pr-review` command to prioritize the most recent CI review comment rather than citing issues from older CI comments that have already been addressed. Currently, when multiple CI reviews run on a PR, the command may report fixed issues from earlier comments instead of focusing on the latest findings.

## Problem Statement

### Current Behavior

1. CI review runs and posts a comment with issues found
2. User runs `/fractary-repo:pr-review` - it cites the issues
3. User fixes the issues and pushes
4. CI review runs again and posts a new comment with updated findings
5. User runs `/fractary-repo:pr-review` again - **it repeats old issues from earlier CI comments instead of focusing on the most recent CI comment**

### Root Cause

The current comment analysis logic in `pr-review-agent.md` does not properly distinguish between CI bot comments and human comments, nor does it prioritize the most recent CI comment when multiple exist. The logic:

1. Collects all comments from `comments` array and `reviews[].body`
2. Sorts by timestamp (most recent first)
3. Identifies "most recent substantial comment" (>50 chars, not bot/trivial)
4. Searches for blocking keywords

**The flaw**: Step 3 explicitly filters out bot comments with the "not bot" criteria, which means CI comments are deprioritized. Additionally, there is no concept of "most recent CI comment" - all CI comments are treated equally, allowing old issues to persist in the analysis.

### Expected Behavior

The PR review command should:

1. Identify CI bot comments by author username pattern
2. Find the single most recent CI comment by timestamp
3. Use **only** that latest CI comment for blocking keyword analysis
4. Ignore older CI comments entirely (they represent stale state)
5. Continue analyzing human comments separately (all human comments remain relevant)

### User Goal

Users want to know if the PR is ready to approve/merge, or what issues remain to fix. Showing already-fixed issues defeats this purpose and creates confusion.

## Requirements

### R1: CI Comment Identification

The system must identify CI bot comments using author username patterns:

**Known CI Bot Patterns** (case-insensitive):
- `github-actions` (GitHub Actions bot)
- `*-bot` (suffix pattern for various bots)
- `*[bot]` (GitHub Apps bot naming convention)
- `dependabot` (Dependency updates)
- `renovate` (Dependency updates)
- `codecov` (Coverage reports)
- `sonarcloud` (Code quality)

**Implementation**:
```javascript
function isCIBot(authorLogin) {
  const login = authorLogin.toLowerCase();
  const botPatterns = [
    'github-actions',
    'dependabot',
    'renovate',
    'codecov',
    'sonarcloud',
    /.*-bot$/,
    /.*\[bot\]$/
  ];
  return botPatterns.some(pattern => {
    if (typeof pattern === 'string') return login === pattern;
    return pattern.test(login);
  });
}
```

### R2: Most Recent CI Comment Selection

When multiple CI bot comments exist, select only the most recent one:

**Algorithm**:
1. Filter all comments to identify CI bot comments
2. Sort CI comments by `createdAt` timestamp descending
3. Select the first (most recent) CI comment
4. Ignore all older CI comments for blocking analysis

**Rationale**: CI runs represent point-in-time analysis. Only the most recent run reflects the current state of the code. Older CI comments are historical artifacts that should not influence the current recommendation.

### R3: Separate Comment Analysis Tracks

The comment analysis must use two distinct tracks:

**Track 1: CI Comments**
- Identify all CI bot comments (per R1)
- Select only the most recent (per R2)
- Analyze for blocking keywords
- Report as "CI Review Issues" if blocking keywords found

**Track 2: Human Comments**
- All non-CI comments
- Continue using existing logic (most recent substantial comment)
- Report as "Reviewer Comments" if blocking keywords found

**Merged Analysis**:
- Both tracks contribute to the overall recommendation
- CI issues and human reviewer issues are reported separately
- Either can trigger P1 blocking status

### R4: Output Format Updates

Update the Comment Analysis section to clearly distinguish between CI and human feedback:

```
--------------------------------------------------------------------------------
COMMENT ANALYSIS
--------------------------------------------------------------------------------
Total comments: {total}

CI Review Analysis:
  Bot: {ci_author_login}
  Latest CI comment: {ci_createdAt}
  Previous CI comments: {ignored_count} (ignored - superseded by latest)

  {If blocking keywords in latest CI comment:}
  Issues Found in Latest CI Review:
  {List extracted issues from latest CI comment only}

  {If no blocking keywords in latest CI comment:}
  No outstanding CI issues

Human Review Analysis:
  Most Recent Substantial Comment:
    From: {human_author_login}
    Date: {human_createdAt}

  {If blocking keywords:}
  Issues Raised:
  {List extracted issues}

  {If no blocking keywords:}
  No blocking issues from reviewers

--------------------------------------------------------------------------------
```

### R5: Backward Compatibility

- The command signature and arguments remain unchanged
- The recommendation priority levels (P0-P3) remain unchanged
- Human comment analysis continues to work as before
- Only CI comment handling changes

## Technical Design

### Modified Workflow

Update step 3 of the pr-review-agent workflow:

**Current (P1: Analyze Comments for Blocking Keywords)**:
```
1. Collect all comments from both sources
2. Sort by timestamp (most recent first)
3. Find most recent substantial comment (>50 chars, not bot, not trivial)
4. Search content for BLOCKING KEYWORDS
5. Apply CONTEXT CLUES
6. Extract structured issues
```

**New (P1: Analyze Comments for Blocking Keywords)**:
```
1. Collect all comments from `comments` array and `reviews[].body`
2. Partition comments into two groups:
   a. CI bot comments (using isCIBot() check)
   b. Human comments (all others)
3. For CI comments:
   a. Sort by timestamp descending
   b. Take ONLY the most recent CI comment
   c. Search for blocking keywords
   d. Extract structured issues
4. For Human comments:
   a. Sort by timestamp (most recent first)
   b. Find most recent substantial comment (>50 chars, not trivial)
   c. Search for blocking keywords
   d. Apply context clues
   e. Extract structured issues
5. Merge results - blocking found in EITHER track triggers P1
```

### Data Flow

```
gh pr view --json comments,reviews,...
            |
            v
    +-----------------+
    |  All Comments   |
    +-----------------+
            |
     isCIBot() check
            |
    +-------+-------+
    |               |
    v               v
+--------+    +----------+
| CI Bot |    |  Human   |
+--------+    +----------+
    |               |
    v               v
Sort by      Sort by
timestamp    timestamp
    |               |
    v               v
Take ONLY    Find most
most recent  recent
    |        substantial
    v               |
Analyze for         v
blocking       Analyze for
keywords       blocking
    |          keywords +
    |          context
    |               |
    +-------+-------+
            |
            v
    +-----------------+
    | Merged Analysis |
    | (P1 if either   |
    |  has blocking)  |
    +-----------------+
```

### Agent Updates

**File**: `plugins/repo/agents/fractary-faber-pr-review-agent.md`

**Changes Required**:

1. **Add CI Bot Detection Section** (after Blocking Keywords section):
```markdown
**CI BOT IDENTIFICATION**:

Identify CI bot comments by author username pattern:
- `github-actions` - GitHub Actions workflows
- Names ending in `-bot` - Various CI/automation bots
- Names ending in `[bot]` - GitHub Apps
- `dependabot`, `renovate` - Dependency bots
- `codecov`, `sonarcloud` - Code quality bots

When processing CI bot comments:
1. Identify ALL CI bot comments using patterns above
2. Sort by `createdAt` timestamp (newest first)
3. Use ONLY the most recent CI comment for analysis
4. IGNORE all older CI comments - they are superseded
```

2. **Update Comment Analysis Logic** (P1 section):

Replace current logic with dual-track analysis as specified in R3.

3. **Update Output Format** (Comment Analysis section):

Use the new format specified in R4 that separates CI and human analysis.

## Implementation Steps

### Step 1: Update PR Review Agent

**File**: `plugins/repo/agents/fractary-faber-pr-review-agent.md`

**Changes**:
1. Add "CI BOT IDENTIFICATION" section after "BLOCKING KEYWORDS" section
2. Update "P1: Analyze Comments for Blocking Keywords" section with dual-track logic
3. Update "COMMENT ANALYSIS" output format template
4. Add examples showing CI comment handling

### Step 2: Update Version

**File**: `plugins/repo/.claude-plugin/plugin.json`

**Change**: Bump version to indicate bug fix

### Step 3: Update Marketplace

**File**: `.claude-plugin/marketplace.json`

**Change**: Update fractary-repo version

## Testing Scenarios

### Scenario 1: Single CI Comment
- **Setup**: PR with one CI comment containing issues
- **Expected**: Issues from that CI comment are reported
- **Validates**: Basic CI comment detection

### Scenario 2: Multiple CI Comments - Issues Fixed
- **Setup**: PR with two CI comments:
  - First (older): Lists issues A, B, C
  - Second (newer): Lists only issue D (A, B, C were fixed)
- **Expected**: Only issue D is reported
- **Validates**: Most recent CI comment prioritization

### Scenario 3: Multiple CI Comments - All Fixed
- **Setup**: PR with two CI comments:
  - First (older): Lists issues A, B
  - Second (newer): "All checks passed" (no blocking keywords)
- **Expected**: No CI issues reported, recommendation may be P3
- **Validates**: Clean latest CI state is recognized

### Scenario 4: Mixed CI and Human Comments
- **Setup**: PR with:
  - Old CI comment: Issues A, B
  - New CI comment: Issue C only
  - Human comment: Issue D
- **Expected**: Issues C (from CI) and D (from human) reported separately
- **Validates**: Dual-track analysis and separate reporting

### Scenario 5: Human Comment After CI Comment
- **Setup**: PR with:
  - CI comment with issues
  - Human comment responding to/dismissing some issues
- **Expected**: CI issues still reported (human cannot dismiss CI)
- **Validates**: CI and human tracks are independent

### Scenario 6: Multiple CI Bots
- **Setup**: PR with comments from github-actions and codecov
- **Expected**: Most recent comment from either bot is used
- **Validates**: Single most recent CI comment overall (as clarified)

## Success Criteria

**Functional**:
- [ ] CI bot comments are correctly identified by username pattern
- [ ] Only the most recent CI comment is analyzed for blocking keywords
- [ ] Older CI comments are explicitly ignored
- [ ] Human comments continue to be analyzed as before
- [ ] Output clearly distinguishes CI vs human feedback
- [ ] Both CI and human issues can trigger P1 blocking status

**User Experience**:
- [ ] Running pr-review after fixing issues shows only remaining issues
- [ ] User can clearly see which issues come from CI vs human reviewers
- [ ] No confusion from stale/fixed issues being reported

**Backward Compatibility**:
- [ ] Command signature unchanged
- [ ] PRs without CI comments work exactly as before
- [ ] Priority levels unchanged
- [ ] Review submission unchanged

## Edge Cases

### No CI Comments
- Behavior: Skip CI track entirely, use human track only
- Output: "No CI review comments found"

### Only CI Comments (No Human Comments)
- Behavior: Use CI track only, skip human track
- Output: Show CI analysis, "No human review comments"

### CI Comment with No Blocking Keywords
- Behavior: Report as clean CI status
- Output: "No outstanding CI issues"

### Very Old CI Comments Only
- Behavior: Still use the most recent one, regardless of age
- Note: Age alone does not invalidate a CI comment

### CI Bot Posts Multiple Comments in Same Run
- Behavior: Use most recent by timestamp
- Note: This handles bots that post updates to their own comments

## Clarifications Applied

From issue discussion:
1. **CI Comment Identification**: By bot username pattern (github-actions, *-bot, *[bot], etc.)
2. **Recency Definition**: Most recent by `createdAt` timestamp
3. **Historical Context**: Only show latest CI comment, ignore older ones entirely
4. **Multiple CI Tools**: Use single most recent CI comment overall (not per-bot)

## References

- Issue #33: PR review command prioritizes old CI comments over latest feedback
- `plugins/repo/agents/fractary-faber-pr-review-agent.md`: Current implementation
- SPEC-20260103: PR Review Analysis Restoration (original restoration spec)

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 1.0 | 2026-01-07 | Initial specification |
