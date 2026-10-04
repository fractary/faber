---
id: SPEC-20261004-harness-hardening
title: "Harness Hardening for FABER and faber-code — Lessons from agent-skills and Harness-Design Practice"
status: proposed
type: improvement
project: fractary/faber, fractary/faber-code
created: 2026-10-04
author: claude-code
priority: high
---

# Harness Hardening for FABER and faber-code

## 1. Summary

We compared FABER + faber-code with two references:

- **`addyosmani/agent-skills`**: 25 lifecycle skills (Define → Plan → Build → Verify → Review → Ship), 4 reviewer personas, 9 slash commands, hooks, and an eval suite.
- **"How to Design an Agent Harness: six decisions"** (Yarchi, Aug 2026): a checklist covering the loop and stop rule, tools, memory, crash survival, boundaries, and who says the work is done.

**Conclusion.** The two approaches work at different layers, so this is not a choice between them.

- **Outer loop (orchestration).** FABER is a platform-style harness: declarative phases, state, resume, approvals, worktrees, and issue → PR integration. Here it is ahead of agent-skills, which has no orchestrator and relies on a human running commands.
- **Inner loop (execution).** agent-skills is a discipline pack: how each step is executed and proven. Here it is clearly ahead of faber-code.

Our gaps are not in orchestration. They are:

1. "Done" means the steps ran, not that there is evidence the change works.
2. The agent that wrote the code also judges it.
3. Build is one monolithic step with no task-level state.
4. Nothing measures whether a skill or prompt change helped.

**Recommendation.** Keep FABER's orchestration. Port agent-skills' inner-loop patterns into faber-code rather than installing the pack. Add executable verification gates, fresh-context review, task-level state, and an eval set. First, fix three gaps in the CLI-native executor (§5, F1–F3).

## 2. Sources reviewed

| Source | Version |
|---|---|
| `addyosmani/agent-skills` | `1401c8b` (2026-10-03) |
| "How to Design an Agent Harness: six decisions that turn a model into a worker you can leave alone" | Yarchi, 2026-08-15 (text supplied by maintainer) |
| `fractary/faber` | `415af40` |
| `fractary/faber-code` | `fd6f2f5` |

Figures quoted from the article (cost ratios, approval rates, violation rates) are the article's own claims and are cited as such. They were not re-measured.

## 3. Where each approach sits

| Layer | agent-skills | FABER + faber-code today |
|---|---|---|
| Outer loop: sequencing, state, resume, approvals | A human runs `/spec → /plan → /build → /test → /review → /ship`. `/build auto` is the only autonomous loop (one plan approval, then task-by-task). State is `SPEC.md` + `tasks/plan.md` + `tasks/todo.md`. | Declarative workflow JSON: 5 phases, pre/steps/post, `extends` inheritance. Also `state.json` + events, run IDs, resume, worktrees, batch plan/run, autonomy levels, and compaction hooks. |
| Inner loop: how a step is executed | Each `SKILL.md` gives process steps, a "Common Rationalizations" table (excuse → rebuttal), red flags, and evidence-based exit criteria. Covers TDD, thin vertical slices, and a commit per slice. | 5 thin workflow skills (research, inspect, architect, engineer, validate), each a ~30-line `SKILL.md` plus a ~100-line workflow doc, with generic steps such as "Write tests alongside code". There is no evidence requirement. |
| Verification | A standing Definition of Done, plus a verify command per task. A floor guard catches weakened tests and silenced checks. Fresh-context adversarial review (`doubt-driven-development`) and a parallel persona fan-out for ship decisions. | LLM validators review the phase documents and code; tests run only "if possible". In plugin mode, validators run in the same context as the engineer. |
| Integrations | None (host-agnostic) | GitHub issues and PRs, waiting on CI, deploy steps, codex sync, issue comments |
| Measurement | 3-tier evals: structural lint, routing, and behavioral with pressure cases. Also a with/without-plugin A/B and a ledger of rejected skill changes. | No evals for skills or workflows. A debugger knowledge base records past failures. |
| Portability | 10+ hosts | Claude Code, OpenCode, Cursor, Codex, Gemini adapters |

