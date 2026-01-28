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
- Searching knowledge base for similar past issues (supports both markdown and JSON formats)
- Providing actionable fixes with confidence ratings
- Learning from successful resolutions (automatic with `--auto-learn` or manual with `--learn`)
- Escalating to GitHub issues after repeated failures (with `--escalate`)

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `run_id` or `work_id` | string | Yes | Workflow run ID or work item ID to debug |
| `problem` | string | No | Explicit problem description for targeted debugging |
| `phase` | string | No | Focus on specific phase: frame, architect, build, evaluate, release |
| `step` | string | No | Focus on specific step within phase |
| `agent` | string | No | Agent name for context (used with onFailure hooks) |
| `create-spec` | boolean | No | Force specification creation for complex issues (default: false) |
| `learn` | boolean | No | Add successful resolution to knowledge base (default: false) |
| `auto-fix` | boolean | No | Automatically apply fixes if confidence is high (default: false) |
| `auto-learn` | boolean | No | Automatically log verified solutions to KB (default: false) |
| `escalate` | boolean | No | Create GitHub issue if max retries exceeded (default: false) |
| `max-retries` | number | No | Maximum retry attempts before escalation (default: 3) |
| `retry-count` | number | No | Current retry count (passed from workflow onFailure hook) |

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
# Use knowledge-aggregator skill to search all KB sources
# This searches both core and plugin knowledge bases
TRY:
  aggregated_results = Skill(
    skill="fractary-faber:knowledge-aggregator",
    args="--category {problem.category} --phase {problem.phase}"
  )
  kb_entries = parse_json(aggregated_results)
CATCH:
  # Fallback to direct KB search if aggregator not available
  kb_entries = search_local_knowledge_base(problem)

matches = []

for kb_entry in kb_entries:
  # Calculate similarity score
  similarity = calculate_similarity(problem, kb_entry)

  if similarity > 0.6:  # 60% similarity threshold
    matches.append({
      id: kb_entry.id,
      problem_pattern: kb_entry.problem_pattern or kb_entry.title,
      root_cause: kb_entry.root_cause,
      solution: kb_entry.solution,
      similarity: similarity,
      success_rate: kb_entry.success_rate or kb_entry.success_count / 10 or 0.8,
      source: kb_entry.source  # "core" or plugin name
    })

# Sort by similarity descending
sort(matches, key=lambda x: x.similarity, reverse=True)
return matches[:5]  # Return top 5 matches
```

**Helper Function**: `search_local_knowledge_base(problem)`
```
# Knowledge base can be markdown (new format) or JSON (legacy)
kb_path = ".fractary/faber/knowledge-base/"

if not exists(kb_path):
  return []

# Define allowed base paths for path traversal protection
allowed_base_paths = [
  ".fractary/faber/knowledge-base/",
  ".fractary/plugins/"
]

# Search both markdown and JSON files
kb_files_md = glob("{kb_path}/**/*.md")
kb_files_json = glob("{kb_path}/*.json")
entries = []

# Parse markdown files (new format with YAML front matter)
for kb_file in kb_files_md:
  # Validate path before reading (prevents path traversal)
  if not validate_kb_file_path(kb_file, allowed_base_paths):
    WARN "Skipping invalid KB file path: {kb_file}"
    continue

  TRY:
    kb_entry = parse_markdown_kb_entry(read(kb_file))
    if kb_entry != null:  # parse_markdown_kb_entry returns null on error
      kb_entry.source = "core"
      entries.append(kb_entry)
  CATCH file_error:
    WARN "Failed to read KB file {kb_file}: {file_error}"
    # Continue processing other files

# Parse JSON files (legacy format)
for kb_file in kb_files_json:
  # Validate path before reading (prevents path traversal)
  if not validate_kb_file_path(kb_file, allowed_base_paths):
    WARN "Skipping invalid KB file path: {kb_file}"
    continue

  TRY:
    kb_entry = parse_json(read(kb_file))
    kb_entry.source = "core"
    entries.append(kb_entry)
  CATCH json_error:
    WARN "Failed to parse JSON KB file {kb_file}: {json_error}"
    # Continue processing other files

