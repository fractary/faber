"use strict";
/**
 * Binding system exports
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeCodeTransformer = void 0;
exports.createBinding = createBinding;
exports.bindingSupportsConceptType = bindingSupportsConceptType;
var transformer_1 = require("./claude-code/transformer");
Object.defineProperty(exports, "ClaudeCodeTransformer", { enumerable: true, get: function () { return transformer_1.ClaudeCodeTransformer; } });
const types_1 = require("../types");
const transformer_2 = require("./claude-code/transformer");
/**
 * Create binding transformer for framework
 */
function createBinding(framework) {
    switch (framework) {
        case 'claude':
        case 'claude-code':
            return {
                name: 'claude-code',
                version: '1.0.0',
                supportedConcepts: [types_1.ConceptType.ROLE, types_1.ConceptType.TOOL, types_1.ConceptType.EVAL],
                transform: async (concept, config, overlays) => {
                    const transformer = new transformer_2.ClaudeCodeTransformer();
                    return transformer.transform(concept, config, overlays);
                }
            };
        case 'langgraph':
            throw new Error('LangGraph binding not yet implemented');
        case 'crewai':
            throw new Error('CrewAI binding not yet implemented');
        default:
            throw new Error(`Unknown binding framework: ${framework}`);
    }
}
/**
 * Check if binding supports concept type
 */
function bindingSupportsConceptType(binding, conceptType) {
    return binding.supportedConcepts.includes(conceptType);
}
//# sourceMappingURL=index.js.map