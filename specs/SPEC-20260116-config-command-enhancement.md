# Configuration Command Enhancement Specification

**SPEC ID**: SPEC-20260116-config-command-enhancement
**Created**: 2026-01-16
**Status**: In Progress

## Overview

Transform the `/init` commands into comprehensive `/config` commands for both `fractary-faber` and `fractary-faber-cloud` plugins, providing interactive configuration management that handles both initial setup and ongoing updates.

## Summary

| Plugin | Old Command (DELETE) | New Command | Agent |
|--------|---------------------|-------------|-------|
| faber | `/fractary-faber:init` | `/fractary-faber:config` | `config-manager` |
| faber-cloud | `/fractary-faber-cloud:init` | `/fractary-faber-cloud:config` | `config-agent` |

**No backward compatibility** - `/init` commands will be completely removed and replaced by `/config`.

---

## Phase 1: FABER Core Plugin (`fractary-faber:config`)

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `plugins/faber/commands/config.md` | **Create** | New config command definition |
| `plugins/faber/commands/init.md` | **Delete** | Remove old init command |
| `plugins/faber/agents/config-manager.md` | **Create** | New comprehensive config agent |
| `plugins/faber/agents/faber-initializer.md` | **Delete** | Remove old initializer agent |

### 1.1 Create `commands/config.md`

```yaml
---
name: fractary-faber:config
description: Configure FABER - initialization, updates, and management
allowed-tools: Task(fractary-faber:config-manager)
model: claude-haiku-4-5
argument-hint: '[--context "description of changes"] [--force] [--json]'
---
```

### 1.2 Delete `commands/init.md`

Simply delete this file. No replacement or alias needed.

### 1.3 Delete `agents/faber-initializer.md`

Simply delete this file. The new `config-manager` agent replaces it entirely.

### 1.4 Create `agents/config-manager.md`

**Key Features:**

1. **Dual Mode Operation**
   - **Initialize Mode** (no existing config): Full interactive setup
   - **Update Mode** (config exists): Parse `--context` for AI-assisted changes

2. **Interactive Flow with AskUserQuestion**
   ```
   Step 1: Check for existing config
   Step 2: Auto-detect values (git remote, platforms)
   Step 3: Ask user to CONFIRM or MODIFY each auto-detected value
   Step 4: Build proposed configuration
   Step 5: Display PREVIEW of all changes
   Step 6: Get EXPLICIT confirmation before applying
   Step 7: Apply changes with timestamped backup
   Step 8: Validate configuration
   Step 9: Show post-configuration guidance
   ```

3. **--context Parameter Handling**
   - Validate input (max 500 chars, no shell metacharacters)
   - AI interprets freeform text: "enable feature X" → config changes
   - Always show current vs proposed values before applying

4. **Configuration Preview Format**
   ```
   Proposed Configuration
   ----------------------
   Repository: owner/repo (auto-detected from git)
   Work Platform: github
   Repo Platform: github
   Default Branch: main

   Workflow Settings:
     - Autonomy: guarded
     - Phase: frame (enabled)
     - Phase: architect (enabled, refineSpec: true)
     ...

   Files to Create:
     - .fractary/faber/config.yaml
   ```

5. **Update Mode Preview**
   ```
   Proposed Changes
   ----------------

   workflow.autonomy:
     Current: guarded
     New:     autonomous

   Files to Modify:
     - .fractary/faber/config.yaml

   Backup: .fractary/faber/config.yaml.backup.20260116143022
   ```

6. **Timestamped Backup Logic (Cross-Platform)**
   ```bash
   # Linux: nanosecond precision
   if date +%N >/dev/null 2>&1 && [ "$(date +%N)" != "N" ]; then
     timestamp=$(date +%Y%m%d%H%M%S%N)
   else
     # macOS/BSD: seconds + PID + random
     timestamp=$(date +%Y%m%d%H%M%S)_$$_$RANDOM
   fi
   backup_file="${config_file}.backup.${timestamp}"
   ```

7. **Rollback Tracking**
   ```bash
   # Track pre-existing state
   config_existed=false
   if [ -f .fractary/faber/config.yaml ]; then
     config_existed=true
   fi

   # On failure: only remove files that didn't exist before
   # Restore pre-existing files from backups
   ```

8. **Validation Pipeline**
   - Input sanitization (--context parameter)
   - YAML syntax validation (js-yaml → yamllint fallback → grep patterns)
   - Schema validation (Zod via SDK)
   - Name validation (repo owner/name format)