return entries
```

**Helper Function**: `parse_markdown_kb_entry(content)`
```
# Parse markdown file with YAML front matter
# Expected format:
# ---
# id: KB-build-001
# title: TypeScript module resolution failure
# phase: build
# step: implement
# agent: agent-engineer
# category: missing_dependency
# severity: medium
# symptoms:
#   - "Cannot find module"
#   - "TS2307: Cannot find module"
# tags:
#   - typescript
#   - imports
# created: 2026-01-28
# verified: true
# success_count: 12
# ---
#
# # Title
# ## Symptoms
# ## Root Cause
# ## Solution
# ## Prevention

# Extract YAML front matter
front_matter_match = regex_match(r"^---\n(.*?)\n---\n(.*)$", content, flags=DOTALL)

if not front_matter_match:
  ERROR "Invalid KB entry format: missing YAML front matter"
  return null

yaml_content = front_matter_match.group(1)
markdown_body = front_matter_match.group(2)

# Parse YAML front matter with error handling
TRY:
  metadata = parse_yaml(yaml_content)
CATCH yaml_error:
  WARN "Failed to parse YAML front matter: {yaml_error}"
  WARN "File may be malformed, skipping entry"
  return null

# Validate required fields
if not metadata.id or not metadata.title:
  WARN "KB entry missing required fields (id, title), skipping"
  return null

# Extract sections from markdown body
sections = parse_markdown_sections(markdown_body)

return {
  id: metadata.id,
  title: metadata.title,
  problem_pattern: metadata.title,
  phase: metadata.phase,
  step: metadata.step,
  agent: metadata.agent,
  category: metadata.category,
  severity: metadata.severity,
  symptoms: metadata.symptoms or [],
  tags: metadata.tags or [],
  created: metadata.created,
  verified: metadata.verified or false,
  success_count: metadata.success_count or 0,
  root_cause: sections["Root Cause"] or "",
  solution: {
    description: sections["Solution"] or "",
    actions: extract_actions_from_markdown(sections["Solution"])
  },
  prevention: sections["Prevention"] or ""
}
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
  fix_applied_successfully = false

  for solution in solutions:
    if solution.confidence == "high" and is_automatable(solution):
      PRINT "🔧 Auto-applying fix for: {solution.problem}"

      all_actions_succeeded = true
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
            all_actions_succeeded = false
        else:
          PRINT "  → {action} (manual action required)"

      # Record fix attempt
      record_fix_attempt(solution, success=all_actions_succeeded)

      if all_actions_succeeded:
        # Verify the fix actually resolved the problem
        PRINT "🔍 Verifying fix..."
        verification_result = verify_fix_resolved_problem(solution, evidence)

        if verification_result.resolved:
          fix_applied_successfully = true
          PRINT "✅ Verification passed: problem resolved"

          # Auto-learn: automatically add verified solution to KB
          if auto_learn_mode:
            TRY:
              kb_entry_id = create_kb_entry_markdown(
                problem=solution.problem,
                category=problems[0].category,
                phase=problems[0].phase,
                step=step_parameter or "unknown",
                agent=agent_parameter or "unknown",
                root_cause=solution.root_cause,
                solution=solution,
                verification_result="auto-verified"
              )
              PRINT "✅ Solution auto-logged to knowledge base (ID: {kb_entry_id})"
            CATCH kb_error:
              WARN "⚠️  Failed to log solution to knowledge base: {kb_error}"
              WARN "   Solution was applied successfully but KB entry was not created"
              # Don't fail the overall operation - the fix worked, just logging failed
        else:
          PRINT "⚠️  Commands ran but verification failed: {verification_result.reason}"
          PRINT "   Problem may not be fully resolved"
    else:
      PRINT "⚠️  Skipping auto-fix: confidence={solution.confidence}"
```

**Helper Function**: `verify_fix_resolved_problem(solution, evidence)`
```
# Verify that the fix actually resolved the problem
# Run a quick validation based on the problem category

verification = { resolved: false, reason: "" }

category = solution.category or "unknown"

if category == "build_failure":
  # Re-run build to verify
  TRY:
    result = bash("npm run build 2>&1 || true")
    if "error" not in result.lower() and "failed" not in result.lower():
      verification.resolved = true
    else:
      verification.reason = "Build still showing errors"
  CATCH:
    verification.reason = "Could not verify build"

