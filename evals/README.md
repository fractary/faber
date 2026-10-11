# Evals

An eval runs a workflow on frozen past work items and grades the result against what a person accepted. FABER uses evals to measure a pack before and after a change to its skills, prompts or models (#272, milestone B of `docs/specs/harness-hardening-plan.md`).

```bash
fractary-faber eval check <suite-dir>     # check each task's answer key, without running anything
fractary-faber eval run <suite-dir>       # run every task k times and print the results table
```

`evals/fixtures/` is a small suite whose workflows are shell steps standing in for an agent, so it runs without an API key. Agent steps need one, as in `workflow-execute`.

## A suite

```
<suite>/
  suite.yaml             name, trials, and defaults for every task
  <task-id>/
    task.yaml            the frozen work item and its answer key
    answer-key/...       files copied in after the run, such as the accepted change's tests
    solution.patch       the accepted change, for `eval check`
```

`suite.yaml`:

```yaml
name: faber-code-pilot
trials: 3                       # per task (default 3)
defaults:                       # for every task
  workflow: faber-code@fractary-faber-code:default
  plugins: [../../plugins/faber-code]   # the pack under test; relative to this file
  settings: trial-settings.json         # Claude settings for every session, such as permissions
  setup: [npm ci]
  budget_usd: 10
  skip_steps: [frame-codex-sync, build-create-pr]
```

`defaults` can set `workflow`, `phases`, `skip_steps`, `plugins`, `settings`, `setup`, `budget_usd` and `production_branch`. A task's `skip_steps`, `plugins` and `setup` are added to the suite's; its other values replace the suite's.

## A task

`task.yaml` describes one past work item:

```yaml
repo:                           # the repository before the change
  git: https://github.com/acme/app.git
  commit: 3f2a9c1               # the merged change's parent
# or, for a small fixture, a directory that becomes a new repository:
#   dir: ../repos/app
production_branch: main         # must not change during a trial (default main)
work_item:                      # the issue as it was when work started
  number: 123
  title: Reject expired coupons at checkout
  body: |
    ...
  labels: [bug]
  comments:
    - author: alice
      body: ...
workflow: app                   # resolved from the plugins, then the trial's repository
phases: [frame, architect, build, evaluate]   # the default; Release never runs
skip_steps: []                  # steps removed from the workflow
plugins: []                     # plugin directories, relative to this file
settings: trial-settings.json   # a Claude settings file, relative to this file
setup: [npm ci]                 # commands run in the repository before the run
budget_usd: 10                  # an invariant, checked after the trial
answer_key:
  files:                        # repository path: file in the task directory
    tests/coupons.test.ts: answer-key/coupons.test.ts
  commands:                     # each must exit 0
    - npm test -- tests/coupons.test.ts
    - npm test
  timeout_seconds: 600          # per command (default 600)
solution: solution.patch        # the accepted change
```

A good task comes from a closed work item whose merged change added tests that fail before it and pass after it. Copy those tests into `answer-key/`, and the change itself into `solution.patch` (`git diff <parent> <merge> > solution.patch`). Then `eval check` confirms that the answer key fails on the repository before the change and passes with it.

## A trial

Each trial runs in its own directory:
- **Repository:** a fresh clone at the commit before the change, on a work branch (`feat/<number>`). Its `origin` is a local bare repository, so pushes stay local.
- **GitHub:** a `gh` shim, first on `PATH`, serves the frozen work item. It keeps comments posted during the run, so later steps read them as they would on GitHub. It records pull request calls, and refuses merges and API calls. `GH_TOKEN` and `GITHUB_TOKEN` are removed from the environment.
- **Setup:** the `setup` commands run in the repository, in order, such as installing its dependencies. If one fails, the trial could not start. `eval check` runs them too, after applying the solution.
- **Plugins:** every agent session loads the `plugins`, on top of the plugins the repository's `.claude/settings.json` enables. Sessions read only the project's settings, so a pack installed for your user is not loaded unless it is listed. A `plugin@marketplace:workflow` reference resolves first from a listed directory named `<plugin>`, so the workflow and its skills come from the same copy of the pack.
- **Settings:** every agent session applies the `settings` file on top of the repository's settings, as Claude Code's `--settings` does. Use it to grant the permissions a developer's checkout would have, such as `Bash(npm:*)` and `Bash(git:*)`: a CLI run has no one to answer a permission prompt, so anything not allowed is denied.
- **Plan:** written offline from the resolved workflow, without the `skip_steps` steps. `workflow-plan` would call GitHub and the Anthropic API.
- **Run:** the task's phases run with `workflow-execute`'s executor, and the run state records every session's cost. Release never runs, so a workflow with an enabled Release phase ends `paused`.
- **Grade:** the answer key's files are copied into the working tree, then its commands run. The trial passes when every command exits 0 and the run did not crash. Grading is independent of the workflow's own validators.

Skip the steps that reach systems a trial must not touch, or that fail without credentials: syncing docs from codex, posting to the issue with a token, creating or reviewing pull requests. For a workflow that extends FABER's core, that is typically:

```yaml
skip_steps:
  - frame-codex-sync
  - frame-issue-comment-complete
  - architect-issue-comment-complete
  - build-create-pr
  - build-issue-comment-complete
  - evaluate-pr-review
  - evaluate-forward-to-test
  - evaluate-issue-comment-complete
```

Steps that use `gh`, such as faber-code's issue summaries, work through the shim and need no skipping.

## Invariants

Every trial must hold these, whatever its grade:

| Invariant | Broken when |
|---|---|
| `run_ended` | The run crashed, or the trial could not start |
| `no_pr_merge` | A step tried `gh pr merge` |
| `production_branch_untouched` | The production branch moved, appeared or disappeared on the trial's remote |
| `within_budget` | The run's cost is over `budget_usd`. Not checked without a budget or a reported cost |
| `failed_validator_not_ignored` | A step ran after a validator failed |

`eval run` exits 2 when any trial broke one.

## Results

`eval run` prints the results table and writes `results.md`, `results.json` and each trial's run state, gh log and grade to `--output` (default `evals/results/<suite>-<timestamp>/`). The results name the commit of each plugin, and whether it had uncommitted changes, so they record which version of the pack they measured.

| Measure | Meaning |
|---|---|
| Passes | Trials of the task that passed |
| pass^k | Every trial of the task passed |
| Mean cost, mean time | Per trial |
| Cost per verified success | Total cost of every trial, failed ones included, divided by the trials that passed |
| Invariant violations | Across the task's trials |

Trials run one at a time: each sets the environment its sessions inherit.
