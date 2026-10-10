# Workflow Step Reference

The workflow fields that CLI runs (`fractary-faber workflow-execute`) read, and what each one does. The full schema is `config/workflow.schema.json`.

Plugin runs (`/fractary-faber-workflow-run`) ignore the runtime fields: model, harness, turns, budget, tools, permissions and MCP. There, the orchestrating session runs every step itself.

## Step fields

| Field | Type | What it does in a CLI run |
|---|---|---|
| `id` | string | Identifies the step: in run state, `--step`, `--approve` and `autonomy.require_approval_for`. Unique across the merged workflow. |
| `name` | string | Shown in progress output. |
| `prompt` | string | What the step does: a slash command, an instruction, or a shell command prefixed with `!` (no space). `{work_id}`, `{run_id}`, `{phase}` and `{step_id}` are filled in. |
| `role` | `maker` \| `validator` | A `validator` without a valid FABER response block fails; any other step is recorded as a warning. Default `maker`. |
| `result_handling` | object | `on_failure`: `stop` (default), `retry`, `continue` or a slash-command handler. `on_success` and `on_warning` handlers are not run in CLI runs. See [RESULT-HANDLING.md](./RESULT-HANDLING.md#in-cli-runs-workflow-execute). |
| `model` | string | Model for the step's session. For `harness: api` steps it is ignored until [#264] is fixed. |
| `harness` | `claude-code` \| `api` \| `opencode` \| `codex` | `claude-code` (the default) runs an Agent SDK session with tools. `api` sends one Messages API request, with no tools. `opencode` and `codex` are accepted but run as `claude-code` for now. |
| `max_turns` | integer | Most tool-use round trips in the session. Default 25. |
| `max_budget_usd` | number | Agent SDK spending cap for the session. |
| `allowed_tools` | string[] | Tools or rules that run without a permission check, such as `Read` or `Bash(npm test *)`. It does not hide other tools: their calls follow `permission_mode`. |
| `permission_mode` | `acceptEdits` \| `default` \| `plan` \| `dontAsk` \| `auto` \| `bypassPermissions` | How the session handles a tool call that needs permission. Default `acceptEdits`. See the [CLI reference][cli-permissions]. |
| `mcp` | object | MCP servers for the session, keyed by name: `{ "command": "...", "args": [...] }`. |
| `skills` | string[] | Not applied yet ([#263]); every project skill is available. |
| `executor` | object | Legacy provider routing. Not reached in CLI runs ([#246]). |

`context`, `arguments`, `config` and `changelog` are not read in CLI runs. `command` and `skill` are deprecated; use `prompt`.

## Phase fields

| Field | What it does in a CLI run |
|---|---|
| `enabled` | A disabled phase is skipped and recorded as skipped. |
| `pre_steps`, `steps`, `post_steps` | Merged through `extends` into one ordered step list. |
| `require_approval` | The first step of the phase that runs waits for `--approve`. |
| `max_retries` | Retries the phase's steps may use in a run, under `on_failure: retry` or a handler that asks for one. Evaluate defaults to 3, other phases to 0. |
| `result_handling` | Default `on_failure` and the other handlers for the phase's steps. |

## Workflow fields

| Field | What it does in a CLI run |
|---|---|
| `extends` | Inherits from another workflow, such as `faber@fractary-faber:core`. References take the form `plugin@marketplace:workflow`, a project-local name, or `url:https://...`. Steps merge by position. `autonomy.require_approval_for` is the union across the chain. Every other setting comes from the nearest workflow that sets it, field by field within `defaults`, `phase_defaults` and `result_handling`. |
| `prompt` | Workflow-level system prompt, added to every agent step. |
| `defaults` | Runtime fields for every step: `prompt`, `model`, `harness`, `max_turns`, `max_budget_usd`, `allowed_tools`, `skills`, `mcp`, `permission_mode`. |
| `phase_defaults` | The same fields, per phase. |
| `result_handling` | Default handlers for every step. |
| `autonomy.require_approval_for` | Step IDs that wait for `--approve`. |
| `autonomy.pause_before_release` | The first release step waits for `--approve`. |
| `autonomy.level` | Not used as approval: a gated step waits whatever the level. |

A step's runtime fields resolve in this order: the step, then `phase_defaults` for its phase, then `defaults`, then the CLI's `--model` and `--harness`, then the built-in default.

[cli-permissions]: https://github.com/fractary/faber/blob/main/docs/public/cli.md#workflow-execute
[#246]: https://github.com/fractary/faber/issues/246
[#263]: https://github.com/fractary/faber/issues/263
[#264]: https://github.com/fractary/faber/issues/264