elif category == "test_failure":
  # Re-run affected tests
  TRY:
    result = bash("npm test 2>&1 || true")
    if "pass" in result.lower() or "0 failed" in result:
      verification.resolved = true
    else:
      verification.reason = "Tests still failing"
  CATCH:
    verification.reason = "Could not run tests"

elif category == "type_system":
  # Re-run type check
  TRY:
    result = bash("npm run typecheck 2>&1 || npx tsc --noEmit 2>&1 || true")
    if "error" not in result.lower():
      verification.resolved = true
    else:
      verification.reason = "Type errors still present"
  CATCH:
    verification.reason = "Could not verify types"

elif category == "missing_dependency":
  # Check if module can be resolved
  TRY:
    # Quick check - just verify npm ls doesn't error
    result = bash("npm ls 2>&1 || true")
    if "missing" not in result.lower() and "UNMET" not in result:
      verification.resolved = true
    else:
      verification.reason = "Dependencies still missing"
  CATCH:
    verification.reason = "Could not verify dependencies"

else:
  # For unknown categories, assume success if commands ran
  verification.resolved = true
  verification.reason = "Assumed resolved (no category-specific verification)"

return verification
```

**Helper Function**: `sanitize_for_shell(input_string)`
```
# Sanitize string for safe use in shell commands
# Remove or escape characters that could cause injection

# Remove any shell metacharacters
dangerous_chars = ['`', '$', '\\', '"', "'", ';', '&', '|', '>', '<', '\n', '\r']

sanitized = input_string
for char in dangerous_chars:
  sanitized = sanitized.replace(char, '')

# Truncate to reasonable length
if length(sanitized) > 200:
  sanitized = sanitized[:197] + "..."

return sanitized
```

**Helper Function**: `validate_kb_file_path(file_path, allowed_base_paths)`
```
# Validate that a KB file path is within allowed directories
# Prevents path traversal attacks (e.g., ../../etc/passwd)

# Resolve to absolute path and normalize
resolved_path = resolve_absolute_path(file_path)
normalized_path = normalize_path(resolved_path)

# Check for path traversal attempts
if ".." in file_path:
  WARN "Path traversal attempt detected: {file_path}"
  return false

# Verify path is under one of the allowed base paths
is_allowed = false
for base_path in allowed_base_paths:
  resolved_base = resolve_absolute_path(base_path)
  if normalized_path.startswith(resolved_base):
    is_allowed = true
    break

if not is_allowed:
  WARN "KB file path outside allowed directories: {file_path}"
  WARN "Allowed base paths: {allowed_base_paths}"
  return false

# Verify file extension is allowed (.md or .json only)
allowed_extensions = [".md", ".json"]
if not any(normalized_path.endswith(ext) for ext in allowed_extensions):
  WARN "Invalid KB file extension: {file_path}"
  return false

