# Workflow Inspector Integration Tests

This document defines integration test scenarios for the workflow-inspector agent enhancements.

## Test Categories

1. **Argument Parsing Tests** - Verify all audit modes (no argument, workflow ID, file path, namespaced)
2. **Agent/Skill Discovery Tests** - Verify registry building and reference extraction
3. **Response Format Validation Tests** - Verify compliance classification (COMPLIANT, UNKNOWN, NOT_FOUND)
4. **Error Handling Tests** - Verify proper error messages and exit codes
5. **Auto-Fix Tests** - Verify --fix mode functionality

---

## Test 1: No Argument Mode - Show Usage and List Workflows

**Scenario**: User runs workflow-inspect with no arguments

**Setup**:
```bash
# Ensure config file exists with workflows
ls .fractary/faber/config.json
```

**Expected Behavior**:
- Shows usage message with command syntax
- Lists all available workflows from config
- Exits with code 0
- Does not perform validation

**Verification**:
```bash
/fractary-faber:workflow-inspect

# Expected output:
# 🔍 FABER Workflow Audit
# Target: Show usage and list available workflows
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
# Usage: /fractary-faber:workflow-inspect [<workflow>] [OPTIONS]
#
# Workflow identifier:
#   workflow-id          Validate workflow from project config
#   path/to/file.json    Validate standalone workflow file
#   plugin:workflow-id   Validate namespaced workflow
#
# Available workflows in .fractary/faber/config.json:
#   • default - Standard FABER workflow (Frame → Architect → Build → Evaluate → Release)
#   • bug - Optimized workflow for bug fixes
#   • feature - Comprehensive workflow for new features
```

**Exit Code**: 0

---

## Test 2: Workflow ID Mode - Audit Specific Workflow

**Scenario**: User audits a specific workflow by ID from project config

**Setup**:
```bash
# Ensure default workflow exists in config
grep -q '"id": "default"' .fractary/faber/config.json
```

**Expected Behavior**:
- Loads workflow "default" from project config
- Validates workflow structure (phases, hooks, autonomy)
- Discovers and validates agent/skill references
- Generates comprehensive report
- Shows Agent/Skill Validation section

**Verification**:
```bash
/fractary-faber:workflow-inspect default

# Expected output includes:
# 🔍 FABER Workflow Audit
# Target: Workflow 'default' from project config
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
# [... validation results ...]
#
# 📋 Agent/Skill Validation
# Total references: N
#
# ✅ COMPLIANT (X)
#   ✓ fractary-work:issue-fetch - Documents FABER Response Format
#   ...
#
# ⚠️  UNKNOWN (Y)
#   ? some-agent:unknown - Response format not documented
#   ...
#
# ❌ NOT FOUND (Z)
#   ✗ typo-agent:missing - Agent/skill not found
#   ...
```

**Exit Code**: 0 (if no errors), 1 (if warnings), or 2 (if errors)

---

## Test 3: Workflow File Mode - Audit Standalone File

**Scenario**: User audits a standalone workflow JSON file

**Setup**:
```bash
# Ensure workflow file exists
ls plugins/faber/config/workflows/feature.json
```

**Expected Behavior**:
- Loads workflow from file path
- Validates it's a valid workflow (has id and phases)
- Performs full validation
- Agent/skill validation includes references from file

**Verification**:
```bash
/fractary-faber:workflow-inspect plugins/faber/config/workflows/feature.json

# Expected output:
# 🔍 FABER Workflow Audit
# Target: Workflow file: plugins/faber/config/workflows/feature.json
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
# [... validation results ...]
```

**Exit Code**: 0 (if valid), 3 (if not found), 4 (if invalid JSON)

---

## Test 4: Namespaced Mode - Audit Plugin Workflow

**Scenario**: User audits a workflow from plugin namespace

**Setup**:
```bash
# Ensure plugin workflow exists
ls plugins/faber/config/workflows/default.json
```

**Expected Behavior**:
- Resolves namespace "fractary-faber" to plugin directory
- Loads workflow from plugins/faber/config/workflows/default.json
- Performs validation
- Reports namespaced workflow target

