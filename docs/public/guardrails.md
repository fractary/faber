---
title: Intelligent Guardrails
description: How FABER balances AI autonomy with human oversight
visibility: public
---

# Intelligent Guardrails

This guide explains FABER's approach to AI safety: how it balances autonomous operation with appropriate human oversight.

## The Core Problem

Most AI automation systems fall into one of two failure modes:

| Approach | Problem |
|----------|---------|
| **Approve Everything** | Human becomes the bottleneck. You've built an expensive approval-generating machine. |
| **Approve Nothing** | AI makes expensive mistakes. Enterprises won't adopt unpredictable systems. |

Neither extreme works. FABER takes a different approach.

## The FABER Approach

**AI operates autonomously within defined boundaries, escalates intelligently when boundaries are approached.**

This creates asymmetric human involvement:
- **90% of work**: AI autonomous, human informed asynchronously
- **10% of work**: AI pauses, human decides before proceeding

The key is knowing which 10% matters—and that's where intelligent guardrails come in.

## Three Layers of Protection

FABER provides three complementary guardrail systems:

```
┌─────────────────────────────────────────────────────────────────┐
│                    INTELLIGENT GUARDRAILS                       │
│           AI reasons about confidence & risk                    │
│         "Should I proceed or escalate?"                         │
├─────────────────────────────────────────────────────────────────┤
│                    BOUNDARY GUARDRAILS                          │
│           Hard limits that cannot be crossed                    │
│         "This is never allowed"                                 │
├─────────────────────────────────────────────────────────────────┤
│                    STRUCTURAL GUARDRAILS                        │
│           The FABER methodology itself                          │
│         Frame → Architect → Build → Evaluate → Release          │
└─────────────────────────────────────────────────────────────────┘
```

### Layer 1: Structural Guardrails

The FABER methodology itself is a guardrail. The five-phase structure prevents chaos:

- **Phases cannot be skipped** - You can't build without framing the problem first
- **Entry/exit criteria** - Each phase has validation requirements
- **Structured outputs** - Each phase produces defined artifacts
- **Process prevents chaos** - Structure enables autonomy, not constrains it

### Layer 2: Boundary Guardrails

Non-negotiable limits defined by policy. The AI cannot cross these regardless of confidence:

| Boundary Type | Examples |
|---------------|----------|
| **Production Safety** | Production deployments always require approval |
| **Cost Thresholds** | Actions above cost limit trigger escalation |
| **Security Operations** | Credential changes, permission modifications |
| **Destructive Actions** | Delete operations, force push, data removal |
| **Custom Policies** | Organization-specific rules |

These are configurable but absolute—when triggered, escalation is mandatory.

### Layer 3: Intelligent Guardrails

The AI evaluates its own state to make escalation decisions. This is where FABER differs from simple rule-based systems.

#### Factors Evaluated

| Factor | Question |
|--------|----------|
| **Confidence** | How sure am I about this action? |
| **Risk** | What's the potential impact if wrong? |
| **Reversibility** | Can this action be undone? |
| **Precedent** | Have I done this successfully before? |
| **Scope** | Is the impact well-bounded? |

#### The Decision Matrix

```
                 Low Risk              High Risk
               ────────────────────────────────────
              │                │                   │
High          │   PROCEED      │   PROCEED         │
Confidence    │   (silent)     │   + NOTIFY        │
              │                │                   │
              ├────────────────┼───────────────────┤
              │                │                   │
Low           │   PROCEED      │   ESCALATE        │
Confidence    │   + NOTIFY     │   (block)         │
              │                │                   │
               ────────────────────────────────────
```

#### Decision Outcomes

| Outcome | Description | Human Involvement |
|---------|-------------|-------------------|
| `proceed_silent` | Action taken, no notification | None |
| `proceed_notify` | Action taken, human informed async | Async notification |
| `soft_pause` | Action queued, proceeds if no response | Optional review window |
| `escalate` | Action blocked until human decides | Required approval |

