---
spec_id: SPEC-20251228-issue-refine-command
title: Issue Refine Command - Requirements Clarification Tool
type: feature
status: draft
created: 2025-12-28
author: claude-sonnet-4-5
validated: false
source: conversation
related_docs:
  - plugins/work/commands/fractary-faber-issue-create.md
  - plugins/spec/agents/fractary-faber-spec-refine.md
changelog: []
---

# Feature Specification: Issue Refine Command

**Type**: Feature - New Command
**Status**: Draft
**Created**: 2025-12-28

## Summary

Create a new `issue-refine` command for the work plugin that reviews GitHub issues and asks clarifying questions to ensure requirement clarity. This is a "frame phase" tool that focuses on **WHAT** (requirements) rather than **HOW** (architecture/implementation), bridging the gap between issue creation and architectural planning.

## Objectives

- Provide a lightweight requirements clarification tool for GitHub issues
- Ask 3-5 targeted questions focused on goals, scope, and acceptance criteria
- Support dual interaction: GitHub comments for documentation + CLI for immediate feedback
- Simplify requirements refinement compared to spec-refine (7 steps vs 11)
- Ensure issues are clear before moving to architect phase (spec-create/spec-refine)

## Use Case

**Typical Workflow**:
1. User creates issue: `/fractary-work:issue-create --title "Improve dashboard" --body "Make it better"`
2. Issue #123 created with vague requirements
3. User runs: `/fractary-work:issue-refine 123`
4. Agent analyzes issue, posts questions to GitHub, presents via AskUserQuestion
5. User answers questions interactively (e.g., "better" = faster load times + feature discoverability)
6. Agent updates issue with clarified requirements and acceptance criteria
7. Issue now ready for spec-create or implementation

## Architecture

### Pattern: Command → Agent (Simplified)

Unlike spec-refine which uses a 3-layer pattern (Command → Agent → Skill), issue-refine uses a simplified 2-layer approach:

```
Command: issue-refine.md
    ↓ (delegates via Task tool)
Agent: issue-refine.md
    ↓ (direct bash calls)
GitHub CLI (gh issue view/edit/comment)
```

**Rationale for Simplification**:
- Issue refinement is simpler than spec refinement
- No need for archival/versioning logic like specs
- Focus on requirements only (not architecture/implementation)
- Direct GitHub CLI integration sufficient
- Faster to implement and maintain

### Components

#### 1. Command File
**Location**: `/plugins/work/commands/fractary-faber-issue-refine.md`
**Size**: ~25 lines
**Purpose**: Entry point that delegates to agent

```yaml
---
name: fractary-work:issue-refine
description: Refine issue requirements through clarifying questions
allowed-tools: Task(fractary-work:issue-refine-agent)
model: claude-opus-4-6
argument-hint: '<number> [--prompt "<focus>"]'
---
```

#### 2. Agent File
**Location**: `/plugins/work/agents/fractary-faber-issue-refine.md`
**Size**: ~450-500 lines
**Purpose**: Main refinement logic
**Model**: claude-opus-4-6 (requires reasoning for question generation)
**Allowed Tools**: Bash(gh issue *), AskUserQuestion(*)

**Agent Structure**:
- `<CONTEXT>`: Role as requirements clarification agent
- `<CRITICAL_RULES>`: 6-7 key rules (fetch first, 3-5 questions, use AskUserQuestion, etc.)
- `<WORKFLOW>`: 7-step workflow
- `<QUESTION_FOCUS>`: What to ask (requirements only)
- `<QUESTION_QUALITY>`: Standards for good questions
- `<GITHUB_INTEGRATION>`: Comment posting formats
- `<ERROR_HANDLING>`: Common failure modes

#### 3. Plugin Manifest Update
**Location**: `/plugins/work/.claude-plugin/plugin.json`
**Change**: Add agent reference, bump version to 2.2.3

## Workflow (7 Steps)

### Step 1: Fetch Issue Data
- Parse arguments: issue number (required), --prompt (optional focus area)
- Execute: `gh issue view <number> --json number,title,body,labels,state,comments`
- Validate issue exists and is accessible

### Step 2: Analyze for Clarity Gaps
**Focus Areas** (Requirements Only):
- **Goals & Context**: What problem? For whom? Why now?
- **Scope Boundaries**: What's in/out of scope? Any constraints?
- **Acceptance Criteria**: How do we know when it's done?
- **Requirement Clarity**: Vague terms → specific behaviors, quantified metrics
- **User Experience**: What should users be able to do? Expected workflows?

