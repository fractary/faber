# SPEC-00028: Intelligent Guardrails & Earned Autonomy

## Metadata

| Field | Value |
|-------|-------|
| **Spec ID** | SPEC-00028 |
| **Title** | Intelligent Guardrails & Earned Autonomy |
| **Status** | Draft |
| **Created** | 2025-12-12 |
| **Author** | FABER Team |
| **Related Specs** | SPEC-00025, SPEC-00027 |

## 1. Overview

### 1.1 Summary

This specification defines the Intelligent Guardrails system—a core FABER differentiator that enables AI agents to reason about their own confidence and risk, deciding autonomously when to proceed versus escalate to humans. Combined with the Earned Autonomy model, this creates AI workflows that are both powerful and safe.

### 1.2 Problem Statement

Current AI automation faces a fundamental tension:

**Option A: Full Human Oversight**
- Every action requires approval
- Human becomes the bottleneck
- Approval fatigue leads to rubber-stamping
- Defeats the purpose of automation

**Option B: Full AI Autonomy**
- AI operates without checks
- Unpredictable outcomes
- Expensive mistakes
- Enterprises won't adopt

Neither extreme works. FABER needs a middle path where AI operates autonomously within appropriate bounds and escalates intelligently when those bounds are approached.

### 1.3 Goals

1. **Intelligent Escalation**: AI reasons about when to escalate, not just follows rules
2. **Earned Autonomy**: Trust expands based on demonstrated success
3. **Asymmetric Involvement**: Humans engaged for 10% of decisions, not 100%
4. **Configurable Risk Tolerance**: Different organizations have different thresholds
5. **Auditability**: All decisions (proceed vs. escalate) are logged and explainable

### 1.4 Non-Goals

1. Building a general-purpose AI safety system
2. Replacing all human judgment
3. Zero-risk guarantee (impossible with AI)
4. Real-time human availability assumption

## 2. Architecture

### 2.1 Three-Layer Guardrail System

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

#### Layer 1: Structural Guardrails (Methodology)

The FABER methodology IS a guardrail:
- Phases cannot be skipped
- Each phase has entry/exit criteria
- Outputs are validated before proceeding
- Process prevents chaos through structure

#### Layer 2: Boundary Guardrails (Hard Limits)

Non-negotiable limits defined by policy:
- Production deployments always require approval
- Cost thresholds that trigger escalation
- Security-sensitive operations (credentials, permissions)
- Destructive operations (delete, force push)

#### Layer 3: Intelligent Guardrails (AI Reasoning)

AI evaluates its own state to make escalation decisions:
- Confidence level in proposed action
- Risk level if action fails
- Reversibility of action
- Historical success rate for similar actions

### 2.2 Decision Framework

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

**Decision Outcomes:**

| Outcome | Description | Human Involvement |
|---------|-------------|-------------------|
| `proceed_silent` | Action taken, no notification | None |
| `proceed_notify` | Action taken, human informed async | Async notification |
| `soft_pause` | Action queued, continues if no response | Optional review |
| `hard_escalate` | Action blocked until human decides | Required approval |

### 2.3 Confidence Assessment

The AI evaluates confidence across multiple dimensions:

```typescript
interface ConfidenceAssessment {
  // How well does AI understand what's being asked?
  comprehension: ConfidenceLevel;  // 0.0 - 1.0

  // How certain is AI about the proposed solution?
  solution: ConfidenceLevel;

  // How well does this match patterns seen before?
  patternMatch: ConfidenceLevel;

  // Is the scope clearly bounded?
  scopeClarity: ConfidenceLevel;

  // Aggregated confidence
  overall: ConfidenceLevel;
}

type ConfidenceLevel = number; // 0.0 (no confidence) to 1.0 (complete confidence)
```

**Confidence Thresholds (configurable):**

| Level | Range | Typical Interpretation |
|-------|-------|----------------------|
| High | >= 0.8 | Proceed with minimal oversight |
| Medium | 0.5 - 0.8 | Proceed with notification |
| Low | < 0.5 | Escalate or seek clarification |

### 2.4 Risk Assessment

Risk is evaluated independently of confidence:

```typescript
interface RiskAssessment {
  // What's the blast radius if this goes wrong?
  impactScope: RiskLevel;  // 'low' | 'medium' | 'high' | 'critical'

  // Can this action be undone?
  reversibility: ReversibilityLevel;  // 'full' | 'partial' | 'none'

  // How much does this cost if it fails?
  costExposure: CostLevel;

  // Does this affect production systems?
  productionImpact: boolean;

  // Does this involve sensitive data/systems?
  securitySensitivity: SecurityLevel;

  // Aggregated risk
  overall: RiskLevel;
}
```

**Risk Categories:**

