# GitHub Installer Protocol

Step-by-step protocol for installing FABER GitHub Actions workflows in a project.

## Steps

### 1. Check Existing Installation

Check for pre-existing files:
- `ls .github/workflows/faber.yml` - existing GitHub Actions workflow
- `ls .fractary/config.yaml` - existing Fractary project configuration

Record which files exist to tailor the installation flow.

### 2. Read Project Configuration

If `.fractary/config.yaml` exists:
- Read and parse the file
- Use project settings to tailor the setup checklist (e.g., detected secrets, environment config)

### 3. Determine Setup Script

If `--setup-script` was NOT provided as an argument:
- Ask the user with options:
  - **No setup** - no pre-run setup needed
  - **npm install** - Node.js project
  - **pip install** - Python project
  - **Custom command** - user provides a custom setup command

### 4. Confirm Overwrite (if applicable)

If `faber.yml` already exists:
- Ask the user whether to overwrite the existing file
- If declined, abort installation

### 5. Generate faber.yml

Generate the GitHub Actions workflow file from template. Two variants depending on whether a setup script is configured:

**Both variants include two jobs:**

**Job 1: `faber-respond`**
- Trigger: `issue_comment` event containing `@faber`
- Calls the reusable workflow from `fractary/faber` repository
- Passes repository secrets

**Job 2: `faber-auto`**
- Triggers:
  - Issue labeled with `faber:auto`
  - Issue title prefixed with `[FABER]`
  - `workflow_dispatch` (manual trigger)
- Calls the reusable workflow from `fractary/faber` repository
- Passes repository secrets

**With setup_script**: both jobs include the `setup_script` input parameter.
**Without setup_script**: jobs omit the setup_script input.

### 6. Write Workflow File

Write the generated content to `.github/workflows/faber.yml`.

Create the `.github/workflows/` directory if it does not exist.

### 7. Show GitHub Setup Checklist

Display a post-installation checklist for the user:

**Step 1: Repository Secrets**
- `ANTHROPIC_API_KEY` (REQUIRED) - API key for Claude
- Navigate to: Repository Settings > Secrets and variables > Actions

**Step 2: Environment-Specific Secrets**
- Secrets prefixed with `TEST_*` for test environment
- Secrets prefixed with `PROD_*` for production environment
- Only needed if the workflow accesses external services

**Step 3: Create the `faber:auto` Label**
- Go to: Repository > Issues > Labels > New label
- Name: `faber:auto`
- This label triggers the auto job when applied to an issue

**Step 4: Test the Installation**
- **Comment trigger**: create an issue and comment `@faber plan`
- **Auto trigger**: create an issue with `[FABER]` title prefix or apply the `faber:auto` label
- **Manual dispatch**: go to Actions tab > faber-auto > Run workflow

**Usage Examples**:
- `@faber plan` - create an execution plan for the issue
- `@faber run` - execute the full workflow
- `@faber run --phase build` - execute a specific phase only
- `@faber release` - run the release phase