## Earned Autonomy

Trust is earned, not assumed. FABER starts conservative and expands autonomy based on demonstrated success.

### The Progression

```
Day 1: Supervised
├── All actions require confirmation
├── AI learns patterns and preferences
└── Success/failure tracking begins
        │
        ▼
Week 2-4: Assisted
├── Low-risk actions proceed with notification
├── Medium-risk actions still confirmed
└── Autonomy expands for proven-safe action types
        │
        ▼
Month 2+: Guarded
├── Most actions proceed autonomously
├── Only high-risk/novel situations escalate
└── Human involvement drops to ~10%
        │
        ▼
Mature: Autonomous
├── AI operates within established boundaries
├── Novel situations trigger automatic escalation
└── Human oversight is strategic, not tactical
```

### What the System Learns

- **Action success patterns**: Which types of actions consistently succeed
- **Risk profiles**: Which situations historically require human judgment
- **User preferences**: Individual tolerance levels and decision patterns
- **Domain patterns**: Project-specific conventions and constraints

### Expansion Criteria

Autonomy expands for an action type when:

| Criterion | Default |
|-----------|---------|
| Minimum successful executions | 10+ |
| Success rate maintained | 95%+ |
| Time at current level | 7+ days |
| Recent failures | 0 in last 48h |

### Contraction

Autonomy contracts when failures occur:
- Single critical failure → immediate contraction
- Pattern of failures → gradual contraction
- User overrides → learning signal (may contract)

This ensures the system remains safe even as it becomes more autonomous.

## Configuration

### Guardrails Configuration

```yaml
# .faber/guardrails.yaml
version: "1.0"

autonomy:
  default_level: assisted  # Start conservatively

confidence:
  high_threshold: 0.8
  medium_threshold: 0.5

boundaries:
  # Actions that always require human approval
  always_escalate:
    - production_deploy
    - security_config_change
    - database_migration
    - force_push
    - branch_delete_protected

  # Actions that are completely blocked
  blocked:
    - production_delete
    - credential_exposure

  # Cost limits
  cost_threshold: 100  # USD

  # Production safety
  production_always_escalates: true

soft_pause:
  timeout: 30m
  default_action: cancel  # Safe default

expansion:
  min_success_count: 10
  min_success_rate: 0.95
  min_time_at_level: 7d
  recent_failure_window: 48h
  recent_failure_max: 0
```

### Per-Action Overrides

```yaml
action_overrides:
  code_change:
    default_level: guarded  # More autonomous for code changes

  pr_merge:
    default_level: supervised  # More conservative for merges
    boundaries:
      always_escalate: true
```

## Programmatic Configuration

```typescript
import { FaberWorkflow, GuardrailConfig } from '@fractary/faber';

const guardrails: GuardrailConfig = {
  defaultAutonomyLevel: 'assisted',
  confidence: {
    highThreshold: 0.8,
    mediumThreshold: 0.5,
  },
  boundaries: {
    alwaysEscalate: ['production_deploy', 'force_push'],
    blocked: ['production_delete'],
    costThreshold: 100,
    productionAlwaysEscalates: true,
  },
  softPause: {
    timeout: '30m',
    defaultAction: 'cancel',
  },
};

const faber = new FaberWorkflow({
  config: {
    autonomy: 'guarded',
    guardrails,
  },
});
```

## Handling Escalations

When an escalation occurs, FABER provides context for human decision-making:

```typescript
faber.setEscalationHandler(async (escalation) => {
  console.log('Escalation required:');
  console.log('  Action:', escalation.action.type);
  console.log('  Reason:', escalation.reason);
  console.log('  Confidence:', escalation.confidence);
  console.log('  Risk:', escalation.risk);
  console.log('  Context:', escalation.context);

  // Present to user and get decision
  const decision = await promptUser({
    message: escalation.message,
    options: ['approve', 'reject', 'modify'],
  });

  return {
    approved: decision === 'approve',
    modifications: decision === 'modify' ? await getModifications() : null,
  };
});
```

