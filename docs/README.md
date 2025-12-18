# FABER Documentation

Welcome to the FABER documentation. This guide helps you navigate all available resources.

## Quick Links

- 📖 [Getting Started](public/getting-started.md) - New to FABER? Start here
- 🔧 [API Reference](guides/api-reference.md) - Complete SDK documentation
- 💻 [Code Examples](examples/README.md) - Runnable examples
- 🆘 [Troubleshooting](guides/troubleshooting.md) - Common issues and solutions

---

## Documentation Structure

### For Users

#### Getting Started
Perfect for first-time users and newcomers.

- [Getting Started Guide](public/getting-started.md) - Installation, configuration, and first workflow
- [Core Concepts](public/concepts.md) - FABER methodology, phases, and architecture
- [Guardrails System](public/guardrails.md) - Three layers of safety and autonomy levels
- [CLI Reference](public/cli.md) - Complete command-line interface documentation
- [API Reference (Public)](public/api.md) - User-facing API documentation

#### Practical Guides
In-depth guides for common tasks and integration patterns.

- [API Reference](guides/api-reference.md) - Complete SDK API with TypeScript & Python examples
- [CLI Integration](guides/cli-integration.md) - Integrating FABER CLI into workflows and CI/CD
- [Configuration](guides/configuration.md) - All configuration options and patterns
- [Troubleshooting](guides/troubleshooting.md) - Problem/solution guide organized by category

#### Examples
Copy-paste ready code examples.

- [Examples Index](examples/README.md) - Overview of all examples
- [Simple Workflow](examples/simple-workflow.ts) - Basic workflow execution (TS)
- [Simple Workflow](examples/simple-workflow.py) - Basic workflow execution (Python)
- [Work Tracking](examples/work-tracking.ts) - Issue and PR automation (TS)
- [Work Tracking](examples/work-tracking.py) - Issue and PR automation (Python)

### For Developers

#### Component Documentation
Technical documentation for specific components.

- [CLI Package](../cli/README.md) - `@fractary/faber-cli` command-line interface
- [MCP Server](../mcp/server/README.md) - Model Context Protocol server
- [TypeScript SDK](../sdk/js/README.md) - `@fractary/faber` TypeScript SDK
- [Python SDK](../sdk/py/README.md) - `faber` Python package
- [Plugins](../plugins/faber/README.md) - FABER plugin architecture

#### Technical Specifications
Detailed technical specifications and architecture documents.

- [SDK Architecture](../specs/SPEC-00016-sdk-architecture.md) - Overall SDK design
- [FABER SDK](../specs/SPEC-00023-faber-sdk.md) - FABER SDK specification
- [LangGraph Integration](../specs/SPEC-00025-langgraph-integration.md) - Workflow orchestration
- [Intelligent Guardrails](../specs/SPEC-00028-intelligent-guardrails.md) - Autonomy and safety system
- [Distributed Plugin Architecture](../specs/SPEC-00026-distributed-plugin-architecture.md) - Plugin system
- [CLI Integration](../specs/SPEC-00027-cli-integration.md) - CLI architecture
- [MCP Server Spec](../specs/SPEC-20251217-faber-mcp-server.md) - MCP server design

#### Integration Guides
Guides for extending and integrating with FABER.

- [Integration Guide](integration-guide.md) - SDK and CLI integration patterns
- [Python SDK Integration](python-sdk-integration.md) - Python-specific integration
- [Project Implementation Guide](PROJECT_IMPLEMENTATION_GUIDE.md) - Implementing FABER in projects

#### Migration & Updates
Migration guides for version upgrades.

- [Migration Guide](MIGRATION.md) - General migration documentation
- [FABER-Forge Migration](MIGRATION-FABER-FORGE.md) - Migrating to Forge

### Strategic Documentation

#### Vision & Philosophy
Understanding FABER's mission and approach.

- [FABER Vision](vision/FABER-VISION.md) - Mission, philosophy, and strategic positioning
- [Positioning](marketing/POSITIONING.md) - Market positioning and messaging
- [Blog Outlines](marketing/BLOG-OUTLINES.md) - Content strategy

---

## Documentation by Topic

### Workflow Automation
- [Core Concepts](public/concepts.md) - FABER methodology
- [Simple Workflow Example](examples/simple-workflow.ts) - Basic example
- [CLI Integration](guides/cli-integration.md) - Workflow automation patterns
- [LangGraph Integration](../specs/SPEC-00025-langgraph-integration.md) - Advanced orchestration

### Work Tracking
- [API Reference - WorkManager](guides/api-reference.md#workmanager) - API documentation
- [Work Tracking Example](examples/work-tracking.ts) - Code example
- [CLI Reference - Work Commands](public/cli.md#work-commands) - CLI commands

### Repository Management
- [API Reference - RepoManager](guides/api-reference.md#repomanager) - API documentation
- [Repository Automation Example](examples/repository-automation.ts) - Code example
- [CLI Reference - Repo Commands](public/cli.md#repository-commands) - CLI commands

### Specifications
- [API Reference - SpecManager](guides/api-reference.md#specmanager) - API documentation
- [CLI Reference - Spec Commands](public/cli.md#specification-commands) - CLI commands

### Configuration
- [Configuration Guide](guides/configuration.md) - Complete reference
- [Getting Started - Configuration](public/getting-started.md#configuration) - Quick start

### Troubleshooting
- [Troubleshooting Guide](guides/troubleshooting.md) - Comprehensive problem/solution guide
- [FAQ](guides/troubleshooting.md#common-error-codes) - Common error codes

---

## Documentation Formats

### Guides (Practical)
Located in `docs/guides/`, these provide practical how-to information:
- API Reference
- CLI Integration
- Configuration
- Troubleshooting

### Public Docs (User-Facing)
Located in `docs/public/`, these are designed for end-users:
- Getting Started
- Concepts
- CLI Reference
- API Reference

### Examples (Runnable Code)
Located in `docs/examples/`, these are copy-paste ready:
- TypeScript examples (`.ts`)
- Python examples (`.py`)
- README with usage instructions

### Specs (Technical)
Located in `specs/`, these define technical architecture:
- Numbered specifications (SPEC-NNNNN)
- Implementation plans
- Migration guides

---

## Contributing to Documentation

### Documentation Standards

1. **Use Markdown**: All documentation in Markdown format
2. **Include TOC**: Add table of contents for long documents
3. **Code Examples**: Show both TypeScript and Python where applicable
4. **Cross-Reference**: Link to related documentation
5. **Keep Updated**: Update docs when functionality changes

### Documentation Types

- **Guides**: Practical how-to documents
- **Examples**: Runnable code with explanations
- **Specs**: Technical architecture documents
- **API Docs**: Method and interface documentation

### File Naming

- Guides: `kebab-case.md` (e.g., `api-reference.md`)
- Specs: `SPEC-NNNNN-description.md`
- Examples: `descriptive-name.{ts,py}`

---

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/fractary/faber/issues)
- **Documentation**: This documentation site
- **Examples**: Check the [examples](examples/) directory

---

## License

All documentation is licensed under the same terms as the FABER project (MIT License).
