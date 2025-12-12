# FABER Vision Document

> Internal alignment document for the FABER project vision, strategy, and differentiation.

**Last Updated:** 2025-12-12
**Status:** Living Document

---

## 1. Mission Statement

**FABER enables AI agents to do meaningful work autonomously while knowing exactly when to involve humans.**

We're not building another chatbot. We're not building another workflow automation tool. We're building the foundation for AI that can actually get work done - with the intelligence to operate independently and the judgment to escalate appropriately.

---

## 2. The Problem We're Solving

### The Current Landscape is Broken

**Option A: Deterministic Automation (Zapier, Make, n8n)**
- Works great for simple tasks
- Falls apart when reasoning is required
- Can't adapt to unexpected situations
- Limited to API chaining

**Option B: Autonomous Agents (Raw LangGraph, AutoGen)**
- Powerful but unpredictable
- No guardrails = enterprises won't adopt
- Requires ML engineering expertise
- "Hope it works out" is not a strategy

**Option C: AI + Approve Everything (Most Enterprise AI)**
- Safe but defeats the purpose
- Human becomes the bottleneck
- Expensive approval-generating machine
- 10x the work for 2x the output

### The Gap

There's no solution that combines:
- Power of autonomous AI agents
- Safety of structured workflows
- Accessibility of low-code tools
- Intelligence to know when humans add value

**FABER fills this gap.**

---

## 3. Core Philosophy

### "AI That Knows When to Ask"

The fundamental insight: **The value of AI automation is destroyed when humans become the bottleneck.**

Most systems will fail by requiring human approval for everything. This feels "safe" but creates expensive approval-generating machines that nobody wants to use.

FABER takes a different approach:

```
NOT: "Human approves every step"
NOT: "AI does everything unsupervised"
BUT: "AI operates autonomously WITHIN defined boundaries,
      escalates INTELLIGENTLY when boundaries are approached"
```

### The Earned Autonomy Model

Trust is earned, not assumed:

1. **Day 1**: Conservative - more human checkpoints
2. **Week 4**: Established patterns - less intervention needed
3. **Month 6**: Mature - 90% autonomous, 10% escalation

The system learns which actions succeed and expands autonomy accordingly.

### Intelligent Guardrails

Three types of protection:

1. **Structural Guardrails**: The FABER methodology itself (Frame → Architect → Build → Evaluate → Release) prevents chaos through structure.

2. **Boundary Guardrails**: Hard limits the AI cannot cross (production deploys, security configs, cost thresholds).

3. **Intelligent Guardrails**: The AI reasons about its own confidence and risk, deciding when to proceed vs. escalate.

---

## 4. Strategic Positioning

### The Positioning Statement

> **"FABER is what you get when you combine the power of LangGraph with the ease of n8n - AI-native workflow automation that runs in production."**

Or more concisely:

> **"LangGraph is Kubernetes for AI workflows. FABER is Vercel."**

### The Sweet Spot

```
                    AI Capability
                    ─────────────────────────────────►
                    Simple Tasks         Complex Reasoning

         ┌──────────────┬──────────────┬──────────────────────┐
         │              │              │                      │
   Low   │   Zapier     │    n8n       │                      │
         │   Make       │              │                      │
Technical├──────────────┼──────────────┼──────────────────────┤
Barrier  │              │              │                      │
         │              │   ★ FABER ★  │   LangGraph          │
         │              │              │   AutoGen            │
   High  │              │              │   Custom Code        │
         │              │              │                      │
         └──────────────┴──────────────┴──────────────────────┘
```

### What Makes FABER Different

| From Make/n8n | From LangGraph |
|---------------|----------------|
| Visual workflow builder | Development-specific primitives |
| YAML configuration | FABER methodology (5 phases) |
| Pre-built templates | DAC orchestration capability |
| Quick to get started | Human governance layer |
| | Intelligent guardrails |

**Unique to FABER:**
- AI agents that reason, not just API chains
- Production-grade runtime for complex tasks
- Code escape hatch when needed
- Multi-workflow coordination (DAC)
- Codex knowledge layer
- "Earned autonomy" trust model

---

## 5. The FABER Methodology

### Frame → Architect → Build → Evaluate → Release

This isn't just a workflow - it's a **forcing function for quality**:

| Phase | Purpose | Why It Matters |
|-------|---------|----------------|
| **Frame** | Understand before acting | Prevents "just start coding" chaos |
| **Architect** | Plan before building | Forces thinking through edge cases |
| **Build** | Implement to spec | Constrained creativity, not chaos |
| **Evaluate** | Validate before shipping | Catches issues before humans see them |
| **Release** | Controlled delivery | No surprises in production |

The methodology IS a guardrail. You can't skip steps.

---

## 6. Product Vision