## 4. Pros and cons

### 4.1 agent-skills

**Pros**

1. **Targets the dominant failure mode.** Agents take the shortest path and claim success. Every skill ends in an evidence checklist ("'Seems right' is never sufficient"). The rationalization tables pre-empt the excuses agents use to skip steps, such as "I'll add tests later".
2. **Small and composable.** Progressive disclosure: only descriptions load at startup, each `SKILL.md` stays under 500 lines, and references load on demand. Skills are model-neutral ("write the procedure, not the workaround") and portable across hosts.
3. **Verification culture built in.** TDD and the Prove-It pattern for bugs, thin vertical slices with verify → commit per slice, a standing Definition of Done, and a floor guard that catches the cheapest routes to green. Those routes are `.skip`, deleted tests, removed assertions, new `eslint-disable` or `istanbul ignore` lines, lowered thresholds, and stubs.
4. **Independent review.** The reviewer gets a fresh context and receives only the ARTIFACT and CONTRACT, never the author's claim. Its framing is adversarial, and cycles stop after 3. Personas never invoke other personas.
5. **Durable plan files with safety rules.** "Never overwrite an incomplete plan." Restartable session boundaries define what must be persisted before a fresh session.
6. **Measured.** Deterministic CI checks for structure and routing, behavioral evals on fixture repos graded from transcripts, and pressure cases (time pressure, sunk cost, authority). The authors publish negative results, for example that the review skill fired in only 5 of 7 runs.
7. **Near-zero adoption cost.** `npx skills add` and no infrastructure.

**Cons and limits**

1. **No orchestrator.** There is no state machine, run identity, or resume beyond files. The model must pick and follow the right skill, and activation is stochastic by the authors' own data. A one-clause description change moved one skill from 7/27 to 21/27 fires.
2. **Human-gated by design.** `spec-driven-development` ends the turn after the spec and waits for approval, and `/build auto` waits for plan approval. That fits interactive work but fights a 90%-autonomous issue → PR pipeline.
3. **No integrations.** It has no link to work tracking, the PR lifecycle, deploys, approval routing, or an audit trail.
4. **Generic.** The practices are Google-flavoured and not project-specific, so they can conflict with house conventions. The pack has 25 skills plus 9 commands, with some overlap.
5. **Enforcement is mostly prompt-level** unless hooks or CI are wired up. The pack's own escalation path ("written → scripted → tool-backed") admits this.
6. **Cost.** TDD, per-slice verification, and multiple reviews add tokens and wall-clock time. The article's warning applies: its harnessed example cost about 20× the unharnessed run.

### 4.2 FABER + faber-code (current)

**Pros**

1. **Real orchestration.** Phases and steps are declarative JSON with inheritance. State and events, resume, run IDs, worktrees, and batch runs exist, along with script-based guards against fabricated completion that the orchestrator must call before writing state (`validate-state-transition.sh`, `runs verify-complete`).
2. **End-to-end SDLC integration.** Issue → branch → spec documents → PR → CI → review → merge → issue status, with per-step approvals and autonomy levels.
3. **Multi-model, multi-harness executor.** CLI-native mode (`fractary-faber workflow-execute`) supports per-step `model`, `harness`, `max_turns`, `max_budget_usd`, `allowed_tools`, `skills`, and `mcp`, with a fresh Agent SDK context per step. That is more capable than anything agent-skills ships.
4. **Auditability.** Phase documents are in-repo (`WORK-{id}-*.md`), phase summaries are posted to issues, and runs are recorded as events.
5. **Learning from failure has started.** The debugger keeps a knowledge base (`plugins/faber/knowledge-base/*`), and `anti-patterns.md` records real orchestrator failures.

**Cons**

