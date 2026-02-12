# FABER MCP Server Examples

This directory contains example usage of the FABER MCP server demonstrating workflow orchestration and event logging capabilities.

## Prerequisites

Before running these examples, ensure you have:

1. Built the MCP server:
   ```bash
   npm run build
   ```

2. Installed MCP SDK client dependencies:
   ```bash
   npm install @modelcontextprotocol/sdk
   ```

## Examples

### basic-workflow.ts

Demonstrates the core workflow orchestration capabilities:
- Running a complete FABER workflow for a work item
- Checking workflow status
- Listing runs for a specific work item

**Run:**
```bash
npx tsx examples/basic-workflow.ts
```

### event-logging.ts

Demonstrates event logging and querying:
- Emitting various workflow events (workflow_started, phase_started, etc.)
- Logging events with artifacts and metadata
- Handling error events
- Retrieving run details with events
- Reading events via MCP resources
- Consolidating events to JSONL format

**Run:**
```bash
npx tsx examples/event-logging.ts
```

### recovery.ts

Demonstrates workflow recovery and state management:
- Pausing and resuming workflows
- Recovering failed workflows from specific phases
- Recovering from checkpoints
- Cleaning up old workflow state
- Listing active runs

**Run:**
```bash
npx tsx examples/recovery.ts
```

## Adapting the Examples

These examples use `StdioClientTransport` to connect directly to the MCP server. In production, you would typically:

1. **Claude Code Integration**: Configure the server in `~/.config/claude/mcp.json`
2. **Custom MCP Client**: Use the examples as a reference for building your own client
3. **Testing**: Adapt for integration tests with mocked backends

## Example Output

Each example provides console output showing:
- Tool calls being made
- Responses from the server
- Structured data (JSON) returned by tools
- Status updates and progress information

## Error Handling

All examples include try-catch blocks and proper error handling. Modify the error handling to suit your needs:
- Log to files
- Send to monitoring systems
- Retry failed operations
- Notify users

## Environment Variables

Examples use the default `FABER_RUNS_PATH`:
```bash
.fractary/faber/runs
```

Override by setting the environment variable before running:
```bash
FABER_RUNS_PATH=/custom/path npx tsx examples/basic-workflow.ts
```

## Next Steps

After running these examples:

1. **Review the server code** in `../src/` to understand implementation details
2. **Customize the examples** for your specific use cases
3. **Build your own tools** using the MCP server as a backend
4. **Integrate with Claude Code** for AI-assisted development workflows

## Support

- **MCP Protocol Docs**: https://spec.modelcontextprotocol.io
- **FABER Docs**: https://fractary.dev/docs/faber
- **Issues**: https://github.com/fractary/faber/issues