**Explicitly SKIP** (Defer to Architect Phase):
- Technical approach questions
- Implementation details
- Technology/library choices
- Architecture decisions
- File structure
- Performance optimization strategies

### Step 3: Generate Clarifying Questions
**Quality Standards**:
- **Specific**: Reference exact phrases in issue
- **Actionable**: Answerable with concrete details
- **Requirement-focused**: WHAT not HOW
- **Explain WHY**: Help user understand importance
- **Limit**: 3-5 questions max (avoid user fatigue)

**Good Question Example**:
```
Q: The issue says "improve user experience" but doesn't specify which user journey.
   Is this for:
   - New user onboarding?
   - Daily workflow for existing users?
   - Admin/power user features?

   WHY: This affects which features to prioritize and how to measure success.
```

**Bad Question Example**:
```
Q: Should we use Redis or Memcached for caching?
   [Too technical - this is HOW not WHAT]
```

### Step 4: Post Questions to GitHub
Format as structured comment on the issue:

```markdown
## 🔍 Issue Refinement: Clarifying Questions

To ensure requirements are clear before implementation, please clarify:

### Questions

1. **[Topic]**: [Specific question with context]

   WHY: [Explanation of why this matters]

2. **[Topic]**: [Question]

   WHY: [Importance]

---
**Note**: Answer these questions in this thread or via the CLI. The refinement
process will continue with best-effort decisions for any unanswered questions.
```

Execute: `gh issue comment <number> --body "..."`

### Step 5: Present via AskUserQuestion (MANDATORY)
- Present same questions interactively via CLI
- Provide 2-4 common answer options when applicable
- Allow skip option for each question
- Allow custom text answers
- **CRITICAL**: User MUST be prompted before any changes to issue

### Step 6: Collect and Validate Answers
- Record which questions were answered
- Note skipped questions
- Validate answers make sense and are actionable

### Step 7: Update Issue with Improvements
Based on collected answers:
- Update issue body with clarified requirements
- Structure improvements: clear goals, scope, acceptance criteria
- For unanswered questions: make best-effort additions or note as TBD
- Execute: `gh issue edit <number> --body "<updated_body>"`
- Add label: `gh issue edit <number> --add-label "requirements-refined"`
- Post completion summary to GitHub

**Completion Summary Format**:
```markdown
## ✅ Issue Requirements Refined

The issue has been updated with clarified requirements.

**Changes applied:**
- Clarified goal: reduce dashboard load time from 5s to under 2s
- Added scope: data loading and feature discoverability (NOT visual redesign)
- Defined acceptance criteria: load time measurement, user testing

**Questions answered:** 3/5

<details>
<summary>Q&A Summary</summary>

**Q1**: What aspects of dashboard need improvement?
**A1**: Data loading speed and feature discoverability

**Q2**: What does "faster" mean specifically?
**A2**: Initial load under 2 seconds (currently 5s)

**Q3**: Who are the primary users?
**A3**: End customers viewing their data

**Q4**: What defines "done"?
**A4**: [Best-effort decision: Load time under 2s + user testing shows improvement]

**Q5**: Out of scope items?
**A5**: [Best-effort decision: Mobile responsiveness and visual redesign deferred]

</details>
```

## Question Categories

### Category 1: Goals & Context (WHY)
- What problem are we solving?
- Who is the target user/audience?
- What's the desired outcome?
- Why is this important now? What's driving this?

### Category 2: Scope Boundaries (WHAT'S IN/OUT)
- What features/changes are included?
- What's explicitly out of scope?
- Any constraints or dependencies?
- What are we NOT doing?

### Category 3: Acceptance Criteria (DONE = ?)
- How do we verify it's complete?
- What behaviors must work?
- What edge cases must be handled?
- What metrics define success?

### Category 4: Requirements Clarity (SPECIFICS)
- Clarify vague terms: "user-friendly" → specific behaviors
- Quantify metrics: "fast" → "under 2 seconds"
- Resolve ambiguities in descriptions
- Define unclear terminology

### Category 5: User Experience (USER PERSPECTIVE)
- What should users be able to do?
- What are the expected user workflows?
- What feedback/errors should users see?
- What's the user journey?

## Key Differences from spec-refine

