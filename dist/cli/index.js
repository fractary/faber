#!/usr/bin/env node
"use strict";
/**
 * @fractary/faber - CLI
 *
 * Command-line interface for FABER SDK.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const work_1 = require("./commands/work");
const repo_1 = require("./commands/repo");
const spec_1 = require("./commands/spec");
const logs_1 = require("./commands/logs");
const workflow_1 = require("./commands/workflow");
const program = new commander_1.Command();
program
    .name('fractary')
    .description('FABER SDK - Development toolkit for AI-assisted workflows')
    .version('1.0.0');
// Register commands
program.addCommand(work_1.workCommand);
program.addCommand(repo_1.repoCommand);
program.addCommand(spec_1.specCommand);
program.addCommand(logs_1.logsCommand);
program.addCommand(workflow_1.workflowCommand);
program.parse();
//# sourceMappingURL=index.js.map