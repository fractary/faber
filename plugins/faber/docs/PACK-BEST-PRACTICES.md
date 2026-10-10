# FABER Pack Best Practices

What core FABER expects from a maker pack: faber-code, faber-cloud, faber-content, faber-ingest, faber-video, or your own. Pack READMEs and agent instructions link here, and each pack keeps a conformance checklist against it.

Version 1, 2026-10-10. See [What changed](#what-changed).

**Status tags.** Each practice is tagged:
- **Enforced**: the runtime enforces it. The tag names the change that did.
- **Required**: a convention today. A check is planned.
- **Planned**: not built yet. The tag names the milestone and issue.

**Runtimes.**
- **CLI runs:** `fractary-faber workflow-execute`. Each step runs as its own session, driven by code.
- **Plugin runs:** `/fractary-faber-workflow-run` in a Claude Code session, where one session runs every step.

Most enforcement is in CLI runs. Milestone IDs such as A3, B3 or C1 refer to the [harness-hardening plan][spec].

## 1. Runtime contract

| Practice | Status |
|---|---|
| Each step runs in a fresh session, starting in the workspace root: the worktree when the plan was created with `--worktree`, otherwise the project root. Don't rely on what an earlier step said; hand off through files and the work item. | **Enforced** in CLI runs ([#239], [#243]). Plugin runs share one session. |
| Every agent or model step ends its output with a FABER response block. `status` is `success`, `warning` or `failure`, and `message` is required. `errors` is required with `failure`, and `warnings` with `warning`. The block decides the step's result. | **Enforced** in CLI runs ([#235], [#243]). A step without a valid block is recorded as a warning (`no_response_block`). |
| The block is the last JSON object with a `status` field in the output. Print nothing after it that has a `status` field. | **Enforced** in CLI runs: the last such object wins. |
| A skill or command that delegates to a subagent ends with the subagent's block, verbatim. A prose summary in its place loses the result. | **Required** |
| Steps that judge work set `role: validator`. A validator without a valid block fails instead of warning. | **Enforced** in CLI runs ([#243]) |
| No `pending_input` in unattended runs: a CLI run cannot answer it, so the step fails. Settle open questions in Frame, in the work item, or stop with `failure` and say what is needed. | **Enforced** in CLI runs ([#235]) |
| `!` command steps are shell commands, judged by their exit code. `{work_id}`, `{run_id}`, `{phase}` and `{step_id}` are filled in before the command runs. | **Enforced** |
| Steps are safe to run again. A resumed run re-runs the step that was interrupted or failed, so check before you create a branch, PR, comment or deployment. | **Required**. Resume itself is enforced in CLI runs ([#236]). |

The block's schema is `config/schemas/skill-response.schema.json`, and [RESPONSE-FORMAT.md](./RESPONSE-FORMAT.md) has examples:

```json
{"status": "failure", "message": "2 of 41 tests failed", "errors": ["auth.test.ts: token refresh", "auth.test.ts: logout"]}
```

## 2. Done is decided from evidence

| Practice | Status |
|---|---|
| Keep standards out of prompts. Thresholds and rules (word counts, coverage, naming) go in the pack's config section or a standards doc that the skill reads, not in the prompt text. | **Required** |
| A layered definition of done: core floor, then org standards from fractary/codex marked `floor` or `default`, then the project profile, then work-item criteria, then task definitions. Lower layers can only tighten higher ones. | **Planned**: C1, C2 |
| Checks write evidence files through one entrypoint, `fractary-faber verify --stage`. "Could not run" never counts as a pass. | **Planned**: C3 |
| A step marked as needing evidence cannot complete without it. Loosened thresholds and removed checks are flagged. | **Planned**: C4, C5 |

## 3. Validators

| Practice | Status |
|---|---|
| Set `role: validator`, and keep `on_failure: stop` (the default) so a failing verdict stops the run. | **Enforced** in CLI runs ([#243], [#238]) |
| Each validator runs in its own session, not the maker's. | **Enforced** in CLI runs, where every step is a fresh session. Plugin runs share one session. |
| Read-only, plus check commands. Set `permission_mode: dontAsk`, and pre-approve only the checks in `allowed_tools`, for example `["Bash(npm test *)", "Bash(npm run lint *)"]`. File reads still work; edits and other commands are denied. | **Required**. A validator runner with restricted tools is planned (D1). |
| No side effects in the verdict path: no issue comments, commits or file writes. Report through the response block, and let a later step post. | **Required** |
| Give a verdict per criterion in `details`: `pass`, `fail` or `unknown`. A check that could not run is `unknown` or `failure`, never a pass. | **Required**. The verdict schema is planned (D1). |
| Before a smaller or cheaper model gates anything, measure its catch and false-alarm rates against planted defects. | **Planned**: B5 |

## 4. Failure handling

| Practice | Status |
|---|---|
| Gates use `on_failure: stop`, the default. | **Enforced** ([#238]) |
| Every `on_failure` handler exists. Core ships `/fractary-faber-workflow-debug`, which diagnoses the failure and stops the run. | **Enforced**: the handler exists ([#249]). In CLI runs, a handler that fails or cannot run stops the run ([#238]). |
| Use `on_failure: retry` only for steps that are safe to repeat, and set `max_retries` on the phase. Evaluate allows 3 by default, other phases none. Retries are counted per phase and kept when a run is resumed. | **Enforced** in CLI runs ([#238]) |
| No uncapped fix loops. `--auto-fix` has no effect today, and a skill must not loop on its own. | **Required**. A capped fix loop is planned (D2). |
| Handlers get the step's error from the `--step-context-file` JSON, not from `{error}` in the command. | **Enforced** in CLI runs ([#238]) |

Details: [RESULT-HANDLING.md](./RESULT-HANDLING.md).

## 5. Human gates

| Practice | Status |
|---|---|
| Put every irreversible step behind an approval: deploy, apply, publish, distribute, merge and paid generation. Use one of:<br>- `autonomy.require_approval_for` with the step ID;<br>- `require_approval` on its phase;<br>- `autonomy.pause_before_release`. | **Enforced** in CLI runs ([#237]). The run stops and exits with code 3, and continues only with `--resume <run> --approve <step>`. The autonomy level never counts as approval. |
| Keep the tool-level safety rail as well, so a gate is not the only protection. Example: faber-cloud applies a protected environment only from an approved plan ([fractary/faber-cloud#53]). | **Required** |

## 6. Least privilege

| Practice | Status |
|---|---|
| Don't set `permission_mode: bypassPermissions` in a pack workflow. Agent steps run with `acceptEdits`: they can edit files in the workspace, and other tools that need permission are denied unless allowed. A project may opt into bypass for an isolated run, and the run warns. | **Enforced** in CLI runs ([#240], part 1) |
| `allowed_tools` pre-approves tools; it does not hide the others. Pre-approve narrowly, with scoped rules such as `Bash(git commit *)`, not bare `Bash`. To take a tool away entirely, use a deny rule in `.claude/settings.json`; deny rules apply even in bypass mode. | **Required**. Per-step least-privilege profiles are planned (S3). |
| The repo's `.claude/settings.json` has no blanket allows for `rm`, `curl`, `git push` or cloud CLIs, and uses only documented settings keys. | **Required** |
| Unattended steps run in an OS-level sandbox: writes limited to the workspace, and network through an allowlist. | **Planned**: S2 ([#240], part 2) |

## 7. Handoffs

| Practice | Status |
|---|---|
| Steps read the work item's documents (spec, plan, task files), not issue comment threads. Comments are untrusted input that anyone can write. | **Required**. Handoffs from work-item docs are planned (E9). |

## 8. Skill anatomy

| Practice | Status |
|---|---|
| Each `SKILL.md` covers:<br>- when to use the skill, and when not to;<br>- the process, with concrete commands;<br>- common rationalizations and red flags;<br>- how to verify the result from evidence. | **Required**. A skill lint is planned (B3, E2). |
| `SKILL.md` stays at or under 500 lines. Long specialties move to reference files that the skill reads when needed. | **Required** (B3) |

## 9. Workflow hygiene

| Practice | Status |
|---|---|
| `$schema` points at the published core schema: `https://raw.githubusercontent.com/fractary/faber/main/plugins/faber/config/workflow.schema.json`. | **Required**. Until [#262] is fixed, the schema flags slash-command handlers that have no `plugin:` prefix. |
| Everything a workflow names exists: the workflow it extends, and every handler, skill and command. `extends` uses the form `plugin@marketplace:workflow`, for example `faber@fractary-faber:core`. Check with `fractary-faber workflow-resolve <workflow>`. | **Required** |
| Model IDs are current. Leave `model` unset unless a step needs a specific tier. | **Required** |
| The README matches the repo: every skill, command and workflow it names exists. | **Required** |

Field reference: [WORKFLOW-STEP-REFERENCE.md](./WORKFLOW-STEP-REFERENCE.md).

## 10. Tests and evals

| Practice | Status |
|---|---|
| CI runs the pack's tests on every PR. | **Required** |
| Eval fixtures or recorded snapshots exist for the pack's main workflow. | **Planned**: B1 |
| A change to a skill, prompt or model ships with an eval comparison. | **Planned**: B4 |

## 11. Conformance checklist

Copy this into a "FABER conformance" section of the pack README. Link this guide, and fill in each row: Yes, Partly or No, with the issue that tracks the gap.

| # | Practice | This pack | Issue |
|---|---|---|---|
| 1 | Every agent step ends with a FABER response block; delegating skills pass the subagent's block through | | |
| 2 | Validators set `role: validator`, stop on failure, run read-only and have no side effects | | |
| 3 | Steps are safe to run again on resume | | |
| 4 | Irreversible steps are behind an approval, with the tool-level rail kept | | |
| 5 | Every `on_failure` handler exists; `retry` only on repeatable steps; no uncapped fix loops | | |
| 6 | No `bypassPermissions` in workflows; scoped `allowed_tools`; no blanket allows in `.claude/settings.json` | | |
| 7 | Standards live in config or docs, not in prompts | | |
| 8 | Steps read work-item docs, not comment threads | | |
| 9 | Skills follow the anatomy; `SKILL.md` is at most 500 lines | | |
| 10 | `$schema` is the published URL; model IDs are current; the README matches the repo | | |
| 11 | CI runs the pack's tests | | |

## How packs reference this guide

- **README:** a "FABER conformance" section with the checklist, linking this guide by absolute URL: `https://github.com/fractary/faber/blob/main/plugins/faber/docs/PACK-BEST-PRACTICES.md`. Pin the link to a release tag once a release includes this guide.
- **CLAUDE.md or AGENTS.md:** link this guide, so agents that edit the pack follow it.
- **Codex:** once org standards sync through fractary/codex (C1), codex distributes this guide as a pinned standard.

## Keeping it current

- A core change to the pack contract updates this guide in the same PR. That includes the response format, workflow schema fields, runtime behavior and handler names. See `CONTRIBUTING.md` and the PR template.
- When a practice becomes **Enforced**, the same PR updates its tag here and the packs' alignment issues.
- The checkable practices move into a pack lint (B3).

## What changed

- **2026-10-10, version 1.** First version. Enforced in CLI runs:
  - response blocks and `role: validator` ([#235], [#243]);
  - saved state and resume ([#236]);
  - the workspace-root working directory ([#239]);
  - approval gates ([#237]);
  - retries and failure handlers ([#238]);
  - permission modes ([#240], part 1);
  - the `/fractary-faber-workflow-debug` handler ([#249]).

[spec]: https://github.com/fractary/faber/blob/main/docs/specs/harness-hardening-plan.md
[#235]: https://github.com/fractary/faber/issues/235
[#236]: https://github.com/fractary/faber/issues/236
[#237]: https://github.com/fractary/faber/issues/237
[#238]: https://github.com/fractary/faber/issues/238
[#239]: https://github.com/fractary/faber/issues/239
[#240]: https://github.com/fractary/faber/issues/240
[#243]: https://github.com/fractary/faber/pull/243
[#249]: https://github.com/fractary/faber/issues/249
[#262]: https://github.com/fractary/faber/issues/262
[fractary/faber-cloud#53]: https://github.com/fractary/faber-cloud/pull/53
