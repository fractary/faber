"use strict";
/**
 * @fractary/faber - FABER SDK
 *
 * Development toolkit for AI-assisted workflows.
 *
 * Modules:
 * - work: Work tracking (GitHub Issues, Jira, Linear)
 * - repo: Repository operations (Git, GitHub, GitLab, Bitbucket)
 * - spec: Specification management
 * - logs: Log management and session capture
 * - state: Workflow state persistence
 * - workflow: FABER workflow orchestration
 * - storage: Artifact storage (local and Codex integration)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
// Core exports
__exportStar(require("./types"), exports);
__exportStar(require("./errors"), exports);
__exportStar(require("./config"), exports);
// Module exports
__exportStar(require("./work"), exports);
__exportStar(require("./repo"), exports);
__exportStar(require("./spec"), exports);
__exportStar(require("./logs"), exports);
__exportStar(require("./state"), exports);
__exportStar(require("./workflow"), exports);
__exportStar(require("./storage"), exports);
//# sourceMappingURL=index.js.map