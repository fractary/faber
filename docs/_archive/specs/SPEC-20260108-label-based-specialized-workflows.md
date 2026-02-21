# SPEC-20260108: Label-Based Specialized Workflows for Bug and Feature Work Types

**Status:** Draft
**Created:** 2026-01-08
**Author:** System
**Related Issues:** N/A

## Executive Summary

This specification defines specialized FABER workflows for `bug` and `feature` work types that optimize the development process for each type of work. The proposal introduces intelligent workflow selection using both GitHub labels and WorkType classification, while maintaining the existing 5-phase workflow structure through inheritance from the core workflow.

## Background

### Current State

The FABER workflow system currently uses a single "default" workflow that treats all issue types (bugs, features, chores, patches) identically. While the system classifies work types and uses them for branch naming, the actual workflow execution and steps are the same regardless of whether the issue is a critical bug fix or a complex new feature.

**Existing Infrastructure:**
- Core workflow (`core.json`) with 5 phases: Frame, Architect, Build, Evaluate, Release
- Default workflow (`default.json`) that extends core and adds spec generation
- WorkType classification system that categorizes issues as bug, feature, chore, patch, etc.
- Label-based workflow mapping (`workflow_inference.label_mapping`) that is underutilized
- Branch naming that differs by work type (`fix/`, `feat/`, etc.)

### Problem Statement

Different types of work have fundamentally different needs:

**Bug Fixes** require:
- Focus on reproduction and root cause analysis
- Minimal scope to reduce risk
- Strong regression testing
- Fast-track approval for critical issues

**Features** require:
- Comprehensive requirements and design
- Full technical specifications
- Extensive testing and documentation
- Thorough review process

**Current Limitations:**
1. All issues go through the same workflow regardless of type
2. Label mapping exists but only maps to a single "default" workflow
3. WorkType classification is performed but not used for workflow selection
4. No way to optimize workflows for specific work types without creating entirely custom workflows

## Goals

### Primary Goals
1. Create specialized workflows for `bug` and `feature` work types
2. Implement intelligent workflow selection using labels and WorkType classification
3. Maintain the 5-phase structure through inheritance from core workflow
4. Provide clear differentiation in steps and configuration within each phase

### Secondary Goals
1. Maintain backward compatibility with existing workflows
2. Establish extensible framework for additional specialized workflows
3. Document workflow selection strategy clearly
4. Provide graceful fallbacks when workflow selection is ambiguous

### Non-Goals
1. Skipping phases entirely (all workflows use all 5 phases)
2. Creating workflows for all work types in initial implementation (only bug and feature)
3. Automatic workflow migration for existing issues
4. Real-time workflow switching during execution