**Verification**:
```bash
/fractary-faber:workflow-inspect fractary-faber:default

# Expected output:
# 🔍 FABER Workflow Audit
# Target: Namespaced workflow: fractary-faber:default
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
# [... validation results ...]
```

**Exit Code**: 0 (if valid), 3 (if not found)

---

## Test 5: Error Handling - Workflow Not Found

**Scenario**: User requests a workflow that doesn't exist

**Setup**:
```bash
# Config exists but workflow ID is invalid
ls .fractary/faber/config.json
```

**Expected Behavior**:
- Reports error: "Workflow 'nonexistent' not found in config"
- Lists available workflows
- Exits with code 3

**Verification**:
```bash
/fractary-faber:workflow-inspect nonexistent

# Expected output:
# ❌ ERROR: Workflow 'nonexistent' not found in config
#
# Available workflows:
#   - default: Standard FABER workflow
#   - bug: Optimized workflow for bug fixes
#   - feature: Comprehensive workflow for new features
```

**Exit Code**: 3

---

## Test 6: Error Handling - File Not Found

**Scenario**: User provides path to non-existent workflow file

**Expected Behavior**:
- Reports error: "Workflow file not found: /path/to/missing.json"
- Exits with code 3

**Verification**:
```bash
/fractary-faber:workflow-inspect ./nonexistent.json

# Expected output:
# ❌ ERROR: Workflow file not found: ./nonexistent.json
```

**Exit Code**: 3

---

## Test 7: Error Handling - Invalid JSON

**Scenario**: User provides path to file with invalid JSON

**Setup**:
```bash
# Create invalid JSON file
echo '{"invalid": json}' > /tmp/invalid-workflow.json
```

**Expected Behavior**:
- Reports error: "File is not a valid workflow (missing required fields: id, phases)"
- Exits with code 4

**Verification**:
```bash
/fractary-faber:workflow-inspect /tmp/invalid-workflow.json

# Expected output:
# ❌ ERROR: File is not a valid workflow (missing required fields: id, phases)
```

**Exit Code**: 4

---

## Test 8: Agent Discovery - Build Registry

**Scenario**: Agent builds registry of all agents and skills

**Setup**:
```bash
# Ensure plugin agents exist
ls plugins/faber/agents/*.md | wc -l  # Should be > 0
ls plugins/faber/skills/*/SKILL.md | wc -l  # Should be > 0
```