| Category | Examples |
|----------|----------|
| Low | Read-only operations, local changes, test environments |
| Medium | Code changes, branch operations, non-production deploys |
| High | PR merges, production configs, external API calls |
| Critical | Production deploys, security settings, destructive operations |

### 2.5 Earned Autonomy Model

Trust evolves over time based on outcomes:

```typescript
interface AutonomyState {
  // Current autonomy level for this action type
  level: AutonomyLevel;  // 'supervised' | 'assisted' | 'guarded' | 'autonomous'

  // Success rate for this action type
  successRate: number;

  // Number of successful executions
  successCount: number;

  // Number of failed/escalated executions
  failureCount: number;

  // When autonomy was last expanded
  lastExpansion: Date;

  // Any restrictions currently in place
  restrictions: string[];
}
```

**Autonomy Progression:**

```
Day 1: Supervised
├── All actions require confirmation
├── AI learns patterns and preferences
└── Success/failure tracking begins

Week 2-4: Assisted
├── Low-risk actions proceed with notification
├── Medium-risk actions still confirmed
└── Autonomy expands for proven-safe action types

Month 2+: Guarded
├── Most actions proceed autonomously
├── Only high-risk/novel situations escalate
└── Human involvement drops to ~10%

Mature: Autonomous
├── AI operates within established boundaries
├── Novel situations trigger automatic escalation
└── Human oversight is strategic, not tactical
```

**Expansion Criteria:**

```typescript
interface ExpansionCriteria {
  // Minimum successful executions before considering expansion
  minSuccessCount: number;  // default: 10

  // Required success rate
  minSuccessRate: number;  // default: 0.95

  // Minimum time at current level
  minTimeAtLevel: Duration;  // default: 7 days

  // No failures in recent window
  recentFailureWindow: Duration;  // default: 48 hours
  recentFailureMax: number;  // default: 0
}
```

## 3. Implementation

### 3.1 GuardrailEngine

The core component that evaluates actions:

```typescript
class GuardrailEngine {
  private config: GuardrailConfig;
  private autonomyTracker: AutonomyTracker;
  private historyStore: ActionHistoryStore;

  /**
   * Evaluate an action and determine the appropriate response
   */
  async evaluate(action: ProposedAction): Promise<GuardrailDecision> {
    // Layer 1: Check structural guardrails (methodology compliance)
    const structuralCheck = await this.checkStructuralGuardrails(action);
    if (!structuralCheck.compliant) {
      return { decision: 'block', reason: structuralCheck.reason };
    }

    // Layer 2: Check boundary guardrails (hard limits)
    const boundaryCheck = await this.checkBoundaryGuardrails(action);
    if (boundaryCheck.blocked) {
      return { decision: 'escalate', reason: boundaryCheck.reason, mandatory: true };
    }

    // Layer 3: Intelligent guardrails (AI reasoning)
    return await this.evaluateIntelligently(action);
  }

  private async evaluateIntelligently(action: ProposedAction): Promise<GuardrailDecision> {
    // Assess confidence
    const confidence = await this.assessConfidence(action);

    // Assess risk
    const risk = await this.assessRisk(action);

    // Check earned autonomy for this action type
    const autonomy = await this.autonomyTracker.getLevel(action.type);

    // Apply decision matrix
    return this.applyDecisionMatrix(confidence, risk, autonomy);
  }

  private applyDecisionMatrix(
    confidence: ConfidenceAssessment,
    risk: RiskAssessment,
    autonomy: AutonomyState
  ): GuardrailDecision {
    // High confidence + Low risk = proceed silently
    if (confidence.overall >= 0.8 && risk.overall === 'low') {
      return { decision: 'proceed_silent' };
    }

    // High confidence + Medium/High risk = proceed with notification
    if (confidence.overall >= 0.8 && ['medium', 'high'].includes(risk.overall)) {
      return { decision: 'proceed_notify', notificationType: 'async' };
    }

    // Medium confidence + Low risk = proceed with notification
    if (confidence.overall >= 0.5 && risk.overall === 'low') {
      return { decision: 'proceed_notify', notificationType: 'async' };
    }

    // Low confidence OR Critical risk = escalate
    if (confidence.overall < 0.5 || risk.overall === 'critical') {
      return { decision: 'escalate', reason: this.explainEscalation(confidence, risk) };
    }

    // Medium confidence + Medium/High risk = soft pause
    return { decision: 'soft_pause', timeout: this.config.softPauseTimeout };
  }
}
```

### 3.2 AutonomyTracker

Tracks and evolves autonomy levels:

