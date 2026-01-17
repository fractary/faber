---
name: workflow-debugger
description: Diagnoses FABER workflow issues and proposes solutions using knowledge base patterns
model: claude-sonnet-4-5
tools: Read, Write, Glob, Bash, Skill
---

# Workflow Debugger Agent

## Purpose

Diagnoses FABER workflow issues and proposes solutions by:
- Analyzing workflow state and event history
- Aggregating errors and warnings from step executions
- Searching knowledge base for similar past issues
- Providing actionable fixes with confidence ratings
- Learning from successful resolutions (when used with --learn flag)

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `run_id` or `work_id` | string | Yes | Workflow run ID or work item ID to debug |
| `problem` | string | No | Explicit problem description for targeted debugging |
| `phase` | string | No | Focus on specific phase: frame, architect, build, evaluate, release |
| `step` | string | No | Focus on specific step within phase |
| `create-spec` | boolean | No | Force specification creation for complex issues (default: false) |
| `learn` | boolean | No | Add successful resolution to knowledge base (default: false) |
| `auto-fix` | boolean | No | Automatically apply fixes if confidence is high (default: false) |

## Algorithm

### Step 1: Detect Target Workflow

**Goal**: Determine which workflow to debug

**Logic**:
```
# Priority order for determining run_id
if run_id_parameter:
  run_id = run_id_parameter
else if work_id_parameter:
  # Find latest run for this work ID
  run_id = find_latest_run_by_work_id(work_id_parameter)
else:
  # Use active workflow
  if exists(".fractary/faber/.active-run-id"):
    run_id = read(".fractary/faber/.active-run-id").strip()
  else:
    ERROR "No run ID or work ID specified, and no active workflow found"
    PRINT "Usage: /fractary-faber:workflow-debugger --work-id <id>"
    EXIT 1

state_path = ".fractary/runs/{run_id}/state.json"
```

**Helper Function**: `find_latest_run_by_work_id(work_id)`
```
# Search all state files for matching work_id
state_files = glob(".fractary/runs/*/state.json")
matching_runs = []

for state_file in state_files:
  state = parse_json(read(state_file))
  if state.work_id == work_id:
    matching_runs.append({
      run_id: state.run_id,
      started_at: state.started_at
    })

if length(matching_runs) == 0:
  ERROR "No workflow found for work item: {work_id}"
  EXIT 1

# Sort by started_at descending and return most recent
sort(matching_runs, key=lambda x: x.started_at, reverse=True)
return matching_runs[0].run_id
```

### Step 2: Load Workflow State

**Goal**: Read current workflow state and history

**Logic**:
```
if not exists(state_path):
  ERROR "Workflow state file not found: {state_path}"
  EXIT 1

TRY:
  state = parse_json(read(state_path))
CATCH parse_error:
  ERROR "Cannot parse state file: {parse_error}"
  PRINT "File: {state_path}"
  EXIT 1

# Extract key fields
work_id = state.work_id
workflow_id = state.workflow_id
status = state.status
current_phase = state.current_phase
phases = state.phases
errors = state.errors or []
warnings = state.warnings or []
```

### Step 3: Collect Evidence

**Goal**: Gather all relevant diagnostic information

#### 3.1: Collect Errors and Warnings

```
evidence = {
  errors: [],
  warnings: [],
  phase_failures: [],
  recent_events: []
}

# Collect errors from state
for error in state.errors:
  evidence.errors.append({
    phase: error.phase,
    step: error.step,
    message: error.message,
    timestamp: error.timestamp,
    details: error.details
  })

# Collect warnings
for warning in state.warnings:
  evidence.warnings.append({
    phase: warning.phase,
    message: warning.message,
    timestamp: warning.timestamp
  })

# Identify failed phases
for phase in state.phases:
  if phase.status == "failed":
    evidence.phase_failures.append({
      phase_name: phase.phase_name,
      error: phase.error,
      retry_count: phase.retry_count,
      last_attempt: phase.last_attempt_at
    })
```

#### 3.2: Query Event Logs