| Aspect | spec-refine | issue-refine | Rationale |
|--------|-------------|--------------|-----------|
| **Workflow** | 11 steps | 7 steps | Simpler scope |
| **Architecture** | Command → Agent → Skill | Command → Agent | Less complexity needed |
| **Content** | Spec files (.md) | GitHub issues (API) | Different content type |
| **Focus** | Technical + requirements | Requirements only | Frame vs architect phase |
| **Rounds** | Multiple iterations | Single round | Can re-run if needed |
| **Changelog** | Added to spec file | Issue edit history | Git history sufficient |
| **Questions** | Architecture + requirements | Requirements only | Phase separation |
| **Skill Layer** | Uses spec-refiner skill | Direct in agent | Simplified architecture |
| **GitHub Posting** | Questions + summary | Questions + summary | Same (documentation) |
| **Size** | ~412 lines (agent + skill) | ~500 lines (agent only) | Similar total |

## Implementation Plan

### Phase 1: Create Command File
- [ ] Create `/plugins/work/commands/fractary-faber-issue-refine.md`
- [ ] Define frontmatter with name, description, allowed-tools, model, argument-hint
- [ ] Add Task tool delegation pattern
- [ ] Follow existing command conventions from issue-create

### Phase 2: Create Agent File
- [ ] Create `/plugins/work/agents/fractary-faber-issue-refine.md`
- [ ] Define frontmatter and agent metadata
- [ ] Document 7-step workflow with implementation details
- [ ] Define question focus areas (requirements categories)
- [ ] Implement question quality standards
- [ ] Add GitHub integration formats (questions + completion)
- [ ] Define error handling patterns
- [ ] Add usage examples

### Phase 3: Update Plugin Manifest
- [ ] Update `/plugins/work/.claude-plugin/plugin.json`
- [ ] Add `./agents/fractary-faber-issue-refine.md` to agents array
- [ ] Increment version from 2.2.2 to 2.2.3
- [ ] Verify JSON syntax

### Phase 4: Testing
- [ ] Test basic flow: fetch → analyze → question → update
- [ ] Test with all questions answered
- [ ] Test with partial answers (best-effort for remaining)
- [ ] Test with no answers (all best-effort)
- [ ] Test error cases: issue not found, invalid number, auth failure
- [ ] Verify only requirements questions asked (no technical/architectural)
- [ ] Verify GitHub comments posted correctly
- [ ] Verify issue body updated correctly
- [ ] Verify label added correctly

### Phase 5: Documentation
- [ ] Add usage example to work plugin README
- [ ] Document difference from spec-refine (when to use which)
- [ ] Add to command reference documentation
- [ ] Document --prompt flag usage for focused refinement

## Files Summary

**New Files** (2):
- `/plugins/work/commands/fractary-faber-issue-refine.md` (~25 lines)
- `/plugins/work/agents/fractary-faber-issue-refine.md` (~450-500 lines)

**Modified Files** (1):
- `/plugins/work/.claude-plugin/plugin.json` (add agent, bump version)

**Reference Files** (for implementation):
- `/plugins/spec/agents/fractary-faber-spec-refine.md` - Workflow pattern
- `/plugins/spec/commands/fractary-faber-refine.md` - Command delegation pattern
- `/plugins/work/commands/fractary-faber-issue-create.md` - GitHub CLI usage
- `/plugins/work/commands/fractary-faber-issue-fetch.md` - Issue data fetching

**Total New Code**: ~500-550 lines

## Acceptance Criteria

- [ ] Command `/fractary-work:issue-refine <number>` successfully executes
- [ ] Agent fetches issue data via `gh issue view`
- [ ] Agent generates 3-5 requirements-focused questions
- [ ] Questions posted to GitHub issue as comment
- [ ] Questions presented interactively via AskUserQuestion
- [ ] User can answer all, some, or none of the questions
- [ ] Agent updates issue body with clarified requirements
- [ ] Agent adds "requirements-refined" label to issue
- [ ] Agent posts completion summary to GitHub
- [ ] No technical/architectural questions asked (requirements only)
- [ ] Single round operation (can be re-run manually if needed)
- [ ] Error handling for: issue not found, auth failure, invalid input

## Dependencies

**Required**:
- GitHub CLI (`gh`) installed and authenticated
- Work plugin infrastructure (commands/, agents/ directories)
- Opus 4.5 model access (for question generation reasoning)

**Optional**:
- GitHub issue to refine (created via issue-create or manually)

## Risks & Mitigations

### Risk 1: Agent Asks Technical Questions
**Impact**: Medium - Violates requirements-only focus
**Mitigation**: Clear instructions in agent, explicit examples of what NOT to ask
**Fallback**: User can skip technical questions, re-run after fixing agent