```typescript
class AutonomyTracker {
  private store: AutonomyStore;

  /**
   * Get current autonomy level for an action type
   */
  async getLevel(actionType: ActionType): Promise<AutonomyState> {
    const state = await this.store.get(actionType);
    return state || this.getDefaultState(actionType);
  }

  /**
   * Record outcome of an action
   */
  async recordOutcome(action: CompletedAction, outcome: ActionOutcome): Promise<void> {
    const state = await this.getLevel(action.type);

    if (outcome.success) {
      state.successCount++;
      state.successRate = state.successCount / (state.successCount + state.failureCount);

      // Check if autonomy should expand
      if (this.shouldExpand(state)) {
        await this.expandAutonomy(action.type, state);
      }
    } else {
      state.failureCount++;
      state.successRate = state.successCount / (state.successCount + state.failureCount);

      // Check if autonomy should contract
      if (this.shouldContract(state)) {
        await this.contractAutonomy(action.type, state);
      }
    }

    await this.store.save(action.type, state);
  }

  private shouldExpand(state: AutonomyState): boolean {
    return (
      state.successCount >= this.config.expansion.minSuccessCount &&
      state.successRate >= this.config.expansion.minSuccessRate &&
      this.timeSinceLastExpansion(state) >= this.config.expansion.minTimeAtLevel &&
      this.recentFailures(state) === 0
    );
  }

  private shouldContract(state: AutonomyState): boolean {
    // Immediate contraction for critical failures
    // Gradual contraction for pattern of failures
    return this.recentFailures(state) >= this.config.contraction.failureThreshold;
  }
}
```

### 3.3 Configuration

```typescript
interface GuardrailConfig {
  // Global autonomy mode (can be overridden per-action)
  defaultAutonomyLevel: 'supervised' | 'assisted' | 'guarded' | 'autonomous';

  // Confidence thresholds
  confidence: {
    highThreshold: number;  // default: 0.8
    mediumThreshold: number;  // default: 0.5
  };

  // Boundary guardrails (hard limits)
  boundaries: {
    // Actions that always require approval
    alwaysEscalate: ActionType[];

    // Actions that are never allowed
    blocked: ActionType[];

    // Cost threshold that triggers escalation
    costThreshold: number;

    // Production systems always escalate
    productionAlwaysEscalates: boolean;
  };

  // Soft pause configuration
  softPause: {
    timeout: Duration;  // How long to wait for human response
    defaultAction: 'proceed' | 'cancel';  // What to do if no response
  };

  // Expansion criteria
  expansion: {
    minSuccessCount: number;
    minSuccessRate: number;
    minTimeAtLevel: Duration;
    recentFailureWindow: Duration;
    recentFailureMax: number;
  };

  // Contraction criteria
  contraction: {
    failureThreshold: number;  // Failures in window that trigger contraction
    windowDuration: Duration;
  };
}
```

### 3.4 YAML Configuration

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

contraction:
  failure_threshold: 2
  window_duration: 7d

# Action-specific overrides
action_overrides:
  code_change:
    default_level: guarded  # More autonomous for code changes

  pr_merge:
    default_level: supervised  # More conservative for merges
    boundaries:
      always_escalate: true
```

## 4. Integration

### 4.1 Integration with FABER Workflow

```typescript
class FaberWorkflow {
  private guardrailEngine: GuardrailEngine;

  async executeAction(action: ProposedAction): Promise<ActionResult> {
    // Evaluate through guardrails
    const decision = await this.guardrailEngine.evaluate(action);

    switch (decision.decision) {
      case 'proceed_silent':
        return await this.execute(action);

      case 'proceed_notify':
        const result = await this.execute(action);
        await this.notify(action, result, decision.notificationType);
        return result;

      case 'soft_pause':
        const humanResponse = await this.waitForHuman(action, decision.timeout);
        if (humanResponse.approved || humanResponse.timeout) {
          return await this.execute(action);
        }
        return { status: 'cancelled', reason: 'Human rejected' };

      case 'escalate':
        return await this.escalateToHuman(action, decision.reason);

      case 'block':
        throw new GuardrailViolation(decision.reason);
    }
  }
}
```

### 4.2 Integration with LangGraph

```typescript
// As a LangGraph node
const guardrailNode = async (state: FABERState): Promise<FABERState> => {
  const pendingAction = state.pendingAction;

  const decision = await guardrailEngine.evaluate(pendingAction);

  return {
    ...state,
    guardrailDecision: decision,
    // Route based on decision
    nextNode: decision.decision === 'escalate' ? 'human_review' : 'execute'
  };
};

// In the graph
graph.addNode('guardrail_check', guardrailNode);
graph.addConditionalEdge('guardrail_check', routeByGuardrailDecision);
```

### 4.3 Integration with Human Governance (SPEC-00027)

```typescript
// Escalations flow to the HumanGovernanceLayer
class HumanGovernanceLayer {
  async handleEscalation(escalation: Escalation): Promise<HumanDecision> {
    // Log the escalation
    await this.auditLog.record(escalation);

    // Notify appropriate humans
    await this.notificationService.notify(escalation);

    // Wait for response (with timeout)
    const decision = await this.awaitDecision(escalation, escalation.timeout);

    // Feed back to autonomy tracker
    await this.autonomyTracker.recordHumanDecision(escalation, decision);

    return decision;
  }
}
```

## 5. Observability

### 5.1 Metrics

```typescript
interface GuardrailMetrics {
  // Decision distribution
  decisionCounts: Record<GuardrailDecision, number>;