## Proposed Solution

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Workflow Selection                    │
│                                                          │
│  1. workflow: label prefix (highest priority)           │
│  2. label_mapping configuration                          │
│  3. WorkType classification + mapping                    │
│  4. default_workflow (fallback)                          │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                  Workflow Execution                      │
│                                                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐         │
│  │   Bug    │    │ Feature  │    │ Default  │         │
│  │ Workflow │    │ Workflow │    │ Workflow │         │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘         │
│       │               │               │                 │
│       └───────────────┴───────────────┘                 │
│                       ↓                                  │
│              ┌─────────────────┐                        │
│              │  Core Workflow  │                        │
│              │   (5 phases)    │                        │
│              └─────────────────┘                        │
└─────────────────────────────────────────────────────────┘
```

### Component 1: Specialized Workflow Files

#### Bug Workflow (`plugins/faber/config/workflows/bug.json`)

**Design Principles:**
- Emphasize speed and validation
- Focus on root cause analysis
- Minimal scope to reduce risk
- Strong regression testing

**Phase Customizations:**

**Frame Phase:**
- Add step: "Clarify bug details" - Focus on reproduction steps, expected vs actual behavior, impact assessment
- Ensure bug report completeness before proceeding

**Architect Phase:**
- Use `bug` spec template (minimal, focused)
- Emphasize root cause analysis
- Define minimal scope
- Plan regression tests

**Build Phase:**
- Add step: "Verify bug reproduction" - Ensure bug is reproducible before fixing
- Create failing test that demonstrates the bug
- Targeted implementation only

**Evaluate Phase:**
- Add step: "Validate bug is fixed" - Explicit bug validation beyond "tests pass"
- Verify regression tests pass
- Confirm minimal scope maintained

**Release Phase:**
- Standard approval process (guarded autonomy)
- Post-step: Document fix in changelog/release notes

#### Feature Workflow (`plugins/faber/config/workflows/feature.json`)

**Design Principles:**
- Emphasize thoroughness and documentation
- Comprehensive technical design
- Full testing strategy
- Standard approval gates

**Phase Customizations:**

**Frame Phase:**
- Add step: "Clarify feature requirements" - Focus on user value, success criteria, scope, constraints
- Ensure requirements clarity

**Architect Phase:**
- Use `feature` spec template (comprehensive)
- Include: user stories, technical design, API changes, data model, testing strategy
- Add step: "Validate technical design" - Review design soundness

**Build Phase:**
- Add step: "Implement with documentation" - Require inline docs, user guides, examples
- Comprehensive implementation

**Evaluate Phase:**
- Add step: "Comprehensive testing" - Unit, integration, E2E, performance testing
- Add step: "Validate acceptance criteria" - Explicit validation against spec

**Release Phase:**
- Standard approval process
- Post-step: Document feature in changelog, README, migration notes

### Component 2: Enhanced Workflow Selection Logic

#### Four-Tier Selection Strategy

```typescript
/**
 * Workflow Selection Algorithm
 *
 * Priority (highest to lowest):
 * 1. Explicit workflow: label prefix
 * 2. Label mapping from configuration
 * 3. WorkType classification + mapping
 * 4. Default fallback
 */
async function selectWorkflow(
  issue: Issue,
  config: FaberConfig
): Promise<string> {
  // Tier 1: Explicit workflow: label (e.g., workflow:hotfix)
  const workflowLabel = issue.labels.find(l =>
    l.name.startsWith('workflow:')
  );
  if (workflowLabel) {
    const workflowId = workflowLabel.name.replace('workflow:', '');
    logger.debug(`Selected workflow from explicit label: ${workflowId}`);
    return workflowId;
  }

  // Tier 2: Label mapping from config
  if (config.workflow_inference?.label_mapping) {
    for (const label of issue.labels) {
      const mappedWorkflow = config.workflow_inference.label_mapping[label.name];
      if (mappedWorkflow) {
        logger.debug(`Selected workflow from label mapping: ${label.name} -> ${mappedWorkflow}`);
        return mappedWorkflow;
      }
    }
  }

  // Tier 3: WorkType classification + mapping
  if (config.workflow_inference?.fallback_to_classification) {
    const workType = await workManager.classifyWorkType(issue);
    logger.debug(`Classified issue as work type: ${workType}`);

    const workTypeMapping = config.workflow_inference?.work_type_mapping || {
      'bug': 'bug',
      'feature': 'feature',
      'patch': 'bug',
      'chore': 'default',
      'infrastructure': 'default',
      'api': 'feature'
    };

    if (workTypeMapping[workType]) {
      logger.debug(`Selected workflow from work type mapping: ${workType} -> ${workTypeMapping[workType]}`);
      return workTypeMapping[workType];
    }
  }

  // Tier 4: Default fallback
  const defaultWorkflow = config.default_workflow || 'fractary-faber:default';
  logger.debug(`Using default workflow: ${defaultWorkflow}`);
  return defaultWorkflow;
}
```

#### Configuration Structure

```json
{
  "schema_version": "2.0",
  "default_workflow": "fractary-faber:default",

  "workflows": [
    {
      "id": "default",
      "file": "./workflows/default.json",
      "description": "General-purpose workflow for any issue type"
    },
    {
      "id": "bug",
      "file": "./workflows/bug.json",
      "description": "Optimized workflow for bug fixes with emphasis on validation"
    },
    {
      "id": "feature",
      "file": "./workflows/feature.json",
      "description": "Comprehensive workflow for new features with full design"
    }
  ],

  "workflow_inference": {
    "enabled": true,

    "label_mapping": {
      "bug": "bug",
      "defect": "bug",
      "regression": "bug",
      "hotfix": "bug",
      "urgent": "bug",

      "feature": "feature",
      "enhancement": "feature",
      "new-feature": "feature",

      "chore": "default",
      "maintenance": "default",
      "dependencies": "default"
    },

    "fallback_to_classification": true,

    "work_type_mapping": {
      "bug": "bug",
      "feature": "feature",
      "patch": "bug",
      "chore": "default",
      "infrastructure": "default",
      "api": "feature"
    }
  }
}
```

### Component 3: Implementation Details

#### File Changes

**New Files:**
1. `plugins/faber/config/workflows/bug.json` - Bug workflow definition
2. `plugins/faber/config/workflows/feature.json` - Feature workflow definition
3. `specs/SPEC-20260108-label-based-specialized-workflows.md` - This specification

**Modified Files:**
1. `plugins/faber/agents/faber-planner.md` - Add workflow selection documentation
2. `sdk/js/src/workflow/config.ts` (or create if needed) - Implement selection function
3. `plugins/faber/config/config.schema.json` - Add new config options
4. `plugins/faber/config/faber.example.json` - Update example configuration
5. `plugins/faber/config/workflows/README.md` - Document workflow selection
6. `cli/src/commands/plan/index.ts` - Integrate workflow selection

#### Code Integration Points

**Workflow Selection (faber-planner):**
```typescript
// In plan command or planner agent
const workflow = await selectWorkflow(issue, config);
logger.info(`Selected workflow: ${workflow} for issue #${issue.number}`);

