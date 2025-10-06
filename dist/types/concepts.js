"use strict";
/**
 * Concept type definitions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolType = exports.CoordinationType = exports.ConceptType = void 0;
// Base concept types
var ConceptType;
(function (ConceptType) {
    ConceptType["ROLE"] = "role";
    ConceptType["TOOL"] = "tool";
    ConceptType["EVAL"] = "eval";
    ConceptType["TEAM"] = "team";
    ConceptType["WORKFLOW"] = "workflow";
})(ConceptType || (exports.ConceptType = ConceptType = {}));
var CoordinationType;
(function (CoordinationType) {
    CoordinationType["HIERARCHICAL"] = "hierarchical";
    CoordinationType["COLLABORATIVE"] = "collaborative";
    CoordinationType["SEQUENTIAL"] = "sequential";
    CoordinationType["AUTONOMOUS"] = "autonomous";
})(CoordinationType || (exports.CoordinationType = CoordinationType = {}));
var ToolType;
(function (ToolType) {
    ToolType["MCP_SERVER"] = "mcp-server";
    ToolType["UTILITY"] = "utility";
    ToolType["API_CLIENT"] = "api-client";
})(ToolType || (exports.ToolType = ToolType = {}));
//# sourceMappingURL=concepts.js.map