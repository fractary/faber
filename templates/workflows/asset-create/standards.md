# Asset Creation Workflow Standards

## Overview

This document defines the standards and best practices for workflows created from the `asset-create` template. These standards ensure consistent, high-quality asset creation across projects.

## Required Standards

### 1. Research First

**Rule**: ALWAYS complete research before implementation.

The frame phase must gather comprehensive requirements before any build work begins. This includes:
- Understanding user requirements and business context
- Analyzing existing patterns in the codebase
- Identifying dependencies and integration points
- Documenting constraints and limitations

**Validation**:
- Research document must exist before architect phase
- All requirements must be documented
- Dependencies must be mapped

### 2. Validate Each Phase

**Rule**: Each phase MUST have validation steps.

Every phase should verify its outputs before progressing:
- Frame: Validate research completeness
- Architect: Validate design feasibility
- Build: Run tests and static analysis
- Evaluate: Verify test deployment
- Release: Confirm production readiness

**Validation**:
- Each phase has at least one validation step
- Validation criteria are explicitly defined
- Failures block progression to next phase

### 3. Document Continuously

**Rule**: Documentation MUST be produced at each phase.

Don't leave documentation for the end:
- Frame: Research summary document
- Architect: Architecture specification
- Build: API/usage documentation
- Evaluate: Test results and deployment notes
- Release: Final documentation sync to codex

**Validation**:
- Each phase produces documentation artifacts
- Documentation matches implementation
- Final sync to codex is complete

### 4. Test Before Production

**Rule**: NEVER skip test environment deployment.

All assets must be deployed and validated in a test environment before production:
- Deploy to test environment in evaluate phase
- Run integration tests against test deployment
- Verify logs are error-free
- Validate functionality matches specification

**Validation**:
- Evaluate phase is enabled and has deployment steps
- Test deployment is successful
- Integration tests pass

### 5. Require Production Approval

**Rule**: Production deployment MUST require explicit approval.

The release phase must have approval gates:
- Set `require_approval: true` on release phase
- Include production deployment step in `require_approval_for`
- Ensure human review before production changes

**Validation**:
- Release phase has `require_approval: true`
- Production deployment step requires approval

## Validation Rules

### Step ID Patterns

Step IDs must follow the `{asset_type}-{action}` pattern:

| Phase | Pattern | Examples |
|-------|---------|----------|
| Frame | `{asset}-research*`, `{asset}-gather*`, `{asset}-analyze*` | `dataset-research`, `api-gather-requirements` |
| Architect | `{asset}-architect*`, `{asset}-design*`, `{asset}-spec*` | `catalog-architect`, `model-design-schema` |
| Build | `{asset}-engineer*`, `{asset}-implement*`, `{asset}-build*` | `dataset-engineer`, `api-implement-endpoints` |
| Evaluate | `{asset}-deploy-test*`, `{asset}-validate*`, `{asset}-test*` | `catalog-deploy-test`, `report-validate-deployment` |
| Release | `{asset}-deploy-production*`, `{asset}-release*`, `{asset}-sync*` | `dataset-deploy-production`, `api-sync-codex` |

### Minimum Steps Per Phase

| Phase | Minimum Steps | Rationale |
|-------|---------------|-----------|
| Frame | 2 | Research + validation |
| Architect | 2 | Design + validation |
| Build | 2 | Implementation + validation |
| Evaluate | 1 | Test deployment |
| Release | 1 | Production deployment |

### Required Integrations

| Phase | Required | Optional |
|-------|----------|----------|
| Evaluate | faber-cloud | - |
| Release | faber-cloud | codex |

## Anti-Patterns

### 1. Skipping Research

**Problem**: Jumping directly to implementation without understanding requirements.

**Symptoms**:
- No research steps in frame phase
- `skip_research: true` without justification
- Frame phase has only documentation steps

**Solution**: Always include research and research-validate steps.

### 2. Missing Validation

**Problem**: Not validating outputs at each phase.

**Symptoms**:
- Phases without validation steps
- Empty `validation` arrays
- Validation steps at end only

**Solution**: Add validation step after each major action.

### 3. Documentation Debt

**Problem**: Leaving all documentation for the end.

**Symptoms**:
- No document steps in frame/architect/build phases
- All documentation in release phase
- `skip_codex_sync: true` without alternative