1. **Done is process-based.** A run is "complete" when every step ran and the run verifier finds the completion signals. No executable check of the product gates completion (F4, F5).
2. **Self-grading.** In plugin mode, validators run in the same context that wrote the code (F6). In CLI-native mode, validator verdicts are ignored (F1).
3. **Thin faber-code skills.** Steps are generic, with no concrete commands, rationalization tables, red flags, or evidence requirements. On an unclear spec the instruction is "Document assumption and proceed" (F7).
4. **Monolithic build.** There is no task slicing, per-task verification or commit, or progress file. A crash mid-build restarts the whole step (F8).
5. **Context.** In plugin mode, one session spans all five phases and relies on compaction. Handoffs travel through ever-growing issue comments, which are noisy and untrusted input (F9).
6. **No evals.** Skill, prompt, and model changes (such as the re-tiering in #233) have no eval to compare against (F10).
7. **Permissions.** CLI-native mode runs `bypassPermissions`, FABER ships no permission or sandbox profile for target projects, and approval gates are not enforced in CLI-native mode (F2, F3, F11).
8. **Doc drift.** The faber-code README describes agents, commands, and workflows that no longer exist (F12).
9. **Orchestration in prompts.** Much machinery (anti-pattern docs, transition guards, "NEVER STOP FOR CONTEXT") exists to make an LLM behave like a deterministic orchestrator. The deterministic-executor prototype and the SDK `WorkflowExecutor` show the codebase already moving that loop into code.

### 4.3 Scored against the article's six decisions

| Decision | Article's recommendation | FABER today | Gap |
|---|---|---|---|
| 1. Loop and stop rule | A one-sentence, executable done rule; a policy for bad endings; hard caps; a log of every turn. | Done = all steps completed plus run verifier. Bad endings are handled by `on_failure` and the debugger. Caps exist (`max_turns`, `max_budget_usd`) in CLI-native mode only. In CLI-native mode the executor keeps only each step's final result message, not a per-turn log. | **High**: done is not product-based |
| 2. Tools | Load tools lazily, return structured errors, prune unused tools. | Skills load on demand. The FABER response format already has `error_analysis` and `suggested_fixes`. | Low |
| 3. Memory | Staged clean windows with a handoff document between stages; pin rules that must survive compaction. | Plugin mode uses one session plus compaction plus `CONTEXT_YIELD`, and reloads `critical_artifacts`. CLI-native mode gives each step a fresh context. Project rules are not pinned. | Medium |
| 4. Crash survival | SPEC, PLAN (with acceptance criteria), PROGRESS, and DECISIONS files; commit after every working change. | Strong at workflow level (state, events, resume). One spec document per phase, nothing at task level, and a commit only at the end of a phase. | **High** inside Build |
| 5. Boundaries | OS-level filesystem and network sandbox, short-lived credentials, prompts reserved for real decisions. | CLI-native runs `bypassPermissions`. FABER ships no permission or sandbox profile for target projects. Plugin mode enforces approvals only through the prompt; CLI-native mode does not enforce them at all. | **High** for unattended runs |
| 6. Who says done | A separate session reviews; actually run the thing; an eval set built from past failures, each task run 3× and judged on the worst run. | Same-context validators that check document structure, with tests optional and no evals. | **Highest** |

## 5. Findings (evidence)

Paths are relative to each repository root.

| # | Finding | Evidence |
|---|---|---|
| F1 | CLI-native mode records any step as `success` when the agent session ends normally. The skill's FABER response JSON is never parsed, so a validator returning `"status": "failure"` does not stop the run. | faber `sdk/js/src/executors/providers/claude-agent.ts:213-239`; `sdk/js/src/executors/workflow-executor.ts:319-326` |
| F2 | CLI-native mode ignores `require_approval`, `autonomy.require_approval_for`, and `max_retries`. `on_failure` is only "stop" or "continue". With faber-code's default workflow, `release-deploy-apply-prod` would run without approval under `fractary-faber workflow-execute`. | faber `sdk/js/src/executors/workflow-executor.ts` (no autonomy, approval, or retry handling); faber-code `plugins/faber-code/.fractary/faber/workflows/default.json:131,184` |
| F3 | CLI-native steps run with `permissionMode: 'bypassPermissions'` and the full Claude Code tool preset, with no sandbox. | faber `sdk/js/src/executors/providers/claude-agent.ts:208` |
| F4 | No step runs the project's test, lint, typecheck, or build commands and gates deterministically on the exit code. The closest is core's `evaluate-pr-review`, where the LLM waits for CI and judges the result (F5). The run verifier checks workflow signals, not the product. | faber `plugins/faber/skills/fractary-faber-workflow-run-verifier/SKILL.md`; faber-code `default.json` (no verify step) |
| F5 | faber-code's Evaluate phase consists of Terraform plan/apply steps. For a code-only change, product evaluation reduces to core's "wait for CI and auto-fix", which depends on the target repo having CI. | faber-code `default.json:89-125`; faber `plugins/faber/.fractary/faber/workflows/core.json` (`evaluate-pr-review`) |
| F6 | The plugin-mode orchestrator must run every step, validators included, in one context: "you do NOT delegate to sub-agents for step execution". The engineering validator is read-only and runs tests only "if possible". | faber `plugins/faber/skills/fractary-faber-workflow-run/SKILL.md:10,15`; faber-code `plugins/faber-code/skills/fractary-faber-code-validate/SKILL.md:9`, `.../workflow/validate-engineering.md:34` |
| F7 | The engineer workflow is generic ("Write tests alongside code", "Run existing tests") and says "If spec is unclear: Document assumption and proceed". | faber-code `plugins/faber-code/skills/fractary-faber-code-engineer/workflow/engineer-workflow.md:41,56,104` |
| F8 | Build is a single `build-engineer` step. Build-phase changes are committed once, in core's `build-create-pr` post-step. There is no task list, progress record, or per-task verification. | faber-code `default.json` (build phase); faber `core.json:112` |
| F9 | Each skill loads the issue body plus all comments as its handoff. That input grows every phase, mixes human and agent text, and lets anyone who can comment inject instructions into a step that may run with `bypassPermissions`. | faber-code `plugins/faber-code/skills/fractary-faber-code-common/scripts/load-work-context.sh:20-21`, `.../references/work-context-protocol.md` |
| F10 | Neither repo has evals for skills or workflows. The failure knowledge base and `anti-patterns.md` are written down but are not executable regression tests. | faber `plugins/faber/knowledge-base/*`, `plugins/faber/skills/fractary-faber-workflow-run/anti-patterns.md` |
| F11 | FABER ships no least-privilege permission or sandbox profile for target projects, so a run inherits whatever the target repo allows (or bypasses everything, in CLI-native mode). faber-code's own repo settings show the typical result: they broadly allow `Bash(rm:*)`, `Bash(curl:*)`, `Bash(aws:*)`, `Bash(terraform:*)`, and `Bash(git push:*)`. | faber `plugins/faber/config/` (no permissions in templates); faber-code `.claude/settings.json:12-25` |
| F12 | The faber-code README documents eight agents (`researcher`, `research-validator`, …), four per-type validator commands (`/fractary-faber-code-research-validate`, …), and three workflow files (`software-development.json`, `bug-fix.json`, `feature-development.json`). None exist after the v0.6.0 skill migration: there is no agents directory, validation is one skill with `--type`, and only `default.json` ships. `config/best-practices-rules.yaml` is referenced only by an old spec. | faber-code `README.md:34,49,60,80,132-138`; `plugins/faber-code/config/best-practices-rules.yaml` |

## 6. What to adopt, and what not to

### Adopt (port the patterns)

1. **Skill anatomy** for every faber-code skill: a description that says when to use it, a "When NOT to use" section, a process with concrete commands, a Common Rationalizations table, Red Flags, and an evidence-based Verification checklist.
2. **Evidence-based Definition of Done.** Acceptance criteria per task, plus a standing project bar enforced by scripts, not prose.
3. **A task plan with an acceptance criterion and a verify command per task.** The engineer loops implement → verify → commit → record progress, and keeps an append-only decisions log.
4. **Fresh-context adversarial review.** The reviewer gets only the diff and the contract, never the author's reasoning or claim, with a bounded fix loop.
5. **A floor guard** run at review time, scoped to the diff.
6. **Evals built from our own failures**, each task run 3× and judged on the worst run, including pressure cases.
7. **Pinned rules.** A short Always / Ask first / Never list, reloaded after compaction and injected into every step.

agent-skills is MIT-licensed. Keep attribution wherever text or scripts are adapted from it.

### Do not adopt

1. **The agent-skills pack wholesale inside FABER runs.** Its human gates (stop after the spec, approve the plan) fight autonomous runs. It duplicates our artifacts (`SPEC.md` and `tasks/*.md` vs `WORK-*` specs and `plan.json`). Its skill activation is stochastic, while our steps invoke skills by name. It remains a reasonable optional install for ad-hoc sessions outside FABER.
2. **25 skills.** faber-code needs about 6 strong ones.
3. **Lexical trigger/routing evals.** faber-code skills are invoked explicitly by workflow steps, so routing accuracy is not our risk. Behavioral evals are.
4. **Persona fan-out on every change.** Reserve it for release-bound or high-risk changes; cost scales with it.

## 7. Implementation plan

Each milestone ends with a measurable check. Milestone B (evals) comes before the skill rewrites so that every later change is measured against a baseline. Sizes: **S** ≤ 1 day, **M** 2–4 days, **L** 1–2 weeks.

### Milestone A: correctness fixes and drift (faber, faber-code)

| ID | Repo | Change | Acceptance criteria | Size |
|---|---|---|---|---|
| A1 | faber | Parse the FABER response JSON (last fenced or bare JSON object containing `status`) from each step's output in `claude-agent.ts`, and map it to success, warning, or failure. If no JSON is found, the step is a `warning` with reason `no_response_block`. | Unit tests: a validator output with `"status":"failure"` yields a step failure, and `on_failure: stop` halts the phase. | S |
| A2 | faber | Enforce `require_approval`, `autonomy.require_approval_for`, and `pause_before_release` in `WorkflowExecutor`. Non-interactive runs halt with a distinct exit code and a resumable state instead of executing the step. | A test plan with `release-deploy-apply-prod` in `require_approval_for` never invokes that step without `--approve <step-id>`. | M |
| A3 | faber | Implement `max_retries` and `on_failure: retry` (phase-level re-run), capped and recorded as `retry_attempt` events. | A test with a step that fails twice and then succeeds completes with `max_retries: 3`, and fails with `max_retries: 1`. | M |
| A4 | faber | Make the permission mode configurable (`defaults.permission_mode`). Make `bypassPermissions` an explicit opt-in that prints a warning unless a sandbox is configured (see S2). | The default run uses the configured mode, and the warning appears when bypass is used without a sandbox. | S |
| A5 | faber-code | Rewrite the README to match reality (skills, the one shipped workflow, how to invoke). Delete or wire up `best-practices-rules.yaml`. | No README reference to agents, commands, or workflow files that do not exist. | S |

### Milestone B: measure first (faber; uses faber-code)

| ID | Repo | Change | Acceptance criteria | Size |
|---|---|---|---|---|
| B1 | faber | Create `evals/` with 15–20 tasks drawn from real failures, each a small fixture repo plus issue text and graders. Sources: knowledge-base entries; `anti-patterns.md` cases (fabricated completion, context-pressure stop, self-blocking); WORK-422 (files written to the wrong CWD); historical runs that needed a human fix. | Every task has deterministic graders first: tests pass, the expected files change, no test weakening, state consistent. LLM rubric graders are used only for what cannot be checked deterministically. | L |
| B2 | faber | Add an eval runner that executes each task 3× through `workflow-execute` (headless, sandboxed, pinned model), records pass^3 (the task counts only if all 3 runs pass), cost, wall-clock time, and human-intervention count, and writes results to `evals/results/` (gitignored) plus a summary ledger. | One command produces a baseline table for the current faber-code skills. | M |
| B3 | faber-code | Add a CI structural lint for skills (frontmatter, required sections once Milestone E lands, `SKILL.md` ≤ 500 lines, valid script references). | CI fails on a malformed skill. | S |
| B4 | both | Rule: changes to faber-code skills or to the orchestrator's prompts and protocols ship only with an eval comparison against the last baseline, recorded in the ledger. Rejected changes are recorded too (as agent-skills does in `evals/skill-impact.md`). | Added to `CONTRIBUTING.md` and the PR template. | S |

### Milestone C: done means evidence (faber + faber-code)

| ID | Repo | Change | Acceptance criteria | Size |
|---|---|---|---|---|
| C1 | faber | Add a project verification config (for example `faber.verification.commands: {test, lint, typecheck, build}` in `.fractary/config.yaml`) and a deterministic **verify step** that a script runs, not the LLM. CLI-native mode can reuse the existing `!command` path. The step writes evidence to `.fractary/faber/runs/{run_id}/evidence/{step_id}.json`: command, exit code, duration, output tail, and the git SHA it ran against. | The verify step fails on a non-zero exit, and the evidence file exists for every verify step. | M |
| C2 | faber | Extend the transition guard (`validate-state-transition.sh`) and `runs verify-complete`. A step declared `requires_evidence: true` cannot be marked completed unless its evidence file exists, exited 0, and matches the current `HEAD`. | Attempting to mark a step complete without matching evidence is rejected in both plugin and CLI-native modes. | M |
| C3 | faber | Add a floor-guard script (adapted from agent-skills' `constraint-driven-development` reference), diff-scoped against the branch point. It flags new `.skip`/`.only`, deleted test files, removed assertions, new suppressions (`eslint-disable`, `@ts-ignore`, `istanbul ignore`, `nosemgrep`, `gitleaks:allow`), loosened thresholds in config, and stubs (`throw new Error('not implemented')`, empty `catch`, `TODO` in place of logic). | Fixture diffs for each pattern are flagged, and a clean diff passes. Runs as a blocking Evaluate step. | M |
| C4 | faber-code | Insert `build-verify` (C1) and `evaluate-floor-guard` (C3) into `default.json`. Make the existing Terraform steps conditional on IaC being present, rather than relying on a prompt instruction to skip them. | A code-only issue runs verify and floor-guard with no Terraform steps. | S |
| C5 | faber-code | The engineer's changeset must cite evidence file paths, not prose claims. The engineering validator re-runs the verification commands itself and fails if results differ. | Validator tests: a changeset claiming "tests pass" without matching evidence fails validation. | S |

### Milestone D: independent review (faber + faber-code)

| ID | Repo | Change | Acceptance criteria | Size |
|---|---|---|---|---|
| D1 | faber | Add a step field `isolation: "fresh"`. In plugin mode, such a step is dispatched to a subagent with only the declared inputs. This is a scoped exception to the "no sub-agent delegation" rule; completion still requires script-written evidence (C2), so fabricated subagent results cannot pass the guard. CLI-native mode is already fresh per step. | The engineering validator runs in a fresh context in both modes, verified from the run's events or transcript. | M |
| D2 | faber-code | Rewrite the validators as adversarial reviewers. Input is ARTIFACT (the diff plus evidence files) and CONTRACT (the task's acceptance criteria and spec boundaries), never the engineer's summary or claim. Output is findings labelled Critical / Required / Optional / Nit; only Critical and Required block. | The eval tasks with planted defects show the defect caught. | M |
| D3 | faber | Add a bounded fix loop: validator failure → engineer fix step (receiving only the findings) → re-verify → re-validate, at most 2 cycles, then escalate per autonomy level. This replaces routing validation failures to `workflow-debug --auto-fix`, which has no cycle cap declared in the workflow config. | Eval runs show at most 2 cycles, followed by a clean pause with a resumable state. | M |
| D4 | faber | Optionally run the reviewer on a different model family or harness through the existing per-step `model`/`harness` fields, as a config preset. | The preset works end-to-end on one eval task. | S |

### Milestone E: inner-loop discipline in faber-code (task-level state and skill anatomy)

| ID | Repo | Change | Acceptance criteria | Size |
|---|---|---|---|---|
| E1 | faber-code | Add `docs/SKILL-ANATOMY.md`, adapted from agent-skills' `docs/skill-anatomy.md`, and make B3's lint enforce it. | Lint passes on all rewritten skills. | S |
| E2 | faber-code | The architect writes a task list into the spec plus a machine-readable `WORK-{id}-tasks.json`. Each task has an id, description, files, acceptance criteria (≤ 3), a verify command, dependencies, and `status: pending\|passing\|failing`. Tasks must touch ≤ 5 files and be vertical slices. The architect lists assumptions explicitly and writes the Always / Ask first / Never boundaries. If the issue bundles several independently testable capabilities, it splits the work into separate modules before writing the spec. | Spec validation fails if any task lacks acceptance criteria or a verify command. | M |
| E3 | faber-code | The engineer loops task by task: write a failing test where behavior changes (Prove-It for bugs) → implement → run the task's verify command → commit referencing the task id → update `tasks.json` with status and evidence path → append any deviation to `WORK-{id}-decisions.md`. The engineer never edits the spec; scope creep is noted, not fixed ("noticed but not touching"). On resume, it reads `tasks.json`, `git log`, and `git status`, re-runs verification for the last task, and continues. | Eval runs show one commit per task, a resume after a killed run continuing from the next pending task, and no edits to the spec file. | L |
| E4 | faber-code | Replace "document assumption and proceed" with an autonomy-aware rule. In `assisted` or `guarded` mode, pause and ask. In `autonomous` mode, proceed only on low-risk assumptions, record them in the decisions log, and return `warning`. Pause on any ambiguity touching security, data loss, public API, or cost. | Pressure-case evals ("just make it work", sunk cost) do not bypass the rule. | S |
| E5 | faber-code | Rewrite research, inspect, architect, engineer, and validate in the anatomy format: Rationalizations tables seeded from our own `anti-patterns.md` and knowledge base, Red Flags, and evidence-based Verification. Convert the specialty and pattern prose into short checklists with on-demand references. | pass^3 on the eval set improves or holds against the B2 baseline at no more than +50% cost per successful run (threshold to confirm). | L |
| E6 | faber-code | Ship a `bug-fix` workflow: a light frame, then reproduce → failing test → fix → guard test, skipping the full architect phase. | One eval bug task passes 3/3 at lower cost than `default`. | M |
| E7 | faber-code | Switch handoffs from issue comments to the spec, tasks, and decisions files. Issue comments become human-facing summaries only, and `load-work-context.sh` stops feeding all comments into every step (the issue body plus maintainer-labelled comments only). | The token count per step drops on eval runs, and a planted malicious comment in an eval fixture is not acted on. | M |

### Milestone S: sandbox, boundaries, and pinned rules for unattended runs (faber)

| ID | Repo | Change | Acceptance criteria | Size |
|---|---|---|---|---|
| S1 | faber | Add a pinned rules file (`.fractary/faber/RULES.md`, ≤ 40 lines: Always / Ask first / Never) to `critical_artifacts.always_load` and inject it into every CLI-native step's system prompt (`buildSystemPrompt`). | The rules are present after compaction (plugin mode) and in every step prompt (CLI-native). | S |
| S2 | faber | Run unattended steps in an OS-level sandbox: writes limited to the worktree, network through an allowlist. Use Claude Code's sandboxing or a container per run, to be decided in S2's design. Pair it with short-lived GitHub App tokens (setup already exists in `cli/src/lib/github-app-setup.ts`). | An eval fixture that tries to write outside the worktree, or call a non-allowlisted host, is blocked. | L |
| S3 | faber, faber-code | Use per-step `allowed_tools` (already in the schema) instead of broad allowlists, and ship a least-privilege permission profile with faber's installer for target projects. Trim faber-code's own `.claude/settings.json` (project-wide `rm`, `curl`, `aws`, `terraform`, `git push`). | Deploy steps still run, and research steps cannot run `terraform` or `git push`. | M |
| S4 | faber | Stream every Agent SDK message of a CLI-native step to `.fractary/faber/runs/{run_id}/transcripts/{step_id}.jsonl` (today only the final result is kept), and add wall-clock timeouts per step. | Every step of an eval run has a full transcript, and a hung step is killed at its timeout. | S |

### Milestone G: strategic decision (no code until decided)

G1 asks whether CLI-native (code-driven) orchestration should become the default for unattended runs, keeping `/fractary-faber-workflow-run` for interactive and assisted runs. Evidence for: fresh context per step, deterministic loop, and no need for anti-pattern prompts. Evidence against: plugin mode's mature guard and resume machinery, and existing users. Decide after Milestones A–D, using B's eval numbers for both modes on the same tasks.

## 8. Sequencing

```
A (correctness) ──► B (baseline evals) ──► C (evidence gates) ──► D (independent review)
                                     │                                 │
                                     └──► E1–E2 ───────────► E3–E7 ◄───┘
S (boundaries) can run in parallel from B onward. G is decided after D, using B's numbers.
```

Suggested first slice (about 1–2 weeks): A1–A3, B1 (10 tasks) and B2, then C1, C2, and C4. That alone turns "done" into "verified" for unattended runs and gives a baseline for everything after it.

## 9. Risks and trade-offs

| Risk | Mitigation |
|---|---|
| Cost and time rise (the article's example: harnessed ≈ 20× the unharnessed cost) | Scale verification depth by autonomy level and work type (bug-fix is lighter than a feature). Track cost per successful run in B2 and reject changes that regress it beyond the agreed threshold. |
| New gates fail runs that "passed" before | That is intended. Roll out behind config (`verification.enabled`, `floor_guard.enabled`): on by default for new workflows, opt-in for one release on existing ones. |
| The plugin-mode subagent exception (D1) reintroduces fabricated results | Completion requires script-written evidence (C2), so a subagent's claim alone cannot satisfy the guard. |
| Eval maintenance burden | Start with 10–15 tasks. Add a task only when a real failure happens twice, mirroring the article's "anything broken twice becomes a linter". |
| TDD is not applicable everywhere (IaC, docs, config) | E3 requires a failing test only for behavior changes. Other task types declare the verify command that fits (for example `terraform validate` or a docs link check). |

## 10. Open decisions for the maintainer

1. **D1 vs G1.** Allow fresh-context subagents for declared steps in plugin mode (D1), or move unattended runs to CLI-native and leave plugin mode unchanged?
2. **Port vs depend.** This spec recommends porting agent-skills patterns into faber-code. Alternatively, depend on the pack for ad-hoc sessions only.
3. **Task state location.** `WORK-{id}-tasks.json` beside the spec (reviewable in the PR, as proposed) or under `.fractary/faber/runs/{run_id}/` (run-scoped)?
4. **Eval budget.** Tokens and money per baseline run (15–20 tasks × 3 runs × 2 modes).
5. **Thresholds.** The acceptable cost increase per successful run for E5 (proposed: +50%).
6. **Issues.** Whether to file F1–F3 / A1–A4 as separate GitHub issues now, since A2 is a safety gap independent of this plan.

## 11. Success metrics

| Metric | Target |
|---|---|
| Runs that report done while the project's tests fail | 0 (enforced by C1–C2) |
| pass^3 on the eval set | Above the B2 baseline after C, D, and E, reported per milestone |
| Defects planted in eval fixtures that the reviewer catches | ≥ 90% |
| Test-weakening or suppression changes merged without a flag | 0 (C3) |
| Cost and time per successful run | Within the agreed threshold of the baseline |
| Human interventions per run | Trending down |