### The Product Stack

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FABER Studio (UI)                                │
│         Visual workflow builder, monitoring, debugging              │
│                  Accessibility: Everyone                            │
└─────────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────────┐
│                    FABER CLI                                        │
│         Command-line workflow management and execution              │
│                  Accessibility: Developers                          │
└─────────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────────┐
│                FABER SDK (Python/TypeScript)                        │
│         Declarative workflow definitions, agent templates           │
│                  Accessibility: Engineers                           │
└─────────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────────┐
│              FABER Primitives (WorkManager, etc.)                   │
│         Framework-agnostic core logic                               │
└─────────────────────────────────────────────────────────────────────┘
```

### Progressive Disclosure

Users can engage at their comfort level:

```
Level 1: faber run 123                           # Use defaults
Level 2: faber run 123 --workflow custom.yaml    # Custom workflow
Level 3: Python SDK for full control              # Advanced
```

### The Long-Term Vision: DAC

**Distributed Autonomous Corporation**: Multiple AI workflows coordinating to run business operations.

- Workflows communicate via events
- Shared context across workflows
- Human governance layer for oversight
- Resource allocation and rate limiting
- Self-improving through learned patterns

This is where FABER ultimately goes - not just automating tasks, but running organizations.

---

## 7. Competitive Differentiation

### vs. Make/Zapier/n8n

| They Say | We Say |
|----------|--------|
| "Automate anything" | "Automate work that requires reasoning" |
| "Connect your apps" | "AI agents that understand your work" |
| "No code required" | "No code to start, full code when needed" |

**Key differentiator**: They chain API calls. We orchestrate AI agents.

### vs. LangGraph/LangChain

| They Say | We Say |
|----------|--------|
| "Build any AI app" | "Build AI-powered development workflows" |
| "Powerful framework" | "Powerful AND accessible" |
| "For ML engineers" | "For every developer" |

**Key differentiator**: They're infrastructure. We're the product on top.

### vs. "AI Copilots"

| They Say | We Say |
|----------|--------|
| "AI assists you" | "AI works autonomously" |
| "Suggestions and completions" | "End-to-end task completion" |
| "You're still in the loop" | "You're in the loop when it matters" |

**Key differentiator**: Copilots assist. FABER executes.

---

## 8. Key Messages

### Taglines (Options)

1. **"AI that knows when to ask"** - Emphasizes intelligent autonomy
2. **"From issue to PR, autonomously"** - Emphasizes end-to-end capability
3. **"The power of LangGraph, the ease of n8n"** - Emphasizes sweet spot
4. **"AI agents for real work"** - Emphasizes production-readiness

### Elevator Pitch (30 seconds)

> "FABER is an AI workflow platform that lets development teams automate complex tasks - from understanding an issue to shipping a PR - with AI agents that know when to proceed autonomously and when to ask for human input. Unlike simple automation tools, FABER's agents reason about problems. Unlike raw AI frameworks, FABER has the guardrails enterprises need. It's the sweet spot between power and control."

### One-Liner

> "FABER: AI-native workflow automation that runs in production."

---

## 9. Target Users

### Primary: Development Teams

- **Role**: Software engineers, tech leads, engineering managers
- **Pain**: Manual work on repetitive issues, context-switching, PR bottlenecks
- **Value**: Ship faster, focus on interesting problems

### Secondary: Technical Operations

- **Role**: DevOps, SREs, platform engineers
- **Pain**: Incident response, deployment pipelines, infrastructure changes
- **Value**: Automated response with human oversight on critical decisions

### Future: Business Operations (DAC)

- **Role**: Operations leaders, business owners
- **Pain**: Coordinating multiple processes, maintaining consistency
- **Value**: Autonomous operations with governance

---

## 10. Business Model

### Open Core Model

| Tier | Price | Features |
|------|-------|----------|
| **Open Source** | Free | SDK, CLI, single workflows |
| **Team** | $X/mo | Multi-workflow, API, basic dashboard |
| **Business** | $XX/mo | Helm orchestration, governance, observability |
| **Enterprise** | Custom | DAC features, custom integrations, SLA |

### Revenue Drivers

1. **Observability** - Dashboard, metrics, debugging tools
2. **Deployment** - Managed workflow hosting
3. **Governance** - Approval workflows, audit logs, compliance
4. **DAC Features** - Multi-workflow orchestration, resource management

---

## 11. Success Metrics

### Product Success

- Time to first workflow: < 5 minutes
- Workflow success rate: > 95%
- Human intervention rate: < 10% (for mature deployments)
- Cost savings vs. manual: > 50%

### Business Success

- Open source adoption (GitHub stars, npm downloads)
- Conversion to paid tiers
- Enterprise customer acquisition
- ARR growth

---

## 12. Appendix: Key Concepts

### Concept: Earned Autonomy

The system starts conservative and earns trust over time based on:
- Historical success rate
- Action reversibility
- Risk assessment
- Similar past actions

### Concept: Intelligent Guardrails

AI reasons about its own confidence:
- High confidence + low risk = proceed
- Medium confidence = proceed + notify
- Low confidence OR high risk = escalate

### Concept: Asymmetric Human Involvement

- 90% of work: AI autonomous, human informed (async)
- 10% of work: AI pauses, human decides (blocking)

The key is knowing which 10% matters.

---

*This document should be reviewed and updated quarterly as the product evolves.*