**Solution**: Include documentation steps in every phase.

### 4. Skipping Test Environment

**Problem**: Deploying directly to production.

**Symptoms**:
- Evaluate phase disabled
- No test deployment steps
- Production deployment in build phase

**Solution**: Always use evaluate phase for test deployment.

### 5. No Production Approval

**Problem**: Automatic production deployment without review.

**Symptoms**:
- `require_approval: false` on release phase
- Empty `require_approval_for` array
- Production step not in approval list

**Solution**: Always require approval for production deployment.

## Quality Checklist

Use this checklist when reviewing asset-create workflows:

### Structure
- [ ] Workflow has `workflow_type: "asset-create"`
- [ ] Workflow has valid `asset_type` field
- [ ] All five phases are defined and enabled
- [ ] Workflow extends `fractary-faber:core` or appropriate parent

### Frame Phase
- [ ] Has research step(s)
- [ ] Has research validation step
- [ ] Has documentation step
- [ ] Validation criteria defined

### Architect Phase
- [ ] Has design/architecture step
- [ ] Has validation step
- [ ] Has documentation step
- [ ] Validation criteria defined

### Build Phase
- [ ] Has implementation step
- [ ] Has test/validation step
- [ ] Has documentation step
- [ ] Validation criteria defined

### Evaluate Phase
- [ ] Uses faber-cloud for deployment
- [ ] Deploys to test environment
- [ ] Has deployment validation step
- [ ] `max_retries` is set (recommended: 2-3)

### Release Phase
- [ ] `require_approval: true` is set
- [ ] Production deployment requires approval
- [ ] Uses faber-cloud for deployment
- [ ] Codex sync step included (unless explicitly skipped)

### Autonomy
- [ ] Autonomy level is appropriate (guarded recommended)
- [ ] `pause_before_release: true` is set
- [ ] Production deployment step in `require_approval_for`

## Examples

### Minimal Valid Workflow

```json
{
  "id": "dataset-create",
  "workflow_type": "asset-create",
  "asset_type": "dataset",
  "extends": "fractary-faber:core",
  "phases": {
    "frame": {
      "enabled": true,
      "steps": [
        {"id": "dataset-research", "prompt": "..."},
        {"id": "dataset-research-validate", "prompt": "..."}
      ]
    },
    "architect": {
      "enabled": true,
      "steps": [
        {"id": "dataset-architect", "prompt": "..."},
        {"id": "dataset-architect-validate", "prompt": "..."}
      ]
    },
    "build": {
      "enabled": true,
      "steps": [
        {"id": "dataset-engineer", "prompt": "..."},
        {"id": "dataset-engineer-validate", "prompt": "..."}
      ]
    },
    "evaluate": {
      "enabled": true,
      "steps": [
        {"id": "dataset-deploy-test", "command": "/fractary-faber-cloud:deploy-apply"}
      ]
    },
    "release": {
      "enabled": true,
      "require_approval": true,
      "steps": [
        {"id": "dataset-deploy-production", "command": "/fractary-faber-cloud:deploy-apply"}
      ]
    }
  },
  "autonomy": {
    "level": "guarded",
    "require_approval_for": ["dataset-deploy-production"]
  }
}
```

### Invalid Workflow Examples

**Missing validation steps**:
```json
// BAD: No validation in build phase
"build": {
  "steps": [
    {"id": "dataset-engineer", "prompt": "..."}
    // Missing: dataset-engineer-validate
  ]
}
```

**Wrong step ID pattern**:
```json
// BAD: Step ID doesn't match asset type
"frame": {
  "steps": [
    {"id": "research-requirements", "prompt": "..."}  // Should be: dataset-research
  ]
}
```

**Missing production approval**:
```json
// BAD: Production deployment without approval
"release": {
  "require_approval": false,  // Should be true
  "steps": [
    {"id": "dataset-deploy-production", "..."}
  ]
}
```

## Related Documentation

- [Workflow Schema](../../../plugins/faber/config/workflow.schema.json) - JSON schema for workflows
- [FABER Response Format](../../../plugins/faber/docs/RESPONSE-FORMAT.md) - Step response format
- [faber-cloud Documentation](../../../plugins/faber-cloud/docs/) - Cloud deployment integration
- [codex Documentation](../../../plugins/codex/docs/) - Documentation sync
