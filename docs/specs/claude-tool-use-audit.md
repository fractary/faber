# Tool Dependencies: All Custom Skills, Agents & Commands

## Summary of Claude Code Tools Used

The unique Claude Code tools referenced across all plugins:

| Tool | Used By |
|------|---------|
| `Bash` | Nearly everything — primary tool for CLI invocation |
| `Read` | Agents & skills that inspect files |
| `Write` | Agents that create/modify config or state files |
| `Edit` | Core config agents only |
| `Glob` | Exploration-heavy agents |
| `Grep` | `issue-bulk-creator`, `workflow-engineer`, `github-installer` |
| `Skill` | Workflow orchestrators that chain skills |
| `AskUserQuestion` | Interactive agents needing user input |
| `Task` (Agent spawning) | Commands that delegate to agents |
| `TaskCreate`/`TaskUpdate` | `workflow-batch-run` only |
| `TodoWrite` | `workflow-plan`, `workflow-run` |
| `SlashCommand` | `workflow-planner` agent only |

---

## fractary-faber

### Agents (`plugins/faber/agents/`)

| Agent | Tools (frontmatter) |
|-------|---------------------|
| `config-initializer` | `Bash, Read, Glob, AskUserQuestion` |
| `config-updater` | `Bash, Read, AskUserQuestion` |
| `config-validator` | `Bash, Read` |
| `github-installer` | `Read, Write, Glob, Bash, Grep, AskUserQuestion` |
| `run-inspect` | `Read, Glob, Bash, Skill` |
| `session-loader` | `Read, Write, Glob, Bash, Skill` |
| `session-saver` | `Read, Write, Bash` |
| `workflow-debugger` | `Read, Write, Glob, Bash, Skill` |
| `workflow-engineer` | `Read, Write, Glob, Bash, Grep, AskUserQuestion` |
| `workflow-inspector` | `Read, Write, Glob, Bash` |
| `workflow-plan-reporter` | `Read, Bash, Glob` |
| `workflow-plan-validator` | `Read, Bash, Glob` (DEPRECATED) |
| `workflow-planner` | `Skill, SlashCommand, Read, Write, Bash, Glob, Grep, AskUserQuestion` |
| `workflow-verifier` | `Skill(fractary-faber:workflow-run-verifier)` |

### Skills (`plugins/faber/skills/`)

| Skill | Tools (frontmatter) |
|-------|---------------------|
| `knowledge-aggregator` | `Read, Glob` |
| `target-matcher` | `Bash, Read` |
| All other skills (architect, build, core, entity-state, evaluate, faber-config, faber-debugger, faber-hooks, faber-state, feedback-handler, frame, issue-reviewer, release, response-validator, run-manager, workflow-run-verifier) | **None declared** — inherit from invoking context |

### Commands (`plugins/faber/commands/`)

| Command | allowed-tools |
|---------|---------------|
| `config-init` | `Task(fractary-faber:config-initializer)` |
| `config-update` | `Task(fractary-faber:config-updater)` |
| `config-validate` | `Task(fractary-faber:config-validator)` |
| `install-github-app` | `Task(fractary-faber:github-installer)` |
| `run-inspect` | `Task(fractary-faber:run-inspect)` |
| `session-clear` | `Skill, Read, Bash` |
| `session-load` | `Task(fractary-faber:session-loader)` |
| `session-save` | `Task(fractary-faber:session-saver)` |
| `workflow-batch-plan` | `Write, Bash, Read, Task(fractary-faber:workflow-plan-reporter)` |
| `workflow-batch-run` | `Read, Write, Skill, TaskCreate, TaskUpdate, AskUserQuestion, Task(workflow-planner), Task(workflow-plan-validator), Task(workflow-plan-reporter)` |
| `workflow-create` | `Task(fractary-faber:workflow-engineer)` |
| `workflow-debug` | `Task(fractary-faber:workflow-debugger)` |
| `workflow-inspect` | `Task(fractary-faber:workflow-inspector)` |
| `workflow-plan` | `TodoWrite, Skill(fractary-work:issue-fetch), Skill(fractary-work:issue-comment), Task(workflow-planner), Task(workflow-plan-validator), Task(workflow-plan-reporter)` |
| `workflow-plan-report` | `Task(fractary-faber:workflow-plan-reporter)` |
| `workflow-run` | `Read, Write, Bash, Skill, AskUserQuestion, MCPSearch, TodoWrite, Task(workflow-planner), Task(workflow-plan-validator), Task(workflow-plan-reporter), Task(workflow-verifier)` |
| `workflow-update` | `Task(fractary-faber:workflow-engineer)` |

---

## fractary-core

### Plugin: core

| Component | Type | Tools |
|-----------|------|-------|
| `cloud-initializer` | Agent | `Bash, Read, Edit, Write, Glob, AskUserQuestion` |
| `config-initializer` | Agent | `Bash, Read, Edit, Write, Glob, AskUserQuestion` |
| `config-updater` | Agent | None declared (Bash/Read/Write implicit) |
| `env-switcher` | Agent | None declared (Bash implicit) |
| `cloud-init` | Command | `Task(fractary-core:cloud-initializer)` |
| `config-init` | Command | `Task(fractary-core:config-initializer)` |
| `config-show` | Command | `Bash(fractary-core config show:*)` |
| `config-update` | Command | `Task(fractary-core:config-updater)` |
| `config-validate` | Command | `Bash(fractary-core config validate:*)` |
| `env-init` | Command | `Bash(fractary-core config env-init:*)` |
| `env-list` | Command | `Bash(fractary-core config env-list:*)` |
| `env-section-read` | Command | `Bash(fractary-core config env-section-read:*)` |
| `env-section-write` | Command | `Bash(fractary-core config env-section-write:*)` |
| `env-show` | Command | `Bash(fractary-core config env-show:*)` |
| `env-switch` | Command | `Task(fractary-core:env-switcher)` |