// Load and merge workflow
const resolvedWorkflow = await mergeWorkflows(workflow, config);

// Include in plan
plan.workflow = resolvedWorkflow;
```

**Configuration Loading:**
```typescript
// Validate workflow_inference configuration
const WorkflowInferenceSchema = z.object({
  enabled: z.boolean().default(true),
  label_mapping: z.record(z.string()).optional(),
  fallback_to_classification: z.boolean().default(true),
  work_type_mapping: z.record(z.string()).optional()
});
```

## Workflow Specifications

### Bug Workflow Detailed Specification

#### Phase: Frame
**Goal:** Ensure bug report is complete and reproducible

**Steps:**
1. **clarify-bug** (new step)
   - Prompt: Review bug report for completeness
   - Check: Reproduction steps, expected vs actual behavior, impact, environment
   - Action: Request clarification via issue comment if needed
   - Context: Focus on reproduction reliability

#### Phase: Architect
**Goal:** Create focused specification with root cause analysis

**Steps:**
1. **generate-bug-spec** (customized)
   - Template: `bug` (minimal, focused)
   - Context: Root cause analysis, minimal scope, regression prevention
   - Required sections: Bug description, root cause, fix approach, regression tests

2. **refine-bug-spec** (customized)
   - Focus areas: root-cause, scope, regression-tests
   - Validation: Ensure scope is minimal and targeted

#### Phase: Build
**Goal:** Implement targeted fix with verification

**Steps:**
1. **verify-reproduction** (new step)
   - Action: Reproduce bug using spec reproduction steps
   - Action: Create failing test demonstrating the bug
   - Action: Document any additional root cause findings
   - Validation: Bug must be reproducible before proceeding

2. **implement-fix** (inherited from core)
   - Context: Follow minimal scope from spec
   - Focus: Targeted implementation only

#### Phase: Evaluate
**Goal:** Validate bug is fixed and no regressions introduced

**Steps:**
1. **validate-bug-fix** (new step)
   - Check: Reproduction test now passes
   - Check: Regression tests for related functionality pass
   - Check: Fix is minimal and targeted
   - Check: No new issues introduced
   - Output: Validation report

2. **run-tests** (inherited from core)
   - Standard test execution

#### Phase: Release
**Goal:** Merge and document fix

**Steps:**
1. **create-pr** (inherited from core)
   - PR title format: `fix: <description>`

2. **merge-pr** (inherited from core)
   - Requires approval (guarded)

3. **document-fix** (new post-step)
   - Add CHANGELOG entry
   - Update issue with "Fixed in version X"
   - Note any workarounds to remove

### Feature Workflow Detailed Specification

#### Phase: Frame
**Goal:** Ensure feature requirements are clear and complete

**Steps:**
1. **clarify-feature** (new step)
   - Prompt: Review feature request for completeness
   - Check: User value, success criteria, scope, constraints, dependencies
   - Action: Request clarification via issue comment if needed
   - Context: Focus on user needs and technical approach

#### Phase: Architect
**Goal:** Create comprehensive specification with technical design

**Steps:**
1. **generate-feature-spec** (customized)
   - Template: `feature` (comprehensive)
   - Context: User stories, technical design, API changes, data model, testing strategy
   - Required sections: All feature template sections

2. **refine-feature-spec** (customized)
   - Focus areas: completeness, technical-approach, testing, documentation
   - Validation: Ensure all aspects covered

3. **validate-design** (new step)
   - Check: Integration with existing architecture
   - Check: API contracts clearly defined
   - Check: Data model complete
   - Check: Performance implications considered
   - Check: Testing strategy comprehensive
   - Action: Refine spec if concerns exist

#### Phase: Build
**Goal:** Implement feature with comprehensive documentation

**Steps:**
1. **implement-with-docs** (new step)
   - Action: Implement per specification
   - Action: Add inline documentation for complex logic
   - Action: Create/update user documentation
   - Action: Add examples or usage guides
   - Context: Features require comprehensive documentation

2. **implement-feature** (inherited from core)
   - Standard implementation

#### Phase: Evaluate
**Goal:** Comprehensive validation of feature functionality

**Steps:**
1. **comprehensive-testing** (new step)
   - Test: Unit tests for core logic
   - Test: Integration tests with existing features
   - Test: End-to-end user scenarios
   - Test: Performance/load testing (if applicable)
   - Test: Documentation accuracy
   - Output: Complete test report

2. **validate-acceptance-criteria** (new step)
   - Check: All acceptance criteria met
   - Check: User stories fulfilled
   - Check: Edge cases handled
   - Check: Error handling appropriate
   - Output: Validation checklist

3. **run-tests** (inherited from core)
   - Standard test execution

#### Phase: Release
**Goal:** Merge and document feature release

**Steps:**
1. **create-pr** (inherited from core)
   - PR title format: `feat: <description>`

2. **merge-pr** (inherited from core)
   - Requires approval (guarded)

3. **document-feature** (new post-step)
   - Add CHANGELOG entry with feature description
   - Update README if feature changes usage
   - Note migration steps if applicable
   - Update issue with "Released in version X"

## Benefits

### For Development Teams
1. **Optimized workflows** for common work types reduce unnecessary overhead
2. **Clear guidance** on what's expected for each type of work
3. **Faster bug fixes** with streamlined validation-focused workflow
4. **Better feature quality** with comprehensive design and testing requirements

### For System Architecture
1. **Extensible framework** makes it easy to add more specialized workflows
2. **Backward compatible** - existing workflows continue to work
3. **Graceful degradation** - falls back to default when unclear
4. **Consistent structure** - all workflows inherit from core

### For Workflow Selection
1. **Multi-tier strategy** ensures appropriate workflow is chosen
2. **Flexible labeling** - supports both explicit and inferred selection
3. **Smart fallbacks** - uses WorkType classification when labels absent
4. **Configurable mappings** - teams can customize label-to-workflow mappings

## Risks and Mitigations

### Risk 1: Workflow Selection Confusion
**Risk:** Users may be unclear which workflow will be selected
**Likelihood:** Medium
**Impact:** Medium
**Mitigation:**
- Clear documentation of selection strategy
- Verbose logging in plan command showing selection rationale
- Plan output shows which workflow was selected and why

### Risk 2: Spec Template Not Matching Workflow
**Risk:** Bug workflow might reference spec template that doesn't exist
**Likelihood:** Low
**Impact:** High
**Mitigation:**
- Validate spec templates exist before workflow execution
- Include spec template creation in implementation plan
- Fallback to basic template if specified template not found

### Risk 3: Increased Complexity
**Risk:** Multiple workflows may confuse new users
**Likelihood:** Medium
**Impact:** Low
**Mitigation:**
- Keep default workflow as general-purpose fallback
- Clear documentation and examples
- Selection happens automatically - users don't need to understand it

### Risk 4: Maintenance Overhead
**Risk:** Multiple workflows require more maintenance
**Likelihood:** Medium
**Impact:** Low
**Mitigation:**
- Workflows inherit from core - core updates apply to all
- Only customize what differs between workflows
- Automated testing for each workflow type

## Testing Strategy

### Unit Tests
```typescript
describe('Workflow Selection', () => {
  it('should select workflow from explicit workflow: label', async () => {
    const issue = {
      labels: [{ name: 'workflow:custom' }, { name: 'bug' }]
    };
    const workflow = await selectWorkflow(issue, config);
    expect(workflow).toBe('custom');
  });

  it('should select workflow from label_mapping', async () => {
    const issue = {
      labels: [{ name: 'bug' }]
    };
    const workflow = await selectWorkflow(issue, config);
    expect(workflow).toBe('bug');
  });

  it('should classify work type and select workflow', async () => {
    const issue = {
      title: 'Fix login error',
      labels: []
    };
    const workflow = await selectWorkflow(issue, config);
    expect(workflow).toBe('bug');
  });

  it('should fall back to default workflow', async () => {
    const issue = {
      title: 'Update documentation',
      labels: []
    };
    const workflow = await selectWorkflow(issue, config);
    expect(workflow).toBe('fractary-faber:default');
  });
});
```

### Integration Tests
```bash
# Test bug workflow
npm test -- --testNamePattern="bug workflow execution"

