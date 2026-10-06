---
id: SPEC-20261004-harness-hardening
title: "Harness Hardening for FABER (all maker packs) and faber-code"
status: proposed
type: improvement
project: fractary/faber, fractary/faber-code
created: 2026-10-04
updated: 2026-10-06
author: claude-code
priority: high
---

# Harness Hardening for FABER and faber-code

## 1. Summary

FABER is a generic workflow tool for making anything: code, content, video, data ingests, cloud infrastructure, or a custom asset. faber-code is one pre-packaged workflow ("pack") among several. This spec has three parts:

- **Part 1, core faber:** changes every pack relies on. They must stay domain-neutral.
- **Part 2, faber-code:** how the software pack adopts them.
- **Part 3, other packs:** short notes for the remaining packs.

**Where FABER stands.** FABER's orchestration (phases, inheritance, state, approvals, issue → PR integration) is ahead of comparable tools. The gaps are elsewhere:

1. "Done" means the steps ran, not that there is evidence the result works.
2. In faber-code, the agent that made the work also judges it.
3. faber-code's Build is one monolithic step with no task-level state.
4. Nothing measures whether a skill, prompt or model change helped.
5. The code-driven runtime (`fractary-faber workflow-execute`) has six correctness gaps, filed as #235–#240.

**Approach.**
- Code runs the loop.
- Each step is a fresh agent session, on any model or provider.
- "Done" is a layered set of criteria, checked from evidence by validators that did not make the work.
- Evals measure the whole system.
- Several packs (video, content, ingest) already follow parts of this. The work is to make it a core guarantee and bring faber-code in line.

## 2. Decisions (2026-10-06)

| # | Topic | Decision |
|---|---|---|
| 1 | Runtime | `fractary-faber workflow-execute` is the runtime for all runs. `/fractary-faber-workflow-run` becomes a thin chat wrapper that starts the CLI, relays approvals and summarizes. |
| 2 | Project standards | Repo maintainers own each project's standards profile and change it by PR. Org standards arrive through codex sync, are read-only in the project and pinned by version. Each org standard is marked **floor** (projects may only tighten it) or **default** (projects may override it with a recorded reason). |
| 3 | agent-skills | Port its patterns into faber-code with MIT attribution. Do not take a runtime dependency on it. |
| 4 | Task state | Task definitions live with the work-item docs and are locked at approval. Task status and evidence live in the run folder. |
| 5 | Runtime bugs | Filed as one issue each: #235–#240. |
| 6 | Evals | Pilot first: 10 past work items × 3 runs on the CLI runtime. Set the full suite size and the allowed cost increase from the pilot's numbers. |
| 7 | Spec form | One spec in two parts (this document). |

## 3. Terms

| Term | Meaning | Lives in | One per |
|---|---|---|---|
| Requirements | What the requester wrote: the issue body plus any user-written spec | Issue tracker, `docs/specs/` | Work item |
| Work-item docs | What the workflow produces about the work and keeps: research, design, criteria, task definitions, decisions log, change summary | `.fractary/specs/WORK-<id>-*` (committed) | Work item |
| Run records | Facts about one attempt: plan snapshot, state, events, evidence, transcripts, verdicts, task status | `.fractary/faber/runs/<plan-id>/` | Run |
| Pack | A packaged workflow plus its skills and agents (faber-code, faber-content, faber-video, faber-ingest, faber-cloud, …) | Its own repo | — |
| Maker step / validator step | A step that produces work / a step that judges it | Workflow config | — |
| Check | A way to verify one criterion: command, metric, schema, rubric, human or trial run (§1.3) | Profile, criteria | — |
| Evidence | A file the harness writes when it runs a check (command, exit code, output, version) | Run records | — |
| Verdict | A validator's structured result per criterion (§1.3) | Run records | — |