  // Escalation rate over time
  escalationRate: TimeSeries<number>;

  // Autonomy level distribution
  autonomyLevelDistribution: Record<AutonomyLevel, number>;

  // Confidence score distribution
  confidenceDistribution: Histogram;

  // Risk score distribution
  riskDistribution: Histogram;

  // Human response times
  humanResponseTime: Histogram;

  // Human override rate (when AI would have proceeded)
  humanOverrideRate: number;

  // False positive rate (escalations that were approved without changes)
  falsePositiveRate: number;
}
```

### 5.2 Audit Trail

Every guardrail decision is logged:

```typescript
interface GuardrailAuditEntry {
  timestamp: Date;
  workflowId: string;
  actionId: string;
  actionType: ActionType;

  // Assessment details
  confidenceAssessment: ConfidenceAssessment;
  riskAssessment: RiskAssessment;
  autonomyState: AutonomyState;

  // Decision
  decision: GuardrailDecision;
  decisionReason: string;

  // Outcome (if action was taken)
  outcome?: ActionOutcome;

  // Human involvement (if any)
  humanInvolved?: boolean;
  humanDecision?: HumanDecision;
  humanResponseTime?: Duration;
}
```

### 5.3 Dashboard Views

1. **Autonomy Evolution**: How trust is expanding/contracting over time
2. **Escalation Analysis**: What types of actions trigger escalations
3. **Human Involvement**: Where humans are spending their time
4. **Confidence Calibration**: How well AI confidence predicts success
5. **Risk Distribution**: What risk levels are being encountered

## 6. Success Criteria

| Metric | Target |
|--------|--------|
| Mature deployment escalation rate | < 10% |
| False positive escalation rate | < 5% |
| Human response time (P95) | < 30 minutes |
| Autonomy expansion after 30 days | >= 50% action types |
| Zero boundary violations | 100% |
| Audit trail completeness | 100% |

## 7. Future Considerations

### 7.1 Cross-Workflow Learning

Autonomy patterns learned in one workflow could inform others:
- Similar action types across workflows
- Organization-wide risk tolerances
- Shared confidence calibration

### 7.2 Predictive Escalation

Anticipate escalations before they happen:
- Recognize patterns that lead to low confidence
- Suggest information gathering before action
- Pre-emptive human consultation

### 7.3 Human Feedback Learning

Learn from human decisions on escalations:
- Why did human approve/reject?
- What additional context did human have?
- How can AI incorporate this learning?

---

## Appendix A: Decision Flowchart

```
                    ┌─────────────────┐
                    │ Proposed Action │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   Structural    │
                    │   Guardrails    │────────► Methodology
                    │   Compliant?    │          Violation
                    └────────┬────────┘
                             │ Yes
                    ┌────────▼────────┐
                    │    Boundary     │
                    │   Guardrails    │────────► Hard Block
                    │   Check         │          or Mandatory
                    └────────┬────────┘          Escalation
                             │ Pass
                    ┌────────▼────────┐
                    │     Assess      │
                    │   Confidence    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │     Assess      │
                    │      Risk       │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Check Earned   │
                    │    Autonomy     │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │     Apply       │
                    │    Decision     │
                    │     Matrix      │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
         ┌─────────┐   ┌─────────┐   ┌─────────┐
         │ Proceed │   │  Soft   │   │Escalate │
         │(Silent/ │   │  Pause  │   │         │
         │ Notify) │   │         │   │         │
         └─────────┘   └─────────┘   └─────────┘
```

---

## Appendix B: Example Scenarios

### Scenario 1: Routine Bug Fix

```
Action: Fix typo in error message
Confidence: 0.95 (high)
Risk: low (reversible, non-production)
Autonomy: guarded

Decision: proceed_silent
Result: Fix applied, no human involvement
```

### Scenario 2: Complex Refactoring

```
Action: Refactor authentication module
Confidence: 0.6 (medium)
Risk: high (affects many files, security-sensitive)
Autonomy: assisted

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

### Scenario 4: Earned Autonomy Expansion

```
Action Type: PR creation
Previous: 15 successful PR creations
Success Rate: 100%
Current Level: assisted
Time at Level: 14 days

Expansion Check:
- minSuccessCount (10): ✓
- minSuccessRate (0.95): ✓
- minTimeAtLevel (7d): ✓
- recentFailures (0): ✓

Result: Level expanded to 'guarded'
Future PR creations will proceed with notification only
```