## Observability

### Metrics

Track guardrail effectiveness:

| Metric | Description |
|--------|-------------|
| **Escalation Rate** | % of actions that escalate |
| **False Positive Rate** | Escalations approved without changes |
| **Human Response Time** | Time to respond to escalations |
| **Autonomy Level Distribution** | Actions at each autonomy level |
| **Confidence Calibration** | How well confidence predicts success |

### Audit Trail

Every guardrail decision is logged:

```typescript
// Example audit entry
{
  timestamp: '2024-01-15T10:30:00Z',
  workflowId: 'wf-123',
  actionType: 'pr_create',
  confidence: 0.85,
  risk: 'medium',
  decision: 'proceed_notify',
  reason: 'High confidence, medium risk - proceeding with notification',
  outcome: 'success'
}
```

### Events

Subscribe to guardrail events:

```typescript
faber.addEventListener((event, data) => {
  if (event === 'guardrail:check') {
    console.log('Guardrail evaluated:', data.decision);
  }
  if (event === 'guardrail:escalate') {
    console.log('Escalation triggered:', data.reason);
  }
  if (event === 'autonomy:expand') {
    console.log('Autonomy expanded for:', data.actionType);
  }
});
```

## Example Scenarios

### Scenario 1: Routine Bug Fix

```
Action: Fix typo in error message
Confidence: 0.95 (high)
Risk: low (reversible, non-production)
Autonomy Level: guarded

Decision: proceed_silent
Result: Fix applied, no human involvement
```

### Scenario 2: Complex Refactoring

```
Action: Refactor authentication module
Confidence: 0.6 (medium)
Risk: high (affects many files, security-sensitive)
Autonomy Level: assisted

Decision: escalate
Reason: "Medium confidence on security-sensitive code"
Result: Human reviews plan, approves with modifications
```

### Scenario 3: Production Deployment

```
Action: Deploy to production
Confidence: 0.9 (high)
Risk: critical (production system)
Boundary: production_always_escalates = true

Decision: escalate (mandatory)
Reason: "Production deployments require human approval"
Result: Human approves, deployment proceeds
```

### Scenario 4: Autonomy Expansion

```
Action Type: PR creation
Previous: 15 successful PR creations
Success Rate: 100%
Current Level: assisted
Time at Level: 14 days

Expansion Check:
✓ minSuccessCount (10): 15 >= 10
✓ minSuccessRate (0.95): 1.0 >= 0.95
✓ minTimeAtLevel (7d): 14d >= 7d
✓ recentFailures (0): 0 = 0

Result: Level expanded from 'assisted' to 'guarded'
Future PR creations will proceed with notification only
```

## Best Practices

### Starting Out

1. **Begin with `assisted` mode** - Let the system learn your patterns
2. **Review escalations carefully** - Your decisions train the system
3. **Configure boundaries early** - Define what should never be automatic
4. **Monitor the metrics** - Watch escalation rates and false positives

### Scaling Up

1. **Trust the expansion criteria** - Let autonomy expand naturally
2. **Adjust thresholds based on data** - If false positive rate is high, thresholds may be too conservative
3. **Add domain-specific boundaries** - Customize for your organization's risk tolerance
4. **Review audit trails periodically** - Ensure the system behaves as expected

### Enterprise Deployment

1. **Integrate with existing approval workflows** - Connect escalations to your ticketing system
2. **Set up alerting** - Get notified of unusual escalation patterns
3. **Export audit trails** - Compliance and governance requirements
4. **Train your team** - Everyone should understand when and why escalations occur

## Next Steps

- [Core Concepts](./concepts.md) - Understand the full FABER architecture
- [Getting Started](./getting-started.md) - Set up your first workflow
- [CLI Reference](./cli.md) - Command-line interface
- [API Reference](./api.md) - Programmatic API details