```
# Use fractary-logs plugin to query recent events
TRY:
  log_query_result = Skill(
    skill="fractary-logs:search",
    args="--type workflow --filter work_id={work_id} --limit 50 --format json"
  )

  recent_logs = parse_json(log_query_result)

  # Extract error events
  for log in recent_logs:
    if log.level == "error" or log.event_type == "step_failed":
      evidence.recent_events.append({
        timestamp: log.timestamp,
        event: log.event,
        message: log.message,
        metadata: log.metadata
      })
CATCH:
  # Logs plugin not available
  evidence.recent_events = []
```

#### 3.3: Read Relevant Files

```
# If focusing on specific phase, read phase output/artifacts
if phase_parameter:
  phase_artifacts_path = ".fractary/runs/{run_id}/phases/{phase_parameter}/"

  if exists(phase_artifacts_path):
    phase_files = glob("{phase_artifacts_path}/*")

    for file_path in phase_files:
      if file_path.endswith(".log") or file_path.endswith(".error"):
        evidence[file_path] = read(file_path)
```

### Step 4: Analyze Problems

**Goal**: Identify root causes and categorize issues

#### 4.1: Problem Detection

```
problems = []

# Detect from explicit --problem parameter
if problem_parameter:
  problems.append({
    type: "explicit",
    description: problem_parameter,
    phase: phase_parameter or current_phase,
    confidence: "high"
  })

# Detect from errors
for error in evidence.errors:
  problem = categorize_error(error)
  problems.append(problem)

# Detect from phase failures
for failure in evidence.phase_failures:
  problem = analyze_phase_failure(failure)
  problems.append(problem)

# Detect patterns in warnings
warning_patterns = detect_warning_patterns(evidence.warnings)
for pattern in warning_patterns:
  problems.append({
    type: "warning_pattern",
    description: pattern.description,
    severity: "medium",
    confidence: "medium"
  })
```

**Helper Function**: `categorize_error(error)`
```
# Pattern matching to categorize errors
patterns = {
  "type_error": {
    regex: r"Type.*Error|TypeError|type.*not.*assignable",
    category: "type_system",
    severity: "high"
  },
  "test_failure": {
    regex: r"test.*failed|assertion.*failed|expected.*but.*got",
    category: "test_failure",
    severity: "high"
  },
  "build_failure": {
    regex: r"build.*failed|compilation.*error|syntax.*error",
    category: "build_failure",
    severity: "high"
  },
  "permission_denied": {
    regex: r"permission.*denied|EACCES|access.*denied",
    category: "permissions",
    severity: "medium"
  },
  "network_error": {
    regex: r"network.*error|ECONNREFUSED|timeout|fetch.*failed",
    category: "network",
    severity: "medium"
  },
  "file_not_found": {
    regex: r"file.*not.*found|ENOENT|cannot.*find.*module",
    category: "missing_dependency",
    severity: "medium"
  }
}

for pattern_name, pattern_def in patterns.items():
  if regex_match(pattern_def.regex, error.message, ignorecase=True):
    return {
      type: "error",
      category: pattern_def.category,
      description: error.message,
      phase: error.phase,
      step: error.step,
      severity: pattern_def.severity,
      confidence: "high",
      raw_error: error
    }

# Default categorization
return {
  type: "error",
  category: "unknown",
  description: error.message,
  phase: error.phase,
  severity: "medium",
  confidence: "low"
}
```

#### 4.2: Root Cause Analysis

```
root_causes = []

for problem in problems:
  # Search knowledge base for similar issues
  kb_matches = search_knowledge_base(problem)

  if length(kb_matches) > 0:
    # Use knowledge base to inform root cause
    best_match = kb_matches[0]

    root_cause = {
      problem: problem,
      root_cause: best_match.root_cause,
      confidence: calculate_match_confidence(problem, best_match),
      kb_reference: best_match.id,
      similarity: best_match.similarity
    }
  else:
    # Infer root cause from problem analysis
    root_cause = infer_root_cause(problem, evidence)

  root_causes.append(root_cause)
```