**Expected Behavior**:
- Discovers plugin agents from plugins/*/agents/*.md
- Discovers plugin skills from plugins/*/skills/*/SKILL.md
- Discovers user agents from ~/.claude/agents/*.md and .claude/agents/*.md
- Extracts agent/skill names from frontmatter
- Builds registry mapping name → {path, type, plugin}

**Verification**:
```bash
/fractary-faber:workflow-inspect default --verbose

# Expected output includes:
# 🔍 Discovering agents and skills...
# Found N agents/skills in registry
# Registry entries:
#   - fractary-faber:workflow-inspector (agent, faber)
#   - fractary-faber:faber-planner (agent, faber)
#   - fractary-spec:spec-create (skill, spec)
#   ...
```

---

## Test 9: Reference Extraction - Find All References

**Scenario**: Agent extracts all agent/skill references from workflow steps

**Setup**:
```bash
# Workflow with known references
cat plugins/faber/config/workflows/default.json | grep -E "(Skill|Task|/)"
```

**Expected Behavior**:
- Scans all phases (frame, architect, build, evaluate, release)
- Scans pre_steps, steps, post_steps
- Extracts patterns:
  - Skill(skill="name")
  - /plugin:skill
  - Task(subagent_type="name")
- Creates unique set of references

**Verification**:
```bash
/fractary-faber:workflow-inspect default --verbose

# Expected output includes:
# Extracting agent/skill references from workflow steps...
# Found X unique agent/skill references
# References:
#   - fractary-work:issue-fetch
#   - fractary-spec:spec-create
#   - fractary-faber:faber-planner
#   ...
```

---

## Test 10: Response Format Validation - COMPLIANT Agent

**Scenario**: Agent validates that a referenced agent documents FABER Response Format

**Setup**:
```bash
# Create test agent with explicit FABER Response Format documentation
mkdir -p .claude/agents
cat > .claude/agents/test-compliant.md <<'EOF'
---
name: test:compliant
---

## Returns
Returns standard FABER Response Format with:
- status: "success" | "warning" | "failure"
- message: Human-readable summary
- details: Operation-specific data
EOF
```

**Expected Behavior**:
- Reads agent documentation
- Finds explicit indicator: "FABER Response Format"
- Classifies as COMPLIANT
- Reports in validation section

**Verification**:
```bash
# Create workflow referencing test agent
# Run audit
/fractary-faber:workflow-inspect test-workflow --verbose

# Expected output includes:
# ✅ COMPLIANT (1)
#   ✓ test:compliant - Documents FABER Response Format
```

**Cleanup**:
```bash
rm -rf .claude/agents/test-compliant.md
```

---

## Test 11: Response Format Validation - UNKNOWN Agent

**Scenario**: Agent validates agent with unclear response format

**Setup**:
```bash
# Create test agent without clear format documentation
cat > .claude/agents/test-unknown.md <<'EOF'
---
name: test:unknown
---

## Returns
Analysis results as text summary.
EOF
```

**Expected Behavior**:
- Reads agent documentation
- No explicit FABER indicators found
- No implicit indicators (status, message fields) found
- Classifies as UNKNOWN
- Adds suggestion to document format

**Verification**:
```bash
/fractary-faber:workflow-inspect test-workflow --verbose

# Expected output includes:
# ⚠️  UNKNOWN (1)
#   ? test:unknown - Response format not documented or unclear
#
# 💡 Agent/Skill Suggestions:
#   → Add response format documentation to test:unknown
#   → Reference: plugins/faber/docs/RESPONSE-FORMAT.md
```

**Cleanup**:
```bash
rm -rf .claude/agents/test-unknown.md
```

---

## Test 12: Response Format Validation - NOT FOUND Agent

**Scenario**: Workflow references agent that doesn't exist

**Setup**:
```bash
# Workflow references non-existent agent (typo or missing installation)
# No setup needed - agent simply doesn't exist
```

**Expected Behavior**:
- Searches registry for referenced agent
- Agent not found in registry
- Classifies as NOT_FOUND
- Adds warning
- Suggests installation or typo check

**Verification**:
```bash
# Audit workflow that references "fractary-typo:missing"
/fractary-faber:workflow-inspect workflow-with-typo

# Expected output includes:
# ❌ NOT FOUND (1)
#   ✗ fractary-typo:missing - Agent/skill not found in plugins or user directories
#
# ⚠️  WARNINGS (1)
#   ! [Agent/Skill] Referenced agent/skill not found: fractary-typo:missing
#
# 💡 Agent/Skill Suggestions:
#   → Install missing plugins or verify agent/skill names
#   → Check for typos in workflow step prompts
```

---

## Test 13: Response Format Validation - Implicit Compliance

**Scenario**: Agent has structured output with required fields but no explicit FABER mention

**Setup**:
```bash
# Create agent with structured output matching FABER format
cat > .claude/agents/test-implicit.md <<'EOF'
---
name: test:implicit
---

## Output
Returns JSON object:
```json
{
  "status": "success" | "warning" | "failure",
  "message": "Human-readable summary",
  "details": {
    "result": "data"
  },
  "errors": ["error1"],
  "warnings": ["warning1"]
}
```
EOF
```

**Expected Behavior**:
- Reads agent documentation
- No explicit FABER indicators
- Finds implicit indicators: has_outputs, has_status, has_message, has_details, has_errors
- Classifies as COMPLIANT (implicit)
- Reports as "has structured output matching FABER format"

**Verification**:
```bash
/fractary-faber:workflow-inspect test-workflow --verbose

# Expected output includes:
# ✅ COMPLIANT (1)
#   ✓ test:implicit - Has structured output matching FABER format
```

**Cleanup**:
```bash
rm -rf .claude/agents/test-implicit.md
```

---

## Test 14: Verbose Mode - Detailed Output

**Scenario**: User runs audit with --verbose flag

**Expected Behavior**:
- Shows audit mode details
- Shows registry discovery progress
- Lists all registry entries
- Lists all extracted references
- Shows detailed validation results

**Verification**:
```bash
/fractary-faber:workflow-inspect default --verbose

# Expected output includes:
# Mode: workflow_id
# Check aspect: all
# Auto-fix: false
#
# 🔍 Discovering agents and skills...
# Found 50 agents/skills in registry
# Registry entries:
#   - fractary-faber:workflow-inspector (agent, faber)
#   [... full list ...]
#
# Extracting agent/skill references from workflow steps...
# Found 10 unique agent/skill references
# References:
#   - fractary-work:issue-fetch
#   [... full list ...]
#
# Validating agent/skill response format compliance...
```

---

## Test 15: Check Aspect Filter - Steps Only

**Scenario**: User audits only specific aspect (steps validation)

**Expected Behavior**:
- Skips other validation aspects
- Only performs agent/skill validation
- Faster execution

**Verification**:
```bash
/fractary-faber:workflow-inspect default --check steps

# Expected output:
# - Should include agent/skill validation
# - Should skip some other checks (hooks, integrations, etc.)
```

---

## Test 16: Auto-Fix Mode - Missing Hook Arrays

**Scenario**: User runs audit with --fix flag on config with missing hooks

**Setup**:
```bash
# Config with missing hook arrays
# (This would be in a test config file)
```

**Expected Behavior**:
- Identifies missing hook arrays
- Adds empty arrays for missing hooks
- Creates backup file
- Writes fixed configuration
- Reports fixes made

**Verification**:
```bash
/fractary-faber:workflow-inspect default --fix

# Expected output includes:
# ✓ Auto-fixed N issues
#   Backup: .fractary/faber/config.json.backup
```

---

## Test 17: Exit Code - All Checks Passed

**Scenario**: Workflow validation passes completely

**Expected Behavior**:
- Exit code 0

**Verification**:
```bash
/fractary-faber:workflow-inspect default
echo $?

# Expected: 0
```

---

## Test 18: Exit Code - Warnings Present

**Scenario**: Workflow validation has warnings but no errors

**Expected Behavior**:
- Exit code 1

**Verification**:
```bash
# Audit workflow with warnings (e.g., missing descriptions)
/fractary-faber:workflow-inspect workflow-with-warnings
echo $?

# Expected: 1
```

---

## Test 19: Exit Code - Errors Present

**Scenario**: Workflow validation has critical errors

**Expected Behavior**:
- Exit code 2

**Verification**:
```bash
# Audit workflow with errors (e.g., missing required phase)
/fractary-faber:workflow-inspect workflow-with-errors
echo $?

# Expected: 2
```

---

## Test 20: Exit Code - File Not Found

**Scenario**: Configuration or workflow file not found

**Expected Behavior**:
- Exit code 3

**Verification**:
```bash
/fractary-faber:workflow-inspect nonexistent
echo $?

# Expected: 3
```

---

## Test Coverage Summary

| Category | Tests | Coverage |
|----------|-------|----------|
| Argument Parsing | 5 | All modes (no argument, ID, file, namespaced, error handling) |
| Agent Discovery | 1 | Registry building from multiple sources |
| Reference Extraction | 1 | All pattern types (Skill, Task, slash commands) |
| Format Validation | 5 | COMPLIANT (explicit + implicit), UNKNOWN, NOT_FOUND |
| Error Handling | 3 | Not found, invalid JSON, missing workflows |
| Reporting | 1 | Verbose mode |
| Filtering | 1 | Check aspect parameter |
| Auto-Fix | 1 | Fix mode functionality |
| Exit Codes | 4 | All exit codes (0, 1, 2, 3, 4) |

**Total**: 20 test scenarios covering all major functionality

## Running Tests

### Manual Testing

Run each test scenario individually following the verification steps.

### Automated Testing (Future)

```bash
# Run all tests
./plugins/faber/tests/integration/run-workflow-inspector-tests.sh

# Run specific category
./plugins/faber/tests/integration/run-workflow-inspector-tests.sh argument-parsing

# Run specific test
./plugins/faber/tests/integration/run-workflow-inspector-tests.sh test-1
```

## Success Criteria

All tests should pass with expected output and exit codes. Agent/skill validation should correctly classify compliance levels based on documentation patterns.
