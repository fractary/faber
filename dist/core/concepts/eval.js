"use strict";
/**
 * Eval concept loader
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvalLoader = void 0;
const zod_1 = require("zod");
const base_1 = require("./base");
const types_1 = require("../../types");
const yaml = __importStar(require("js-yaml"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const ScenarioSchema = zod_1.z.object({
    name: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    inputs: zod_1.z.record(zod_1.z.unknown()),
    expected_outputs: zod_1.z.record(zod_1.z.unknown()).optional(),
    assertions: zod_1.z.array(zod_1.z.string()).optional()
});
const MetricSchema = zod_1.z.object({
    name: zod_1.z.string(),
    type: zod_1.z.enum(['accuracy', 'coverage', 'performance', 'quality']),
    threshold: zod_1.z.number().optional()
});
const EvalMetadataSchema = zod_1.z.object({
    name: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    targets: zod_1.z.array(zod_1.z.string()),
    scenarios: zod_1.z.array(ScenarioSchema),
    metrics: zod_1.z.array(MetricSchema).optional(),
    success_threshold: zod_1.z.number().optional(),
    platforms: zod_1.z.array(zod_1.z.string()).optional()
});
class EvalLoader extends base_1.BaseConceptLoader {
    constructor() {
        super(types_1.ConceptType.EVAL);
    }
    getMetadataSchema() {
        return EvalMetadataSchema;
    }
    async loadConceptContent(conceptPath, metadata) {
        const evalMetadata = EvalMetadataSchema.parse(metadata);
        return {
            name: evalMetadata.name,
            type: types_1.ConceptType.EVAL,
            description: evalMetadata.description,
            targets: evalMetadata.targets,
            scenarios: (evalMetadata.scenarios || []),
            metrics: (evalMetadata.metrics || []),
            success_threshold: evalMetadata.success_threshold || 80,
            platforms: evalMetadata.platforms || []
        };
    }
    async validateSpecific(concept) {
        return [];
    }
    async loadMetadata(conceptPath) {
        const metadataPath = path_1.default.join(conceptPath, 'eval.yml');
        const content = await fs_1.promises.readFile(metadataPath, 'utf-8');
        return yaml.load(content);
    }
    async validateConcept(evalConcept) {
        // Validate eval structure
        if (evalConcept.scenarios.length === 0) {
            throw new Error('Eval must have at least one scenario');
        }
        if (evalConcept.targets.length === 0) {
            throw new Error('Eval must target at least one concept');
        }
        // Validate target format
        for (const target of evalConcept.targets) {
            if (!target.includes(':')) {
                throw new Error(`Invalid target format: ${target}. Use format 'type:name'`);
            }
        }
    }
    getSchema() {
        return EvalMetadataSchema;
    }
}
exports.EvalLoader = EvalLoader;
//# sourceMappingURL=eval.js.map