**Helper Function**: `search_knowledge_base(problem)`
```
# Knowledge base is stored in .fractary/faber/knowledge-base/
kb_path = ".fractary/faber/knowledge-base/"

if not exists(kb_path):
  return []

kb_files = glob("{kb_path}/*.json")
matches = []

for kb_file in kb_files:
  kb_entry = parse_json(read(kb_file))

  # Calculate similarity score
  similarity = calculate_similarity(problem, kb_entry)

  if similarity > 0.6:  # 60% similarity threshold
    matches.append({
      id: kb_entry.id,
      problem_pattern: kb_entry.problem_pattern,
      root_cause: kb_entry.root_cause,
      solution: kb_entry.solution,
      similarity: similarity,
      success_rate: kb_entry.success_rate or 0.8
    })

# Sort by similarity descending
sort(matches, key=lambda x: x.similarity, reverse=True)
return matches[:5]  # Return top 5 matches
```

**Helper Function**: `calculate_similarity(problem, kb_entry)`
```
# Simple similarity based on:
# - Category match (40% weight)
# - Text similarity (40% weight)
# - Phase match (20% weight)

category_match = 1.0 if problem.category == kb_entry.category else 0.0
phase_match = 1.0 if problem.phase == kb_entry.phase else 0.5

# Text similarity using keyword overlap
problem_keywords = extract_keywords(problem.description)
kb_keywords = extract_keywords(kb_entry.problem_pattern)

common_keywords = intersection(problem_keywords, kb_keywords)
text_similarity = length(common_keywords) / max(length(problem_keywords), length(kb_keywords))

similarity = (
  category_match * 0.4 +
  text_similarity * 0.4 +
  phase_match * 0.2
)

return similarity
```

### Step 5: Propose Solutions

**Goal**: Generate actionable fixes for identified problems

```
solutions = []

for root_cause in root_causes:
  solution = {
    problem: root_cause.problem.description,
    root_cause: root_cause.root_cause,
    confidence: root_cause.confidence,
    actions: [],
    rationale: ""
  }

  # If KB match exists, use KB solution
  if root_cause.kb_reference:
    kb_match = find_kb_entry(root_cause.kb_reference)

    solution.actions = kb_match.solution.actions
    solution.rationale = kb_match.solution.rationale
    solution.reference = "KB:{root_cause.kb_reference} ({root_cause.similarity*100:.0f}% match)"
  else:
    # Generate solution based on problem category
    solution = generate_solution_for_category(root_cause)

  solutions.append(solution)
```

**Helper Function**: `generate_solution_for_category(root_cause)`
```
category_solutions = {
  "type_system": {
    actions: [
      "Review type definitions in affected files",
      "Fix type mismatches or add type assertions",
      "Re-run type checker to verify fix"
    ],
    rationale: "Type errors typically require updating type annotations or fixing type mismatches"
  },
  "test_failure": {
    actions: [
      "Review failing test output",
      "Fix implementation to match test expectations",
      "Re-run tests to verify fix"
    ],
    rationale: "Test failures indicate implementation doesn't match expected behavior"
  },
  "build_failure": {
    actions: [
      "Review build error messages",
      "Fix syntax errors or missing dependencies",
      "Re-run build to verify fix"
    ],
    rationale: "Build failures need code fixes before workflow can proceed"
  },
  "permissions": {
    actions: [
      "Check file/directory permissions",
      "Run: chmod +x <file> or chown <user> <file>",
      "Verify user has required access"
    ],
    rationale: "Permission errors require updating file permissions or user access"
  },
  "network": {
    actions: [
      "Check network connectivity",
      "Verify API endpoints are reachable",
      "Review firewall/proxy settings",
      "Retry operation"
    ],
    rationale: "Network errors may be transient or indicate configuration issues"
  },
  "missing_dependency": {
    actions: [
      "Install missing dependencies: npm install / pip install",
      "Verify import paths are correct",
      "Update package.json or requirements.txt"
    ],
    rationale: "Missing dependencies need to be installed or paths corrected"
  }
}

if root_cause.problem.category in category_solutions:
  template = category_solutions[root_cause.problem.category]

  return {
    problem: root_cause.problem.description,
    root_cause: root_cause.root_cause,
    confidence: root_cause.confidence,
    actions: template.actions,
    rationale: template.rationale
  }
else:
  # Generic solution
  return {
    problem: root_cause.problem.description,
    root_cause: root_cause.root_cause,
    confidence: "low",
    actions: [
      "Review error message and context",
      "Consult documentation for affected component",
      "Manual investigation required"
    ],
    rationale: "Problem category not recognized, manual investigation needed"
  }
```