9. **Post-Configuration Guidance**
   ```
   FABER configuration complete!

   ADDITIONAL CONFIGURATION REQUIRED:

   1. **Authentication** (Required)
      Configure GitHub token in: .fractary/config.yaml
      Or run: /fractary-work:init

   2. **Cloud Infrastructure** (Optional)
      If using AWS/Terraform: /fractary-faber-cloud:config

   Next Steps:
     1. Review config: cat .fractary/faber/config.yaml
     2. Run a workflow: /fractary-faber:workflow-plan <issue-number>
   ```

---

## Phase 2: FABER Cloud Plugin (`fractary-faber-cloud:config`)

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `plugins/faber-cloud/commands/config.md` | **Create** | New config command definition |
| `plugins/faber-cloud/commands/init.md` | **Delete** | Remove old init command |
| `plugins/faber-cloud/agents/config-agent.md` | **Create** | New comprehensive config agent |
| `plugins/faber-cloud/agents/init-agent.md` | **Delete** | Remove old init agent |

### 2.1 Create `commands/config.md`

```yaml
---
name: fractary-faber-cloud:config
description: Configure faber-cloud - initialization and infrastructure settings
allowed-tools: Task(fractary-faber-cloud:config-agent)
model: claude-haiku-4-5
argument-hint: '[--context "description of changes"] [--provider aws] [--iac terraform]'
---
```

### 2.2 Delete `commands/init.md`

Simply delete this file.

### 2.3 Delete `agents/init-agent.md`

Simply delete this file. The new `config-agent` replaces it entirely.

### 2.4 Create `agents/config-agent.md`

**Key Features (similar to config-manager with cloud-specific logic):**

1. **Auto-Discovery with Confirmation**
   - Detect AWS profiles, accounts, regions
   - Detect Terraform directories
   - Detect cloud provider from installed CLIs
   - **Always ask user to CONFIRM** auto-detected values

2. **Interactive Prompts**
   ```
   AskUserQuestion: "Detected AWS account 123456789012 in us-east-1. Is this correct?"
   Options: ["Yes, use detected", "No, let me specify"]

   AskUserQuestion: "Which cloud provider are you using?"
   Options: ["AWS (Recommended)", "GCP", "Azure", "Other"]
   ```

3. **Preview Before Apply**
   ```
   Proposed Cloud Configuration
   ----------------------------
   Provider: AWS
     Account: 123456789012
     Region: us-east-1

   IaC Tool: Terraform
     Directory: ./infrastructure/terraform

   AWS Profiles:
     - discover-deploy: corthuxa-core-discover-deploy
     - test-deploy: corthuxa-core-test-deploy
     - prod-deploy: corthuxa-core-prod-deploy

   Workflows to Create:
     - .fractary/plugins/faber-cloud/workflows/infrastructure-deploy.json
     - .fractary/plugins/faber-cloud/workflows/infrastructure-audit.json
     - .fractary/plugins/faber-cloud/workflows/infrastructure-teardown.json

   Proceed? [Yes/No]
   ```

4. **--context AI Interpretation**
   - "add staging environment" → adds staging profile configuration
   - "change region to eu-west-1" → updates AWS region
   - "enable cost estimation" → updates workflow configuration

---

## Phase 3: Shared Components

### 3.1 Input Validation Function (Reusable)

Create validation helpers that both agents use:

```typescript
// Validate --context parameter
function validateContextInput(input: string): { valid: boolean; error?: string } {
  if (!input || input.trim() === '') {
    return { valid: false, error: 'Context cannot be empty' };
  }
  if (input.length > 500) {
    return { valid: false, error: 'Context exceeds 500 character limit' };
  }
  // Check for dangerous patterns
  const dangerous = /[\\|;&><`$\x00-\x1f]|\.\.\//.test(input);
  if (dangerous) {
    return { valid: false, error: 'Context contains invalid characters' };
  }
  return { valid: true };
}