return true
```

### Step 6.5: Escalate to GitHub Issue (if max retries exceeded)

**Goal**: Create GitHub issue with diagnostic context after repeated failures

**Logic**:
```
if escalate_mode:
  max_retries = max_retries_parameter or 3
  retry_count = retry_count_parameter or 0

  if retry_count >= max_retries:
    PRINT "🚨 Maximum retries ({max_retries}) exceeded. Creating GitHub issue..."

    # Generate issue body with full diagnostic context
    issue_body = generate_issue_body(
      run_id=run_id,
      work_id=work_id,
      problems=problems,
      root_causes=root_causes,
      attempted_solutions=solutions,
      evidence=evidence,
      retry_count=retry_count
    )

    # Create issue title from primary problem
    primary_problem = problems[0].description if length(problems) > 0 else "Unknown workflow failure"
    issue_title = "Workflow Debug: {primary_problem}"

    # Truncate title if too long
    if length(issue_title) > 100:
      issue_title = issue_title[:97] + "..."

    # Use gh CLI to create issue (using files and env vars to avoid ALL shell interpolation)
    TRY:
      # Write issue body AND title to temp files to completely avoid shell interpolation
      temp_dir = ".fractary/runs/{run_id}/escalation/"
      ensure_directory_exists(temp_dir)

      temp_body_file = "{temp_dir}issue-body.md"
      temp_title_file = "{temp_dir}issue-title.txt"

      # Write body to file
      write(temp_body_file, issue_body)

      # Write sanitized title to file (still sanitize for display purposes)
      safe_title = sanitize_for_shell(issue_title)
      write(temp_title_file, safe_title)

      # Use a shell script that reads from files - NO variable interpolation in bash command
      # This completely avoids command injection as no user input is in the command string
      result = bash("""
        ISSUE_TITLE=$(cat .fractary/runs/*/escalation/issue-title.txt 2>/dev/null | head -1)
        ISSUE_BODY_FILE=$(ls .fractary/runs/*/escalation/issue-body.md 2>/dev/null | head -1)

        if [ -z "$ISSUE_TITLE" ] || [ -z "$ISSUE_BODY_FILE" ]; then
          echo "Error: Could not find issue title or body files"
          exit 1
        fi

        gh issue create \
          --title "$ISSUE_TITLE" \
          --body-file "$ISSUE_BODY_FILE" \
          --label "workflow-failure,needs-investigation"
      """)

      # Clean up temp files
      delete(temp_body_file)
      delete(temp_title_file)

      # Extract issue URL from result
      issue_url = extract_issue_url(result)
      PRINT "✅ GitHub issue created: {issue_url}"

      # Update workflow state with escalation info
      update_workflow_state(state_path, {
        escalated: true,
        escalation_issue: issue_url,
        escalation_time: now()
      })
    CATCH:
      PRINT "❌ Failed to create GitHub issue: {error}"
      PRINT "   Please create manually with the diagnostic information above"
  else:
    remaining = max_retries - retry_count
    PRINT "ℹ️  Retry {retry_count}/{max_retries}. {remaining} attempts remaining before escalation."
```

**Helper Function**: `generate_issue_body(run_id, work_id, problems, root_causes, attempted_solutions, evidence, retry_count)`
```
body = """
## Workflow Failure Report

**Run ID**: {run_id}
**Work Item**: {work_id}
**Retry Count**: {retry_count}
**Generated**: {now()}

---

## Problems Detected

{for each problem in problems:}
### {problem_index}. {problem.description}

- **Phase**: {problem.phase}
- **Category**: {problem.category}
- **Severity**: {problem.severity}
- **Confidence**: {problem.confidence}

{end for}

---

## Root Cause Analysis

{for each root_cause in root_causes:}
**Problem**: {root_cause.problem.description}

**Identified Cause**:
{root_cause.root_cause}

**Confidence**: {root_cause.confidence}
{if root_cause.kb_reference:}
**KB Reference**: {root_cause.kb_reference}
{end if}

{end for}

---

## Attempted Solutions

{for each solution in attempted_solutions:}
### Solution {solution_index}

**Actions Attempted**:
{for each action in solution.actions:}
- {action}
{end for}

**Rationale**: {solution.rationale}

{end for}

---

## Evidence

### Errors ({length(evidence.errors)})
```
{json_stringify(evidence.errors, indent=2)}
```

### Warnings ({length(evidence.warnings)})
```
{json_stringify(evidence.warnings, indent=2)}
```

### Recent Events
```
{json_stringify(evidence.recent_events, indent=2)}
```

---

## Next Steps

This issue was auto-generated because the workflow debugger could not resolve the problem after {retry_count} attempts.

Please:
1. Review the evidence and attempted solutions above
2. Investigate the root cause manually
3. Apply a fix and update the knowledge base

**To add to knowledge base after resolution**:
```bash
/fractary-faber:workflow-debugger --work-id {work_id} --learn
```
"""

return body
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

  # Create KB entry in markdown format
  create_kb_entry_markdown(
    problem=problems[0].description,
    category=problems[0].category,
    phase=problems[0].phase,
    step=step_parameter or "unknown",
    agent=agent_parameter or "unknown",
    root_cause=root_causes[0].root_cause,
    solution=solutions[0],
    verification_result="manual-verified"
  )

  PRINT "✅ Resolution added to knowledge base"
  PRINT "   Future similar issues will reference this resolution"
```

**Helper Function**: `create_kb_entry_markdown(problem, category, phase, step, agent, root_cause, solution, verification_result)`
```
# Generate unique KB ID
kb_id = "KB-{phase}-{generate_short_id()}"