### Plugin: repo

| Component | Type | Tools |
|-----------|------|-------|
| `pr-review-agent` | Agent | `Bash` |
| `branch-create` | Command | `Bash(fractary-core repo branch-create:*)` |
| `branch-forward` | Command | `Bash(fractary-core repo branch-forward:*)` |
| `commit` | Command | `Bash(fractary-core repo commit:*)` |
| `commit-push` | Command | `Bash(fractary-core repo branch-create/commit/push:*)` |
| `commit-push-pr` | Command | `Bash(fractary-core repo branch-create/commit/push/pr-create:*)` |
| `commit-push-pr-review` | Command | `Bash(repo CLI + gh pr view + gh api), Task(pr-review-agent)` |
| `commit-push-pr-merge` | Command | `Bash(repo CLI + gh pr view + gh api + git checkout)` |
| `pr-create` | Command | `Bash(fractary-core repo pr-create:*)` |
| `pr-merge` | Command | `Bash(fractary-core repo pr-merge:*, gh pr view)` |
| `pr-review` | Command | `Task(fractary-repo:pr-review-agent)` |
| `pull` | Command | `Bash(fractary-core repo pull:*)` |
| `worktree-*` (4 cmds) | Command | `Bash(fractary-core repo worktree-*:*)` |

### Plugin: work

| Component | Type | Tools |
|-----------|------|-------|
| `issue-bulk-creator` | Agent | `Bash(gh issue, gh repo view, fractary-core work issue-create), Read, Glob, Grep, AskUserQuestion` |
| `issue-refine-agent` | Agent | `Bash(gh issue), AskUserQuestion` |
| `issue-comment` | Command | `Bash(fractary-core work issue-comment:*)` |
| `issue-create` | Command | `Bash(fractary-core work issue-create:*)` |
| `issue-create-bulk` | Command | `Task(fractary-work:issue-bulk-creator)` |
| `issue-fetch` | Command | `Bash(fractary-core work issue-fetch:*)` |
| `issue-list` | Command | `Bash(fractary-core work issue-search:*)` |
| `issue-refine` | Command | `Task(fractary-work:issue-refine-agent)` |
| `issue-search` | Command | `Bash(fractary-core work issue-search:*)` |
| `issue-update` | Command | `Bash(fractary-core work issue-update:*)` |

### Plugin: docs

| Component | Type | Tools |
|-----------|------|-------|
| `docs-archiver` | Agent | None declared (Bash, gh issue implicit) |
| `docs-auditor` | Agent | None declared (Bash, Read, Glob implicit) |
| `docs-consistency-checker` | Agent | None declared (Bash, Skill implicit) |
| `docs-refiner` | Agent | None declared (Bash, Read, AskUserQuestion implicit) |
| `docs-validator` | Agent | None declared (Bash, Read implicit) |
| `docs-writer` | Agent | None declared (Bash, Skill implicit) |
| `archive/audit/check-consistency/refine/validate/write` | Commands | `Task(fractary-docs:<agent>)` |
| `doc-create/delete/get/list/search/update` | Commands | `Bash(fractary-core docs <cmd>:*)` |
| `type-info/type-list` | Commands | `Bash(fractary-core docs <cmd>:*)` |

### Plugin: logs

| Component | Type | Tools |
|-----------|------|-------|
| `logs-analyze` | Agent | None declared (Bash, Read implicit) |
| `logs-audit` | Agent | None declared (Bash, Read, Glob implicit) |
| `logs-cleanup` | Agent | None declared (Bash implicit) |
| `logs-log` | Agent | None declared (Bash implicit) |
| All 15 commands | Commands | `Bash(fractary-core logs <cmd>:*)` or `Task(<agent>)` |

### Plugin: file

| Component | Type | Tools |
|-----------|------|-------|
| All 5 agents | Agent | None declared (Bash implicit) |
| All 13 commands | Commands | `Bash(fractary-core file <cmd>:*)` or `Task(<agent>)` |

### Plugin: status

| Component | Type | Tools |
|-----------|------|-------|
| `status-install` | Agent | None declared (Bash, Read, Write implicit) |
| `status-sync` | Agent | None declared (Bash implicit) |
| `install` | Command | `Task(fractary-status:status-install)` |
| `sync` | Command | `Task(fractary-status:status-sync)` |

---

## Key Observations

1. **`TodoWrite` is used by**: `workflow-plan` and `workflow-run` commands — these are the only two components still referencing this tool (now renamed to `TaskCreate`/`TaskUpdate` in newer Claude Code versions).

2. **Many agents have NO declared tools**: Especially in docs, logs, file, and status plugins. They rely on inherited/default permissions and call the `fractary-core` CLI via Bash as described in their body text.

3. **`Edit` tool is only used by**: `fractary-core` plugin agents (`cloud-initializer`, `config-initializer`).

4. **`TaskCreate`/`TaskUpdate`** only appear in `workflow-batch-run`.

5. **`SlashCommand`** only appears in `workflow-planner` agent.

6. **`MCPSearch`** only appears in `workflow-run` command.