// Validate repository/organization names
function validateIdentifier(name: string, type: 'org' | 'repo'): { valid: boolean; error?: string } {
  if (!name || name.trim() === '') {
    return { valid: false, error: `${type} name cannot be empty` };
  }
  if (name.length > 100) {
    return { valid: false, error: `${type} name exceeds 100 character limit` };
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) {
    return { valid: false, error: `${type} name must start with alphanumeric and contain only alphanumeric, ., -, _` };
  }
  return { valid: true };
}
```

### 3.2 Cross-Platform Timestamp Generation

Both agents should use portable timestamp generation:

```bash
generate_timestamp() {
  if date +%N >/dev/null 2>&1 && [ "$(date +%N)" != "N" ]; then
    # Linux: nanosecond precision
    echo "$(date +%Y%m%d%H%M%S%N)"
  else
    # macOS/BSD: seconds + uniqueness
    echo "$(date +%Y%m%d%H%M%S)_$$_$RANDOM"
  fi
}
```

### 3.3 YAML Validation with Fallbacks

```bash
validate_yaml() {
  local file="$1"

  # Try Python/PyYAML first
  if command -v python3 >/dev/null 2>&1; then
    if python3 -c "import yaml; yaml.safe_load(open('$file'))" 2>/dev/null; then
      return 0
    fi
  fi

  # Fall back to yamllint
  if command -v yamllint >/dev/null 2>&1; then
    if yamllint -d relaxed "$file" >/dev/null 2>&1; then
      return 0
    fi
  fi

  # Fall back to basic syntax check (no tabs at line start for YAML)
  if ! grep -q "$(printf '\t')" "$file" 2>/dev/null; then
    return 0  # Basic check passed
  fi

  return 1  # Invalid
}
```

---

## Phase 4: Documentation Updates

### Files to Update

| File | Changes |
|------|---------|
| `README.md` (if exists) | Update command references from /init to /config |
| `plugins/faber/README.md` | Document /config command |
| `plugins/faber-cloud/README.md` | Document /config command |
| Any docs referencing `/init` | Replace with `/config` (no deprecation note needed) |

---

## Implementation Order

1. **Phase 1a**: Create `fractary-faber:config` command file
2. **Phase 1b**: Create `config-manager` agent
3. **Phase 1c**: Delete `fractary-faber:init` command and `faber-initializer` agent
4. **Phase 2a**: Create `fractary-faber-cloud:config` command file
5. **Phase 2b**: Create `config-agent` agent
6. **Phase 2c**: Delete `fractary-faber-cloud:init` command and `init-agent` agent
7. **Phase 3**: Test both commands (init and update modes)
8. **Phase 4**: Update documentation

---

## Verification Plan

### Test Cases

1. **Fresh Init (no existing config)**
   ```bash
   /fractary-faber:config
   # Should: auto-detect, ask confirmations, show preview, create config
   ```

2. **Update with --context**
   ```bash
   /fractary-faber:config --context "change autonomy to autonomous"
   # Should: show current vs proposed, ask confirmation, backup, update
   ```

3. **Cloud Config Fresh Init**
   ```bash
   /fractary-faber-cloud:config
   # Should: auto-detect AWS/Terraform, ask confirmations, create config + workflows
   ```

4. **Cloud Config Update**
   ```bash
   /fractary-faber-cloud:config --context "add eu-west-1 region"
   # Should: show proposed changes, backup, update
   ```

5. **Validation Rejection**
   ```bash
   /fractary-faber:config --context "rm -rf /"
   # Should: reject with validation error (shell metacharacters)
   ```

6. **Rollback on Failure**
   - Simulate failure mid-configuration
   - Verify backup exists
   - Verify original state can be restored

7. **Old Command Error**
   ```bash
   /fractary-faber:init
   # Should: fail with "command not found" - use /fractary-faber:config
   ```

### Manual Verification Steps

1. Run `/fractary-faber:config` on a fresh project
2. Verify AskUserQuestion prompts appear for each auto-detected value
3. Verify preview shows all proposed changes before applying
4. Verify explicit confirmation required
5. Verify config file created with correct values
6. Run `/fractary-faber:config --context "change X"` on existing config
7. Verify backup file created with timestamp
8. Verify changes applied correctly
9. Test on both Linux and macOS (cross-platform timestamps)

---

## Key Principles Applied

1. **Transparency**: User sees and approves all changes before they happen
2. **Safety**: Fail-safe defaults, backups, rollback capabilities
3. **Portability**: Works on Linux, macOS, and BSD systems
4. **Robustness**: Validates all inputs, handles all error cases
5. **Guidance**: Clear next steps and troubleshooting information
6. **Flexibility**: Handles both initialization and incremental updates
7. **Clean Break**: Old `/init` commands fully removed, forcing adoption of `/config`