# Create markdown content with YAML front matter
kb_content = """---
id: {kb_id}
title: {sanitize_title(problem)}
phase: {phase}
step: {step}
agent: {agent}
category: {category}
severity: medium
symptoms:
  - "{problem}"
tags:
  - auto-generated
  - {verification_result}
created: {format_date(now())}
verified: true
success_count: 1
---

# {sanitize_title(problem)}

## Symptoms

{problem}

## Root Cause

{root_cause}

## Solution

{solution.rationale}

### Actions

{for each action in solution.actions:}
1. {action}
{end for}

## Prevention

Review similar patterns during code review to prevent this issue from recurring.

---

*Auto-generated by workflow-debugger on {format_date(now())}*
"""

# Save to knowledge base
kb_dir = ".fractary/faber/knowledge-base/{phase}/"
ensure_directory_exists(kb_dir)

# Create filename from ID and sanitized title
safe_title = sanitize_filename(problem)[:50]
kb_file = "{kb_dir}/{kb_id}-{safe_title}.md"

write(kb_file, kb_content)

PRINT "   KB ID: {kb_id}"
PRINT "   File: {kb_file}"

return kb_id
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

Knowledge base entries can be stored in either **markdown** (preferred) or **JSON** (legacy) format.

### Markdown Format (Preferred)

New entries are stored in `.fractary/faber/knowledge-base/{phase}/*.md`:

```markdown
---
id: KB-build-001
title: TypeScript module resolution failure
phase: build
step: implement
agent: software-engineer
category: missing_dependency
severity: medium
symptoms:
  - "Cannot find module"
  - "TS2307: Cannot find module"
tags:
  - typescript
  - imports
created: 2026-01-28
verified: true
success_count: 12
---

# TypeScript Module Resolution Failure

## Symptoms

The build fails with "Cannot find module" or "TS2307" errors when importing
dependencies or local modules.

## Root Cause

Module resolution fails due to:
- Missing package in node_modules
- Incorrect import path (relative vs absolute)
- Missing TypeScript path mappings in tsconfig.json
- Package not listed in dependencies

## Solution

Check and fix the module resolution issue:

### Actions

1. Verify the package is installed: `npm ls <package-name>`
2. If missing, install it: `npm install <package-name>`
3. Check import path matches actual file location
4. Verify tsconfig.json paths configuration
5. Re-run build: `npm run build`

## Prevention

- Use absolute imports with path aliases configured in tsconfig.json
- Run `npm ci` in CI to ensure consistent dependencies
- Add pre-commit hook to verify imports
```

### JSON Format (Legacy)

Legacy entries in `.fractary/faber/knowledge-base/*.json` are still supported:

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

### Plugin Knowledge Bases

Plugins can contribute domain-specific knowledge bases stored in:
`.fractary/plugins/{plugin-name}/knowledge-base/{phase}/*.md`

Use the `knowledge-aggregator` skill to search across all sources:
```bash
/fractary-faber:knowledge-aggregator --category type_system --phase build
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

### Auto-Fix with Automatic Learning

Apply fixes and automatically log successful resolutions to KB:
```bash
/fractary-faber:workflow-debugger --work-id 258 --auto-fix --auto-learn
```

### Learn from Success

Manually add successful resolution to KB:
```bash
/fractary-faber:workflow-debugger --work-id 258 --learn
```

### Escalate After Failures

Create GitHub issue after max retries exceeded:
```bash
/fractary-faber:workflow-debugger --work-id 258 --escalate --retry-count 3
```

### Called from Workflow onFailure Hook

When invoked by workflow onFailure hook with full context:
```bash
/fractary-faber:workflow-debugger \
  --work-id 258 \
  --phase build \
  --step implement \
  --agent software-engineer \
  --auto-fix \
  --auto-learn \
  --escalate \
  --max-retries 3 \
  --retry-count 1
```

## Performance Considerations

- **Evidence Collection**: Limit log queries to last 50 events
- **KB Search**: Index KB entries by category for faster lookups
- **Similarity Calculation**: Cache keyword extractions
- **Large State Files**: Stream read instead of loading entirely

## Related Documentation

- **Commands**:
  - `commands/workflow-run.md` - Resume workflows after fixes
  - `commands/run-inspect.md` - Check workflow run status
- **Knowledge Base**:
  - `.fractary/faber/knowledge-base/` - Stored resolutions
  - `docs/DEBUGGING.md` - Debugging guide