One work item can have several runs, and FABER's run-ID system already supports this with `--rerun` and `rerun_of`. Examples:
- a second run after review feedback;
- a fresh start after a bad run;
- several workflows on one item (faber-video's script-create, then produce, then distribute);
- partial `--phase` runs;
- eval trials.

## 4. How a run works

```
fractary-faber workflow-plan --work-id 258
  → resolves the workflow (core + pack via extends), fetches the work item,
    creates the branch/workspace, writes .fractary/faber/runs/<plan-id>/plan.json

fractary-faber workflow-execute <plan.json>          (plain code, no LLM)
  for each step in the plan:
    ├─ save state: step in progress
    ├─ start a fresh agent session for the step (Agent SDK or another provider;
    │    model, turn and budget caps, allowed tools, project skills loaded)
    │    → the agent works and writes its outputs to files; its final message
    │      contains a JSON verdict, e.g. {"status": "failure", ...}
    ├─ parse the verdict, check required evidence files
    └─ apply rules: next step / capped fix loop / pause for approval / stop
```

- **Judgment is always a step.** "Is this good enough?" is answered by a validator step that returns a verdict. No master agent interprets results.
- **Handoffs go through files and version control,** never through an agent's memory.
- **Approvals pause the run.** Before a gated step the runtime saves state and exits. `--resume <run> --approve <step>` continues it.
- **Three ways to start a run:**
  - the CLI directly;
  - a Claude Code chat that runs the same commands in the background and relays questions;
  - an automated trigger (GitHub Action, cron, Routine).

  The loop is the same code in all three.

## 5. Findings

Paths are relative to each repository root.

### Core runtime (all packs)

| # | Finding | Evidence | Issue |
|---|---|---|---|
| F1 | A CLI step counts as successful whenever its session ends normally. The FABER response JSON is never parsed, so a failing validator does not stop the run. | faber `sdk/js/src/executors/providers/claude-agent.ts:211-239`; `sdk/js/src/executors/workflow-executor.ts:319-326` | #235 |
| F2 | `require_approval`, `require_approval_for` and `pause_before_release` are ignored in CLI mode, so gated steps (for example `release-deploy-apply-prod`) would run unapproved. | `sdk/js/src/workflow/resolver.ts:307-308`; `workflow-executor.ts` | #237 |
| F3 | `max_retries` and `on_failure: retry` are ignored. Any `on_failure` other than `stop`, including `/fractary-faber-workflow-debug --auto-fix`, continues to the next step. | `resolver.ts:308`; `workflow-executor.ts:319-326` | #238 |
| F4 | `workflow-execute` saves no run state and has no `--resume`. `status` and `recover` cannot see CLI runs. | `cli/src/commands/workflow/index.ts:737-760`; `workflow-executor.ts:69,75,236` | #236 |
| F5 | Step sessions start in the plan folder (`<workspace>/.fractary/faber/runs/<plan-id>/`) instead of the workspace root. | `cli/src/commands/workflow/index.ts:750`; `cli/src/commands/plan/index.ts:675`; `claude-agent.ts:186` | #239 |
| F6 | CLI steps run with `bypassPermissions` and the full tool preset, with no sandbox or configurable mode. | `claude-agent.ts:201,208` | #240 |
| F7 | CLI mode can run a step as a shell command (a prompt starting with `!`; exit code decides), but no workflow uses this for verification and no evidence is recorded. Plugin mode has no deterministic equivalent. The run verifier checks workflow signals, not the product. | `sdk/js/src/executors/providers/claude-agent.ts:88-104`; `plugins/faber/skills/fractary-faber-workflow-run-verifier/SKILL.md` | — |
| F8 | Core contains software-specific pieces:<br>- the generic `asset-engineer-validator` template (lint, type checks, coverage);<br>- `issue-reviewer`, which gathers code changes and is invoked by nothing;<br>- debugger knowledge-base categories such as `type_system` and `test_failure`. | `templates/agents/asset-engineer-validator/agent.yaml`; `plugins/faber/skills/fractary-faber-issue-reviewer/`; `plugins/faber/knowledge-base/` | — |
| F9 | No evals exist for skills or workflows. The knowledge base and `anti-patterns.md` record failures but are not regression tests. | `plugins/faber/knowledge-base/*`; `plugins/faber/skills/fractary-faber-workflow-run/anti-patterns.md` | — |

### faber-code

| # | Finding | Evidence |
|---|---|---|
| F10 | Plugin-mode steps, validators included, run in one shared context ("you do NOT delegate to sub-agents"). The engineering validator runs tests only "if possible". Since v0.6.0, faber-code's validators run inside that shared context, whereas faber-content, faber-ingest and faber-video run theirs as separate agents. | faber `plugins/faber/skills/fractary-faber-workflow-run/SKILL.md:10,15`; faber-code `plugins/faber-code/skills/fractary-faber-code-validate/workflow/validate-engineering.md:34` |
| F11 | The engineer workflow is generic ("Write tests alongside code"), and says "If spec is unclear: Document assumption and proceed". | `plugins/faber-code/skills/fractary-faber-code-engineer/workflow/engineer-workflow.md:41,56,104` |
| F12 | Build is one `build-engineer` step, committed once at the end of the phase. There is no task list, per-task verification or progress record. | `plugins/faber-code/.fractary/faber/workflows/default.json`; faber `plugins/faber/.fractary/faber/workflows/core.json:112` |
| F13 | Every skill loads the issue body plus all comments as its handoff. That input keeps growing, and anyone who can comment can inject instructions. | `plugins/faber-code/skills/fractary-faber-code-common/scripts/load-work-context.sh:20-21` |
| F14 | `validate --type product`, the validator that runs the product, exists but is not in the default workflow. For code-only changes, the Evaluate phase is Terraform deploy steps. | `default.json:89-125`; `plugins/faber-code/skills/fractary-faber-code-validate/SKILL.md:26` |
| F15 | The architect already writes acceptance criteria and a testing strategy, and `validate-product` traces criteria to evidence. But criteria have no stable IDs, verification methods or lock, and no layer above them holds project standards. | `.fractary/docs/templates/code-architecture/template.md:95-101`; `validate-product.md:13-40` |
| F16 | The README documents agents, per-type validator commands and three workflow files that no longer exist. `config/best-practices-rules.yaml` is referenced only by an old spec. The repo's own `.claude/settings.json` broadly allows `rm`, `curl`, `aws`, `terraform` and `git push`. | `README.md:34,49,60,80,132-138`; `.claude/settings.json:12-25` |

### Other packs (patterns to keep or fix)

| # | Finding | Evidence |
|---|---|---|
| P1 | faber-video's done is evidence-based: a deterministic QA gate measured with ffprobe, with blocking and advisory codes, followed by human sign-off before distribution. | faber-video `plugins/faber-video/skills/fractary-faber-video-qa-checklist/SKILL.md` |
| P2 | faber-content keeps project standards as data in its `faber-content:` config section (SEO threshold profile, rulesets, strict mode), used by its audit engine. But its draft validator hard-codes "800+ words" and one brand voice in the prompt. | faber-content `plugins/faber-content/config/config.example.yaml`; `agents/fractary-faber-content-content-draft-validator.md` |
| P3 | faber-content and faber-ingest run their validators as separate agents through thin commands, some on smaller models (the content draft validator runs on Haiku). faber-content routes validator failures to `workflow-debug --auto-fix` with no cycle cap. | faber-content `commands/*-validate.md`; `workflows/article-create.json`; faber-ingest `commands/*-validate.md` |
| P4 | faber-ingest's Evaluate runs a bounded trial (`--env test --max-items 10`) and then validates record counts and error rates. | faber-ingest `.fractary/faber/workflows/ingest-create.json` |
| P5 | faber-cloud gates apply behind approval, and runs `terraform validate`, plan, plan-validate and security and cost scans as steps. | faber-cloud `.fractary/faber/workflows/infrastructure-deploy.json` |

## Part 1 — Core faber (all maker packs)

### 1.1 Principles

1. **Code runs the loop; agents judge inside steps; humans approve irreversible actions.**
2. **Done is decided from evidence, by something other than the maker:** a check, a separate validator agent, or a person.
3. **Every standard has a guide and a sensor.** The maker is told about it, and a check verifies it. A prompt instruction with no check is a guide with no sensor.
4. **Core stays domain-neutral.**
   - Core speaks of assets, change sets, checkpoints and isolated workspaces.
   - Packs supply domain checks: tests, ffprobe, SEO audits, Terraform plans, crawl samples.
   - Git-based implementations stay available to packs that use git.
5. **Measure the system, not just each run.** Evals track whether changes help. Each scaffold records which model weakness it compensates for, and is re-tested at every model upgrade.

### 1.2 Layered definition of done

| Layer | Holds | Written by | Approved by | Lives in |
|---|---|---|---|---|
| L0 core floor | Rules for every pack:<br>- every pass has evidence;<br>- "could not run" is never a pass;<br>- locked criteria are unchanged;<br>- the bar is never loosened silently;<br>- no irreversible action without approval. | FABER | FABER maintainers | Core; enforced by the runtime and a managed hook |
| Org standards | Organization-wide rules and guidelines, each marked `floor` or `default` | Org | Org owners, in the codex source | Synced by codex; read-only in the project; pinned by version |
| L1 project profile | Per dimension: check, threshold or ratchet, when it applies, severity; references to org standards and project standards docs; exceptions with owner and expiry | Pack defaults, then stack detection and a short interview | Repo maintainers, by PR | The pack's section of `.fractary/config.yaml`, validated by the pack's config schema |
| L2 work-item criteria | Stable-ID, testable statements of what must be true, plus an out-of-scope list and open questions | Frame | A human, or the autonomy policy, at the Frame→Architect gate | Work-item docs; locked by hash |
| L3 task definitions | Per task: what it is, its acceptance criteria and verify check, mapped to L2 IDs | Architect | Automatic coverage check (every L2 ID covered) | Work-item docs; locked by hash |
| Run status and evidence | Per task and per criterion: status, evidence files, version | The runtime | — | Run records |

Rules:
- **Tighten only.** A lower layer may tighten a higher one. Loosening needs an exception with an owner and expiry, and is reported loudly.
- **Locked criteria.** The maker writes only status and evidence. Amending L2 or L3 sends the item back to Frame for re-approval.
- **Re-check, don't trust.** A new run on the same work item reuses the locked definitions and re-runs the checks; it does not trust earlier statuses.
- **Overlays are for how-to.** `context_overlays` stay for project how-to instructions ("posts live in `src/content/blog`", "use `make migrate`"), not for standards.

Example profile shape (keys under `faber.standards` and `faber-content.draft` are proposed):

```yaml
faber:
  standards:
    org:                                   # synced by codex, read-only here
      - id: ORG-CFG-001
        source: codex://fractary/core/docs/standards/config-management-standards.md
        version: 3f9c2a1                   # pinned; bump by PR
        mode: floor                        # floor | default
faber-content:                             # pack-declared, schema-validated
  seo: { profile: article, strict: true }  # existing keys
  draft:
    min_words: 800                         # proposed: moved out of the validator prompt
    voice: docs/standards/brand-voice.md   # judgment standard, rubric-checked by ID
```

### 1.3 Checks, evidence and verdicts

| Check type | Verifies by | Examples |
|---|---|---|
| `command` | Exit code plus parsed output | Test suite, `terraform validate`, `fractary-faber-video qa`, the content audit CLI |
| `metric` | A measured number against a threshold or ratchet | Coverage on changed lines, loudness in LUFS, crawl error rate, page word count |
| `schema` | An artifact validates against a schema | VideoScript JSON, front matter, config |
| `rubric` | A separate judge agent scores a criterion against a referenced guideline | Brand voice, architecture conventions, clarity |
| `human` | A named person signs off | Video reviewer, production deploy approval |
| `trial` | A bounded real run in a test environment, then inspection | Ingest `--max-items 10`, cloud test deploy, app smoke run |

- **One entrypoint:** `fractary-faber verify --stage <stage>`. Exit codes: 0 pass, 1 fail, 2 could not run. 2 never counts as a pass. The same entrypoint runs from the executor, hooks and CI.
- **Evidence files:** the harness writes them, not the agent, under the run folder. Each records the check, exit code, output tail, and the asset version or commit.
- **Verdict per criterion:** `{id, status: pass|fail|unknown, severity: blocking|advisory, evidence: [...]}`, carried in the FABER response JSON.
- **Bar-integrity guard (core):** compares the profile, the criteria and check configuration against the baseline, and flags loosened thresholds, removed checks or edited locked criteria. Packs add domain detectors, such as faber-code's skipped tests and lint suppressions.

### 1.4 Validator runner

- **Separate session.** Every validator step runs as its own agent session. In the CLI runtime that is automatic, because each step is a fresh session. Validators get restricted tools: read-only, plus running checks.
- **Inputs:**
  - the artifact, presented by the pack (code: a diff; content: a redline; video: the render plus its probe report);
  - the locked criteria and profile;
  - harness-written evidence;
  - tools to run checks.

  Stated intent is allowed. The maker's reasoning and claims ("tests pass") are withheld.
- **Output:** the verdict schema in §1.3. "Unknown" is allowed and never counts as a pass. Findings are limited to correctness and the stated criteria.
- **Fix loop:**
  - validator failure → a fix step that receives only the findings → re-run checks → re-validate;
  - at most 3 cycles, then escalate or split the work;
  - a fresh maker session after 2 failed fixes;
  - a no-progress stop;
  - keep the best checkpoint, not necessarily the last.
- **Model choice.** Model and provider are set per validator, and cross-provider judges are allowed. A smaller model must prove itself through validator evals (§1.6).

### 1.5 Runtime (CLI executor)

The CLI executor becomes the only loop. Required work:
- parse verdicts (#235);
- saved state and resume (#236);
- approval pauses (#237);
- capped retries and fix loops (#238);
- workspace-root working directory (#239);
- configurable permissions and sandboxing (#240);
- a cumulative run budget (the Agent SDK's `maxBudgetUsd` excludes spend restored on resume);
- per-step wall-clock timeouts;
- full per-step transcripts.

`/fractary-faber-workflow-run` becomes a wrapper: it starts `workflow-execute` in the background, relays approval prompts and escalations, and summarizes from the run records. Single-session plugin orchestration is retired for unattended runs.

### 1.6 Evals

An eval task is a frozen past work item: its requirements, its starting asset state, and a hidden answer key built from what a human accepted. Tasks differ, but the scoring protocol is the same for all of them.

**What is measured:**

| Measure | Applies to | Target |
|---|---|---|
| Answer-key pass rate over 3 runs (pass^3) | Each task's own hidden checks | Above baseline |
| Invariants: evidence for every pass, locked criteria unchanged, no unapproved irreversible action, within budget, pauses on planted ambiguity, final claims match evidence | Every run, every pack | 100% |
| Phase evals (below) | Every task | Above baseline |
| Validator catch rate and false-alarm rate | Planted defects and accepted outputs | ≥ 90% each |
| Cost and time per verified success; human interventions per run | Every run | Within agreed threshold |

**Phase evals (the same job on every task):**

| Phase | Job | Eval |
|---|---|---|
| Frame | Turn a request into testable criteria | Recall of the must-have criteria a human listed; pauses on planted ambiguity |
| Architect | Make every criterion provable | Share of criteria with a check; share of checks that fail before the work and pass on the accepted answer |
| Build | Meet the criteria | Hidden answer-key checks pass |
| Evaluate | Catch bad work, pass good work | Catch rate on planted defects; false alarms on accepted outputs |
| Release | Ship safely | No unapproved irreversible actions |

**Task sources, per pack:**

| Pack | Frozen task | Answer key | Planted defects |
|---|---|---|---|
| code | Closed issue plus the repository before the fix | Tests from the merged change (fail before, pass after) plus the existing suite | Dropped requirement, weakened test |
| content | Brief plus site state | Editor-approved article; audit rules; voice rubric | Wrong fact, missing citation, off-brand paragraph |
| video | VideoScript | QA gate blocking codes plus reviewer notes | Silent scene, caption overrun, wrong chart value |
| ingest | Recorded site snapshot plus job request | Expected records and fields from an accepted crawl | Missing field, duplicates, blocked pages counted as success |
| cloud | Infrastructure request plus state | Accepted plan; clean policy and security scans | Open security group, missing tags |

**Rules:**
- Graders are independent of the workflow's own validators.
- LLM graders are calibrated against human labels.
- Every trial runs in a clean environment.
- External sources are recorded (ingest), and cloud evals run plan-only or in a sandbox account.
- Each failure that escapes to production becomes a new task.

**Pilot.** 10 past faber-code work items × 3 runs on the CLI runtime. Measure pass rates, cost per verified success and variance, then size the suite. About 44 tasks per variant are needed to detect a 30-point change and about 100 for a 20-point change. Use the pilot to set the allowed cost increase for skill changes. Autonomy is earned per project by measured pass^3 and validator catch rate, not by elapsed time.

### 1.7 Core cleanup

- **Validator template.** Make `asset-engineer-validator` domain-neutral (criteria plus evidence). Move the code version to faber-code.
- **issue-reviewer.** Retire it from core and fold its spec-compliance logic into faber-code's engineering validator (§2.1). Core keeps only the generic validator runner.
- **Debugger knowledge base.** Packs supply their own knowledge-base categories; core keeps generic ones.
- **Wording.** Core docs and schemas use change set, checkpoint and isolated workspace, with git implementations behind them.

### 1.8 Core milestones

Sizes: **S** ≤ 1 day, **M** 2–4 days, **L** 1–2 weeks.

| ID | Change | Acceptance | Size |
|---|---|---|---|
| A1 | Parse step verdicts (#235) | A failing validator stops the phase under `on_failure: stop` | S |
| A2 | Approval pauses and `--approve` (#237) | A gated step never runs without approval | M |
| A3 | Capped retries and fix loops (#238) | Retry caps honoured; slash-command handlers never silently continue | M |
| A4 | Permission mode configurable; bypass is opt-in with a warning (#240, part 1) | Default runs use the configured mode | S |
| A5 | Saved state, events and `--resume` (#236) | A killed run resumes at the interrupted step; `status` shows CLI runs | M |
| A6 | Workspace-root working directory (#239) | Step `cwd` equals the workspace root, with and without a worktree | S |
| A7 | `/fractary-faber-workflow-run` as a CLI wrapper | Chat starts, relays approvals and summarizes; it never executes steps itself | M |
| B1 | Eval harness: task format, clean trials, invariants, pass^k, cost per verified success | One command produces a results table | L |
| B2 | Pilot: 10 faber-code tasks × 3 runs | Baseline recorded; suite size and cost threshold set | M |
| B3 | Structural lint for skills in every pack | CI fails on a malformed skill | S |
| B4 | Rule: skill, prompt or model changes ship with an eval comparison; rejected changes are logged | In `CONTRIBUTING.md` | S |
| B5 | Validator calibration: planted defects plus human labels | Catch and false-alarm rates reported per validator | M |
| C1 | Standards resolver: org standards via codex (pinned, floor or default), pack-declared project profile, exceptions | Loosening a floor fails; overriding a default needs a reason | M |
| C2 | Criteria and task-definition schemas, hash locks, coverage check | An edited locked file fails the run | M |
| C3 | Check runner and `fractary-faber verify --stage` with the six check types and evidence files | Exit 2 never counts as a pass | M |
| C4 | Transition guard requires evidence for `requires_evidence` steps | Completion without matching evidence is rejected | S |
| C5 | Generic bar-integrity guard | Loosened thresholds and removed checks are flagged | M |
| D1 | Validator runner: input packet, withheld claims, verdict schema, restricted tools | Verified from the run transcript | M |
| D2 | Capped fix loop with fresh maker, no-progress stop and best checkpoint | Loops stop at the cap with resumable state | M |
| D3 | Cross-provider validator preset | Works end to end on one eval task | S |
| S1 | Pinned project rules (Always / Ask first / Never) injected into every step | Present in every step prompt | S |
| S2 | OS-level sandbox for unattended steps; short-lived credentials (#240, part 2) | A write outside the workspace or a non-allowlisted host is blocked | L |
| S3 | Per-step `allowed_tools`; least-privilege permission profile shipped by the installer | Research steps cannot deploy or push | M |
| S4 | Per-step transcripts, timeouts and cumulative run budget | Every step has a transcript; hung steps are killed | S |
| K1–K4 | Core cleanup (§1.7) | No code-specific logic left in core templates or skills | M |

## Part 2 — faber-code adoption

### 2.1 Validators: enhance the existing skill

Keep `fractary-faber-code-validate` and its four types. Change what goes in, what comes out, and how it runs.

- **Inputs:** locked criteria and profile, the diff, harness-written evidence, read-only tools plus check commands. Not the issue comment thread, and not the changeset's claims.
- **Output:** per-criterion verdicts with evidence pointers and severity, inside the FABER response JSON.
- **Per type:**

| Type | Checks |
|---|---|
| research | Drafted criteria are testable and traceable to the requirements |
| architecture | Criteria are complete and verifiable; every criterion is covered by a task check; consistent with the profile |
| engineering | Evidence against criteria; fail-before/pass-after on new tests; code bar-integrity detectors. Absorbs `issue-reviewer`. |
| product | Runs the product (start the app, call endpoints, drive the UI, run the CLI) against acceptance criteria. Wired into the default workflow. |

- **Execution:** a separate session per validator step, with restricted `allowed_tools`. This rejoins the pattern faber-content, faber-ingest and faber-video already use.

### 2.2 Default code profile

Pack defaults, adjusted per project by stack detection plus an interview, then ratified by PR:
- test, lint, typecheck and build commands;
- coverage on changed lines as a ratchet;
- at least one external check (for example a dependency or security scanner).

Code-specific bar-integrity detectors flag:
- new `.skip` or `.only`;
- deleted tests;
- removed assertions;
- new suppressions (`eslint-disable`, `@ts-ignore`, `istanbul ignore`, `nosemgrep`, `gitleaks:allow`);
- stubs in place of logic.

For behaviour changes and bug fixes, new tests must fail on the base commit and pass on the head commit, as SWE-bench does.

### 2.3 Frame and Architect

- **Frame** drafts L2 criteria: stable IDs, testable statements, out-of-scope items, assumptions and open questions. It pauses on ambiguity that affects security, data loss, public interfaces or cost.
- **Architect** writes the design and the L3 task definitions. Tasks are vertical slices touching at most 5 files, each with a verify check, mapped to L2 IDs. The architect also chooses a check for each criterion.

### 2.4 Build loop

- One fresh session per task.
- Per task: write a failing test where behaviour changes → implement → run the task check → checkpoint commit referencing the task ID → status and evidence in the run folder → deviations appended to the decisions log.
- The engineer never edits locked docs. Scope creep is noted, not fixed.
- On resume, re-run the last task's check, then continue.
- Ambiguity rule:
  - assisted and guarded modes pause and ask;
  - autonomous mode proceeds only on low-risk assumptions, recorded as a warning.

### 2.5 Skill rewrites (ported from agent-skills, MIT attribution)

- Each skill gets the anatomy: when to use, when not to, process with concrete commands, a table of common rationalizations, red flags, and evidence-based verification.
- Seed the rationalization tables from `anti-patterns.md` and the knowledge base.
- `SKILL.md` stays at or under 500 lines; specialties become short checklists with on-demand references.
- Ship a `bug-fix` workflow: reproduce, failing test, fix, guard test.

### 2.6 Handoffs and drift

- Steps read work-item docs, not the comment thread. Issue comments become human-facing summaries only.
- Fix the README.
- Delete or wire up `best-practices-rules.yaml`.
- Trim the repo's `.claude/settings.json`.

### 2.7 faber-code milestones

| ID | Change | Acceptance | Size |
|---|---|---|---|
| E1 | README and config drift (§2.6) | No references to things that do not exist | S |
| E2 | `docs/SKILL-ANATOMY.md` plus lint (B3) | Lint passes on rewritten skills | S |
| E3 | Frame writes L2 criteria (§2.3) | Research validation fails on untestable criteria | M |
| E4 | Architect writes L3 task definitions and the check per criterion (§2.3) | Coverage check passes; every task has a check | M |
| E5 | Task-by-task Build loop (§2.4) | One commit per task; a killed run resumes at the next task | L |
| E6 | Validator enhancements; product validator wired in; issue-reviewer folded in (§2.1) | Planted-defect catch rate ≥ 90% on the pilot | M |
| E7 | Default code profile and detectors; fail-before/pass-after (§2.2) | Weakened-test fixtures are flagged | M |
| E8 | Skill rewrites and the `bug-fix` workflow (§2.5) | pass^3 holds or improves against the pilot within the cost threshold | L |
| E9 | Handoffs from work-item docs (§2.6) | A planted malicious comment in an eval fixture is not acted on | M |

## Part 3 — Notes for other packs

| Pack | Keep | Adopt |
|---|---|---|
| faber-video | Deterministic QA gate with blocking and advisory codes; human sign-off; no LLM at production time; budget gates | Map QA codes to the verdict schema; reviewer sign-off as a `human` check; QA thresholds as profile entries |
| faber-content | Config section as a standards profile; audit engine; validators as separate agents | Move "800+ words" and brand voice from the validator prompt into the profile and a standards doc; confirm Haiku validators via B5; replace uncapped auto-fix with D2 |
| faber-ingest | Bounded trial crawl in a test environment; per-phase validators | Error-rate and record thresholds as profile metrics; recorded snapshots for evals |
| faber-cloud | Approval before apply; validate, plan and scan steps | Plan-only or sandbox-account evals; policy checks as `command` checks with evidence |

## 6. Sequencing

```
A (runtime) ──► B1–B2 (eval harness + pilot baseline) ──► C (criteria, checks, evidence) ──► D (validators)
                                                      └──► E3–E9 (faber-code) ◄────────────────┘
S (sandbox and boundaries) and K (core cleanup) run in parallel from A onward. E1–E2 can start now.
```

Suggested first slice: A1–A7, then B1–B2. That makes the CLI a trustworthy runtime and gives a measured baseline before any skill rewrite.

## 7. Risks and trade-offs

| Risk | Mitigation |
|---|---|
| Cost and time rise (the harness-design article's example ran at about 20× the cost of an unharnessed run) | Scale verification depth by autonomy level and work type. Track cost per verified success and hold changes to the threshold set by the pilot. |
| New gates fail runs that used to "pass" | Intended. Roll out behind config: on by default for new workflows, opt-in for one release on existing ones. |
| Core abstractions fit code but not other packs | Every core milestone's acceptance is checked against at least one non-code pack (video or content). |
| Org standards drift between projects | Versions are pinned and recorded in each run. Updating a standard is a visible PR. |
| A validator on a small model misses defects | B5 measures catch rate per validator before it is trusted to gate. |
| Eval maintenance burden | Start with the pilot. Add a task only when a real failure recurs. |

## 8. Success metrics

| Metric | Target |
|---|---|
| Runs that report done while a blocking check fails | 0 |
| pass^3 on the eval suite | Above the pilot baseline, reported per milestone |
| Validator catch rate on planted defects | ≥ 90% per gating validator |
| Bar loosened without a recorded exception | 0 |
| Unapproved irreversible actions | 0 |
| Cost and time per verified success | Within the threshold set from the pilot |
| Human interventions per run | Trending down |

## 9. Sources

| Source | Version |
|---|---|
| `addyosmani/agent-skills` | `1401c8b` (2026-10-03) |
| "How to Design an Agent Harness: six decisions that turn a model into a worker you can leave alone" | Yarchi, 2026-08-15 (text supplied by maintainer) |
| Research report "Agent harness and eval practices 2026" (Anthropic, OpenAI, Spec Kit and others, as of October 2026) | 2026-10-06 (shared separately) |
| `fractary/faber` | `415af40` |
| `fractary/faber-code` | `fd6f2f5` |
| `fractary/faber-video`, `faber-content`, `faber-ingest`, `faber-cloud` | `c71fe41`, `1a109a8`, `0aefd33`, `e8cf897` |

Figures quoted from the article and the research report are those sources' claims and were not re-measured.

## Appendix A — Comparison with agent-skills and the six-decisions checklist

### A.1 Layers

| Layer | agent-skills | FABER today |
|---|---|---|
| Outer loop | A human runs `/spec → /plan → /build → /test → /review → /ship`; `/build auto` is the only autonomous loop | Declarative phases with inheritance, state, events, resume, worktrees, batch runs, autonomy levels |
| Inner loop | Each skill has steps, a rationalization table, red flags and evidence-based exit criteria; TDD, thin slices, a commit per slice | faber-code: thin skills with generic steps and no evidence requirement |
| Verification | Standing Definition of Done, per-task verify, floor guard, fresh-context adversarial review | LLM validators; tests "if possible"; same context in plugin mode |
| Measurement | Structural, routing and behavioural evals; with/without-plugin comparison | None |

### A.2 agent-skills: pros and cons

**Pros:**
- targets the dominant failure (claiming done without proof);
- small, composable, model-neutral skills;
- verification culture: TDD, slices, floor guard;
- independent review;
- durable plan files;
- measured with evals;
- near-zero adoption cost.

**Cons:**
- no orchestrator, and skill activation is stochastic;
- human-gated by design;
- no integrations;
- generic practices;
- enforcement mostly prompt-level unless hooks or CI are wired up;
- costs more tokens and time.

### A.3 FABER: pros and cons

**Pros:**
- real orchestration with script-based guards;
- end-to-end SDLC integration;
- multi-model, multi-harness CLI executor;
- auditability;
- failure learning has started.

**Cons:** see §5.

### A.4 Against the six decisions

| Decision | FABER today | Gap |
|---|---|---|
| 1. Loop and stop rule | Done = steps completed plus run verifier; caps only in CLI mode | High; addressed in §1.2–1.5 |
| 2. Tools | Skills load on demand; structured error fields | Low |
| 3. Memory | Plugin mode: one long session; CLI: fresh session per step | Resolved by Decision 1 |
| 4. Crash survival | Strong at workflow level; nothing at task level | Addressed in §2.4 and Decision 4 |
| 5. Boundaries | `bypassPermissions`; no permission profile shipped | High; addressed by A4 and S1–S3 |
| 6. Who says done | Same-context validators; no evals | Highest; addressed in §1.4 and §1.6 |