### Risk 2: Too Many Questions Generated
**Impact**: Low - User fatigue, poor experience
**Mitigation**: Hard limit of 5 questions in agent rules
**Fallback**: Prioritize highest-impact clarifications only

### Risk 3: Issue Already Well-Defined
**Impact**: Low - Unnecessary overhead
**Mitigation**: Agent should detect and skip refinement if clear
**Response**: "Issue requirements are already clear - no refinement needed"

### Risk 4: User Confusion with spec-refine
**Impact**: Medium - Users unsure which to use
**Mitigation**: Clear documentation on when to use each
**Guidance**: issue-refine = requirements (WHAT), spec-refine = architecture (HOW)

### Risk 5: GitHub API Rate Limits
**Impact**: Low - Operation failure
**Mitigation**: gh CLI handles auth and retries automatically
**Fallback**: Graceful error message with retry suggestion

## Future Enhancements

**Out of Scope for v1**:
- Multi-round refinement (can re-run command instead)
- Integration with Linear/Jira (GitHub only for now)
- Automated requirement extraction from conversation
- AI-suggested improvements without questions
- Refinement templates by issue type
- Analytics on refinement effectiveness

**Potential v2 Features**:
- `--template` flag for issue-type-specific question sets
- `--rounds` flag for multi-round refinement
- Integration with spec-create to auto-generate spec after refinement
- Refinement quality scoring
- Team-specific question libraries

## Example Usage

### Scenario: Vague Feature Request

```bash
# Step 1: User creates vague issue
$ /fractary-work:issue-create \
  --title "Improve dashboard" \
  --body "Make the dashboard better and faster for users"

✓ Issue created: #123

# Step 2: Run refinement
$ /fractary-work:issue-refine 123

# Agent analyzes and posts to GitHub
🔍 Posted 4 clarifying questions to issue #123

# Agent presents questions interactively
Question 1: What specific aspects of the dashboard need improvement?
  1. Visual design/layout
  2. Data loading speed
  3. Feature discoverability
  4. Mobile responsiveness
  > Your answer: 2, 3

Question 2: What does "faster" mean specifically?
  1. Initial load time (currently 5s → target 2s)
  2. Real-time data updates
  3. Interaction responsiveness
  > Your answer: 1

Question 3: Who are the primary users of this dashboard?
  1. End customers viewing their data
  2. Internal team members
  3. Administrators
  > Your answer: 1

Question 4: What defines "done" for this improvement?
  > Your answer: [skipped]

# Agent updates issue #123
✓ Updated issue with clarified requirements
✓ Added label: requirements-refined
✓ Posted completion summary

# Step 3: Review updated issue
$ gh issue view 123

Title: Improve Dashboard Data Loading and Feature Discoverability

Goal: Improve dashboard for end customers by reducing load times and
      making features more discoverable.

Specific Improvements:
- Reduce initial load time from 5s to under 2s
- Improve feature discoverability for key functionality

Acceptance Criteria:
- [ ] Dashboard loads in under 2 seconds (measured at P95)
- [ ] Key features prominently visible without scrolling
- [ ] User testing shows improved discoverability (survey: 8/10+)

Out of Scope:
- Mobile responsiveness (separate issue)
- Visual redesign (separate issue)
- Real-time updates (future enhancement)

# Issue now ready for spec-create or implementation!
```

## Success Metrics

**Qualitative**:
- Issues refined have clear goals, scope, and acceptance criteria
- Reduced back-and-forth during implementation phase
- Improved spec quality when created from refined issues
- Team confidence in issue clarity

**Quantitative**:
- 80%+ of refined issues have defined acceptance criteria
- 3-5 questions asked per refinement
- 60%+ question answer rate
- Single round sufficient for 90%+ of issues

## Related Work

**Similar Tools**:
- `/fractary-spec:refine` - Architectural refinement (more in-depth, technical focus)
- `/fractary-work:issue-create` - Issue creation (no refinement)
- `/fractary-spec:create` - Spec creation from issue (architecture focus)

**Workflow Integration**:
```
Frame Phase (Requirements):
  issue-create → issue-refine → [requirements clear]

Architect Phase (Technical):
  spec-create → spec-refine → [architecture clear]

Implement Phase:
  [code implementation using refined issue + spec]
```

## Notes

- Single round by design - keeps it simple, can re-run if needed
- No changelog in issue - edit history provides audit trail
- Both GitHub + CLI interaction for maximum utility
- Opus model needed for quality question generation
- Can be used standalone or as prep for spec-create