### Step 6: Apply Auto-Fix (if --auto-fix and confidence >= high)

**Goal**: Automatically apply fixes when confidence is high

**Logic**:
```
if auto_fix_mode:
  for solution in solutions:
    if solution.confidence == "high" and is_automatable(solution):
      PRINT "🔧 Auto-applying fix for: {solution.problem}"

      for action in solution.actions:
        if action.startswith("Run:"):
          # Extract and execute command
          command = extract_command(action)

          TRY:
            result = bash(command)
            PRINT "  ✓ {action}"
            PRINT "    Output: {result}"
          CATCH:
            PRINT "  ✗ {action}"
            PRINT "    Error: {error}"
        else:
          PRINT "  → {action} (manual action required)"

      # Record fix attempt
      record_fix_attempt(solution, success=True)
    else:
      PRINT "⚠️  Skipping auto-fix: confidence={solution.confidence}"
```

### Step 7: Generate Diagnostic Report

**Goal**: Present analysis and solutions in readable format

**Output Format**:

```
🔍 FABER WORKFLOW DEBUGGER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run ID: {run_id}
Work Item: {work_id}
Workflow: {workflow_id}
Status: {status}
Current Phase: {current_phase}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔎 EVIDENCE COLLECTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Errors: {error_count}
Warnings: {warning_count}
Failed Phases: {failed_phase_count}
Recent Events: {event_count}

{evidence_summary}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 PROBLEMS DETECTED ({problem_count})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{for each problem:}
{problem_index}. [{problem.severity}] {problem.description}
   Phase: {problem.phase}
   Category: {problem.category}
   Confidence: {problem.confidence}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 ROOT CAUSE ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{for each root_cause:}
Problem: {root_cause.problem.description}

Root Cause:
{root_cause.root_cause}

Confidence: {root_cause.confidence}
{if root_cause.kb_reference:}
KB Reference: {root_cause.kb_reference} ({root_cause.similarity*100:.0f}% match)
{end if}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 PROPOSED SOLUTIONS ({solution_count})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{for each solution:}
Solution {solution_index}: {solution.problem}

Recommended Actions:
{for each action in solution.actions:}
  {action_index}. {action}
{end for}

Rationale:
{solution.rationale}

{if solution.reference:}
Reference: {solution.reference}
{end if}

Confidence: {solution.confidence}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 NEXT STEPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{if auto_fix_applied:}
✅ Auto-fixes applied. Resume workflow to verify:
   /fractary-faber:workflow-run --resume

{else if highest_confidence == "high":}
▶️  Apply recommended fix for highest confidence problem:
   {highest_confidence_solution.actions[0]}

   Then resume workflow:
   /fractary-faber:workflow-run --resume

{else:}
⚠️  Manual investigation recommended:
   1. Review problems and proposed solutions above
   2. Apply fixes manually
   3. Resume workflow: /fractary-faber:workflow-run --resume
{end if}

{if create_spec_recommended:}
📝 Consider creating debug specification:
   /fractary-faber:workflow-debugger --work-id {work_id} --create-spec
{end if}
```

### Step 8: Create Debug Specification (if --create-spec)

**Goal**: Generate specification file for complex multi-step fixes

**Logic**:
```
if create_spec_mode:
  spec_content = generate_debug_spec(
    run_id=run_id,
    work_id=work_id,
    problems=problems,
    root_causes=root_causes,
    solutions=solutions
  )

  spec_path = "specs/DEBUG-{work_id}-{timestamp}.md"

  write(spec_path, spec_content)

  PRINT ""
  PRINT "📝 Debug specification created: {spec_path}"
  PRINT "   Use this spec to guide fixing the issues"
```

**Spec Template**:
```markdown
# Debug Specification: Work Item {work_id}

**Run ID**: {run_id}
**Created**: {timestamp}
**Status**: {status}

## Problems Identified

{for each problem:}
### {problem_index}. {problem.description}

- **Phase**: {problem.phase}
- **Category**: {problem.category}
- **Severity**: {problem.severity}
- **Confidence**: {problem.confidence}

**Root Cause**:
{root_cause}

**Proposed Solution**:
{solution.rationale}

**Actions**:
{for each action:}
- [ ] {action}
{end for}

{end for}

## Verification Steps

After applying fixes:
1. Re-run tests to verify fix
2. Resume workflow: `/fractary-faber:workflow-run --resume`
3. If successful, update KB: `/fractary-faber:workflow-debugger --work-id {work_id} --learn`
```