# Test feature workflow
npm test -- --testNamePattern="feature workflow execution"

# Test workflow selection
npm test -- --testNamePattern="workflow selection"
```

### Manual Testing Scenarios

**Scenario 1: Bug with explicit label**
- Create issue with `bug` label
- Run `/fractary-faber:plan --work-id <id>`
- Verify: Bug workflow selected, bug-specific steps present

**Scenario 2: Feature from WorkType classification**
- Create issue with no labels, title: "Add user authentication"
- Run plan command
- Verify: Feature workflow selected via classification

**Scenario 3: Explicit workflow override**
- Create issue with `workflow:custom` label
- Run plan command
- Verify: Custom workflow selected, ignoring other labels

**Scenario 4: Fallback to default**
- Create issue with ambiguous title/labels
- Run plan command
- Verify: Default workflow selected

## Migration Strategy

### Phase 1: Implementation (This Spec)
1. Create bug.json and feature.json workflow files
2. Implement workflow selection logic
3. Update configuration schema
4. Add documentation
5. Create tests

### Phase 2: Rollout
1. Deploy to development environment
2. Test with real issues
3. Gather feedback from team
4. Refine workflows based on usage

### Phase 3: Adoption
1. Document best practices for labeling issues
2. Update project templates to include appropriate labels
3. Train team on workflow selection
4. Monitor usage and success metrics

### Phase 4: Expansion (Future)
1. Add hotfix workflow for urgent patches
2. Add chore workflow for maintenance
3. Add infrastructure workflow for infra changes
4. Consider documentation-only workflow

## Future Enhancements

### Short Term (Next Quarter)
1. **Hotfix workflow** - Ultra-fast emergency fixes with minimal gates
2. **Workflow analytics** - Track which workflows used, success rates, time to completion
3. **Workflow recommendations** - Suggest best workflow when ambiguous

### Medium Term (6 Months)
1. **Chore workflow** - Optimized for refactoring and maintenance
2. **Infrastructure workflow** - Specialized for infrastructure changes
3. **Smart workflow switching** - Allow workflow changes mid-execution (with constraints)

### Long Term (1 Year)
1. **Custom workflow generator** - CLI to scaffold new workflows
2. **Machine learning** - Learn from past issues to improve classification
3. **Workflow marketplace** - Share workflows across teams/organizations

## Success Metrics

### Quantitative Metrics
1. **Workflow selection accuracy**: % of issues that get appropriate workflow
   - Target: >90% accuracy
   - Measure: Manual review of sample issues

2. **Bug fix time**: Average time from bug report to fix deployed
   - Baseline: Current average
   - Target: 20% reduction with bug workflow

3. **Feature quality**: Defects found post-release for features
   - Baseline: Current defect rate
   - Target: 15% reduction with feature workflow

4. **Workflow usage**: Distribution of workflow usage
   - Track: How often each workflow is selected
   - Goal: Bug and feature workflows used appropriately

### Qualitative Metrics
1. **Developer satisfaction**: Team feedback on workflow effectiveness
2. **Clarity**: Reduction in questions about "what should I do next"
3. **Documentation quality**: Improvement in spec and docs quality

## Documentation Requirements

### User Documentation
1. **Workflow selection guide** - How workflows are selected
2. **Bug workflow guide** - How to use bug workflow effectively
3. **Feature workflow guide** - How to use feature workflow effectively
4. **Labeling best practices** - How to label issues for correct workflow selection

### Technical Documentation
1. **Workflow structure reference** - How workflows are structured
2. **Selection algorithm** - Technical details of selection logic
3. **Configuration reference** - All configuration options explained
4. **Extension guide** - How to create custom workflows

### Examples
1. Example bug workflow execution
2. Example feature workflow execution
3. Example workflow selection scenarios
4. Example custom workflow

## Appendix

### A. Workflow Selection Decision Tree

```
┌─────────────────────────────────┐
│   Issue has workflow: label?    │
└────────────┬────────────────────┘
             │
        Yes  │  No
             ↓
    ┌────────────────┐
    │ Use that       │
    │ workflow       │
    └────────────────┘
             │
             │  No
             ↓
