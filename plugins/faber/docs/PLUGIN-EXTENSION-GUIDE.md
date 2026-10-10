# FABER Plugin Extension Guide

**Audience:** authors of FABER packs, the plugins that add domain skills and workflows on top of core FABER. Examples are faber-code, faber-cloud, faber-content, faber-ingest and faber-video.

This guide covers how a pack is laid out and wired into projects. For what core expects from a pack's steps, validators, approvals and permissions, and the conformance checklist, see [PACK-BEST-PRACTICES.md](./PACK-BEST-PRACTICES.md).

## What a pack provides

- **Skills** for the pack's domain: research, design, build, deploy and validate.
- **Workflows** that extend core FABER's `core` workflow with steps that use those skills.
- Optionally, a **config section** in `.fractary/config.yaml` for pack settings (for example `faber-cloud:`), validated by the pack's config schema. Standards and thresholds belong there or in standards docs, not in prompts.

Core owns the five phases (Frame, Architect, Build, Evaluate, Release), the runtime and the run records. A pack adds steps within those phases; it does not add phases.

## Layout

A pack is a Claude Code plugin, published from a repository that is also its marketplace:

```
<repo>/
├── .claude-plugin/
│   └── marketplace.json                # lists the plugin
└── plugins/<pack>/
    ├── .claude-plugin/
    │   └── plugin.json                 # {"name", "version", "description", "skills": "./skills/"}
    ├── skills/
    │   └── fractary-faber-<pack>-<name>/
    │       ├── SKILL.md
    │       └── scripts/ ...            # and reference files the skill reads
    ├── .fractary/faber/workflows/
    │   └── <workflow-id>.json          # workflows the pack ships
    └── config/                         # config schema and defaults (optional)
```

- **Skills, not commands.** Put each capability in a skill. A workflow step calls it by name: `/fractary-faber-code-engineer --work-id {work_id}`, or "Use the fractary-faber-code-engineer skill to ...". Prefix every skill with the pack name, as in `fractary-faber-code-engineer`. There is no `plugin:command` colon form.
- **Agents.** A skill may delegate to a subagent in `agents/`. Its final output must then be the subagent's FABER response block, passed through verbatim (see the [runtime contract](./PACK-BEST-PRACTICES.md#1-runtime-contract)).

## Workflows

A pack workflow extends core and adds its steps:

```json
{
  "$schema": "https://raw.githubusercontent.com/fractary/faber/main/plugins/faber/config/workflow.schema.json",
  "id": "default",
  "description": "Software development workflow",
  "extends": "faber@fractary-faber:core",
  "phases": {
    "build": {
      "pre_steps": [
        {
          "id": "build-engineer",
          "name": "Engineer Solution",
          "prompt": "Use the fractary-faber-code-engineer skill to implement the solution for work item {work_id}."
        },
        {
          "id": "build-engineer-validate",
          "name": "Validate Engineer Work",
          "role": "validator",
          "prompt": "Use the fractary-faber-code-validate skill with type 'engineering' for work item {work_id}.",
          "permission_mode": "dontAsk",
          "allowed_tools": ["Bash(npm test *)", "Bash(npm run lint *)"]
        }
      ]
    }
  },
  "autonomy": {
    "level": "guarded",
    "require_approval_for": ["evaluate-deploy-apply-test"]
  }
}
```

- **Steps** have an `id` that is unique across the merged workflow, a `name` and a `prompt`. They may add `role`, `result_handling` and runtime fields. The old `skill` and `command` step fields are deprecated. Every field is listed in [WORKFLOW-STEP-REFERENCE.md](./WORKFLOW-STEP-REFERENCE.md).
- **Inheritance:** a phase runs its `pre_steps`, then its main `steps`, then its `post_steps`.
  - `pre_steps` from every workflow in the chain run, the root's first.
  - `post_steps` from every workflow run, the child's first.
  - Main `steps` come from the nearest workflow that defines them, so setting `steps` replaces the parent's.
  - `skip_steps` drops inherited steps by ID.
  - Approval gates add up: `autonomy.require_approval_for` is the union of every workflow in the chain. `pause_before_release`, `level`, `result_handling`, and a phase's `require_approval` and `max_retries` come from the nearest workflow that sets them.
- **References:**
  - `extends` uses the form `<plugin>@<marketplace>:<workflow>`; core is `faber@fractary-faber:core`.
  - A project refers to your workflow the same way, for example `faber-code@fractary-faber-code:default`.

## How projects use a pack

1. **Install the plugin**: `/plugin install <plugin>@<marketplace>`. CLI runs load only the project's Claude settings (`settingSources: ['project']`), so enable the plugin for the project in `.claude/settings.json`, not only for your user.
2. **Add a project workflow** that extends the pack's workflow. Put project-specific steps or `context` overlays in it, rather than copying the pack's file:

   ```json
   {
     "id": "app",
     "extends": "faber-code@fractary-faber-code:default"
   }
   ```

   Save it as `.fractary/faber/workflows/app.json`. Check the merged result with `fractary-faber workflow-resolve app`.
3. **Plan and run:**
   - Plan with `fractary-faber workflow-plan --work-id 123 --workflow app`, or label the issue `workflow:app`.
   - Run with `fractary-faber workflow-execute <plan.json>` or `/fractary-faber-workflow-run <plan-id>`.

## Issue templates (optional)

A pack can ship GitHub issue templates whose labels include `workflow:<id>`. `workflow-plan` then picks that workflow for issues created from the template. Keep templates in the pack (for example `config/issue-templates/`). Document how a project copies them into `.github/ISSUE_TEMPLATE/`.

## Before you release

- Go through the [conformance checklist](./PACK-BEST-PRACTICES.md#11-conformance-checklist) and keep it in the pack README.
- CI runs the pack's tests.
- Every workflow resolves: run `fractary-faber workflow-resolve` for each one.

## See Also

- [PACK-BEST-PRACTICES.md](./PACK-BEST-PRACTICES.md): what core expects from a pack, with status tags and the checklist
- [WORKFLOW-STEP-REFERENCE.md](./WORKFLOW-STEP-REFERENCE.md): workflow fields that CLI runs read
- [FABER-SKILL-BEST-PRACTICES.md](./FABER-SKILL-BEST-PRACTICES.md): the FABER response block
- [RESULT-HANDLING.md](./RESULT-HANDLING.md): `on_failure`, retries and handlers
- [PROJECT-INTEGRATION-GUIDE.md](./PROJECT-INTEGRATION-GUIDE.md): adopting FABER in a project
