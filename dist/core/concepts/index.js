"use strict";
/**
 * Concept system exports
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleLoader = exports.ConceptReferenceImpl = exports.BaseConceptLoader = void 0;
exports.createConceptLoader = createConceptLoader;
var base_1 = require("./base");
Object.defineProperty(exports, "BaseConceptLoader", { enumerable: true, get: function () { return base_1.BaseConceptLoader; } });
Object.defineProperty(exports, "ConceptReferenceImpl", { enumerable: true, get: function () { return base_1.ConceptReferenceImpl; } });
var role_1 = require("./role");
Object.defineProperty(exports, "RoleLoader", { enumerable: true, get: function () { return role_1.RoleLoader; } });
const types_1 = require("../../types");
const role_2 = require("./role");
// Factory for creating concept loaders
function createConceptLoader(type) {
    switch (type) {
        case types_1.ConceptType.ROLE:
            return new role_2.RoleLoader();
        case types_1.ConceptType.TOOL:
            // TODO: Implement ToolLoader
            throw new Error('ToolLoader not yet implemented');
        case types_1.ConceptType.EVAL:
            // TODO: Implement EvalLoader
            throw new Error('EvalLoader not yet implemented');
        case types_1.ConceptType.TEAM:
            // TODO: Implement TeamLoader
            throw new Error('TeamLoader not yet implemented');
        case types_1.ConceptType.WORKFLOW:
            // TODO: Implement WorkflowLoader
            throw new Error('WorkflowLoader not yet implemented');
        default:
            throw new Error(`Unknown concept type: ${type}`);
    }
}
//# sourceMappingURL=index.js.map