┌─────────────────────────────────┐
│ Issue has label in label_mapping?│
└────────────┬────────────────────┘
             │
        Yes  │  No
             ↓
    ┌────────────────┐
    │ Use mapped     │
    │ workflow       │
    └────────────────┘
             │
             │  No
             ↓
┌─────────────────────────────────┐
│ Classify work type              │
│ Check work_type_mapping         │
└────────────┬────────────────────┘
             │
        Yes  │  No
             ↓
    ┌────────────────┐
    │ Use mapped     │
    │ workflow       │
    └────────────────┘
             │
             │  No
             ↓
    ┌────────────────┐
    │ Use default    │
    │ workflow       │
    └────────────────┘
```

### B. Workflow Comparison Matrix

| Aspect | Core | Default | Bug | Feature |
|--------|------|---------|-----|---------|
| **Extends** | - | core | core | core |
| **Frame Steps** | 1 | 1 | 2 | 2 |
| **Architect Steps** | 0 | 2 | 2 | 3 |
| **Build Steps** | 1 | 1 | 2 | 2 |
| **Evaluate Steps** | 1 | 1 | 2 | 3 |
| **Release Steps** | 1 | 1 | 1 | 1 |
| **Post Steps** | 0 | 0 | 1 | 1 |
| **Spec Template** | - | generic | bug | feature |
| **Autonomy** | guarded | guarded | guarded | guarded |
| **Best For** | base | general | bugs | features |

### C. Label Mapping Examples

```json
{
  "workflow_inference": {
    "label_mapping": {
      // Bug-related labels → bug workflow
      "bug": "bug",
      "defect": "bug",
      "regression": "bug",
      "hotfix": "bug",
      "urgent": "bug",
      "security": "bug",

      // Feature-related labels → feature workflow
      "feature": "feature",
      "enhancement": "feature",
      "new-feature": "feature",
      "improvement": "feature",

      // Maintenance labels → default workflow
      "chore": "default",
      "maintenance": "default",
      "dependencies": "default",
      "refactor": "default",

      // Explicit workflow overrides
      "workflow:hotfix": "hotfix",
      "workflow:data-pipeline": "data-pipeline"
    }
  }
}
```

### D. References

- FABER Core Workflow: `plugins/faber/config/workflows/core.json`
- FABER Default Workflow: `plugins/faber/config/workflows/default.json`
- Workflow Schema: `plugins/faber/config/workflow.schema.json`
- Configuration Schema: `plugins/faber/config/config.schema.json`
- WorkType Classification: `sdk/js/src/work/manager.ts:266-304`
- Label Extraction: `sdk/js/src/work/providers/github.ts:386-412`

## Approval

This specification requires approval from:
- [ ] Technical Lead
- [ ] Product Owner
- [ ] DevOps Lead

## Change Log

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-01-08 | 1.0 | System | Initial specification |