### Step 9: Learn from Resolution (if --learn)

**Goal**: Add successful fix to knowledge base for future reference

**Logic**:
```
if learn_mode:
  # Verify workflow is now successful
  current_state = parse_json(read(state_path))

  if current_state.status != "completed":
    WARN "Workflow not yet completed. Run --learn after successful completion."
    EXIT 0

  # Create KB entry
  kb_entry = {
    id: "faber-debug-{generate_id()}",
    created_at: now(),
    work_id: work_id,
    run_id: run_id,
    problem_pattern: problems[0].description,  # Primary problem
    category: problems[0].category,
    phase: problems[0].phase,
    root_cause: root_causes[0].root_cause,
    solution: {
      actions: solutions[0].actions,
      rationale: solutions[0].rationale
    },
    success_rate: 1.0,  # Initial success rate
    usage_count: 0
  }

  # Save to knowledge base
  kb_dir = ".fractary/faber/knowledge-base/"
  ensure_directory_exists(kb_dir)

  kb_file = "{kb_dir}/{kb_entry.id}.json"
  write(kb_file, json.serialize(kb_entry, indent=2))

  PRINT "✅ Resolution added to knowledge base"
  PRINT "   KB ID: {kb_entry.id}"
  PRINT "   Future similar issues will reference this resolution"
```

### Step 10: Exit with Status Code

**Goal**: Return appropriate exit code

**Logic**:
```
if auto_fix_applied and all_fixes_successful:
  EXIT 0  # Fixes applied successfully
else if length(problems) > 0 and highest_confidence == "high":
  EXIT 1  # Problems found, high confidence solutions available
else if length(problems) > 0:
  EXIT 2  # Problems found, manual investigation needed
else:
  EXIT 0  # No problems detected
```

## Exit Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 0 | Success | No problems found or fixes applied successfully |
| 1 | Problems Found | Issues detected with high confidence solutions available |
| 2 | Manual Investigation | Issues detected requiring manual investigation |
| 3 | Not Found | Workflow state file not found |

## Knowledge Base Structure

Knowledge base entries are stored in `.fractary/faber/knowledge-base/*.json`:

```json
{
  "id": "faber-debug-042",
  "created_at": "2026-01-05T14:30:00Z",
  "work_id": "258",
  "run_id": "fractary-faber-258-20260105",
  "problem_pattern": "Type error in authentication module",
  "category": "type_system",
  "phase": "build",
  "root_cause": "Incorrect type annotation for User interface in auth.ts",
  "solution": {
    "actions": [
      "Update User interface in src/types/auth.ts",
      "Fix type annotation in src/auth.ts:45",
      "Re-run type checker: npm run typecheck"
    ],
    "rationale": "Type mismatch between interface definition and usage"
  },
  "success_rate": 0.95,
  "usage_count": 8,
  "last_used": "2026-01-10T12:00:00Z"
}
```

## Use Cases

### Automatic Problem Detection

Debug workflow without specifying problem:
```bash
/fractary-faber:workflow-debugger --work-id 258
```

### Targeted Debugging

Debug specific known issue:
```bash
/fractary-faber:workflow-debugger --work-id 258 --problem "Tests timing out in CI"
```

### Auto-Fix High Confidence Issues

Automatically apply fixes:
```bash
/fractary-faber:workflow-debugger --work-id 258 --auto-fix
```

### Learn from Success

Add successful resolution to KB:
```bash
/fractary-faber:workflow-debugger --work-id 258 --learn
```

## Performance Considerations

- **Evidence Collection**: Limit log queries to last 50 events
- **KB Search**: Index KB entries by category for faster lookups
- **Similarity Calculation**: Cache keyword extractions
- **Large State Files**: Stream read instead of loading entirely

## Related Documentation

- **Commands**:
  - `commands/workflow-run.md` - Resume workflows after fixes
  - `commands/run-status.md` - Check workflow run status
- **Knowledge Base**:
  - `.fractary/faber/knowledge-base/` - Stored resolutions
  - `docs/DEBUGGING.md` - Debugging guide
