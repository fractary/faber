"use strict";
/**
 * Workflow concept loader
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
exports.WorkflowLoader = void 0;
const zod_1 = require("zod");
const base_1 = require("./base");
const types_1 = require("../../types");
const yaml = __importStar(require("js-yaml"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const StageSchema = zod_1.z.object({
    name: zod_1.z.string(),
    team: zod_1.z.string(),
    entry_criteria: zod_1.z.array(zod_1.z.string()).optional(),
    tasks: zod_1.z.array(zod_1.z.string()),
    exit_criteria: zod_1.z.array(zod_1.z.string()).optional(),
    on_failure: zod_1.z.array(zod_1.z.string()).optional()
});
const TriggerSchema = zod_1.z.object({
    type: zod_1.z.enum(['manual', 'scheduled', 'event']),
    config: zod_1.z.record(zod_1.z.unknown()).optional()
});
const WorkflowMetadataSchema = zod_1.z.object({
    name: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    stages: zod_1.z.array(StageSchema),
    teams: zod_1.z.array(zod_1.z.string()),
    triggers: zod_1.z.array(TriggerSchema).optional(),
    conditions: zod_1.z.record(zod_1.z.unknown()).optional()
});
class WorkflowLoader extends base_1.BaseConceptLoader {
    constructor() {
        super(types_1.ConceptType.WORKFLOW);
    }
    getMetadataSchema() {
        return WorkflowMetadataSchema;
    }
    async loadConceptContent(conceptPath, metadata) {
        const workflowMetadata = WorkflowMetadataSchema.parse(metadata);
        return {
            name: workflowMetadata.name,
            type: types_1.ConceptType.WORKFLOW,
            description: workflowMetadata.description,
            stages: (workflowMetadata.stages || []),
            teams: workflowMetadata.teams,
            triggers: (workflowMetadata.triggers || []),
            conditions: workflowMetadata.conditions || {}
        };
    }
    async validateSpecific(concept) {
        return [];
    }
    async loadMetadata(conceptPath) {
        const metadataPath = path_1.default.join(conceptPath, 'workflow.yml');
        const content = await fs_1.promises.readFile(metadataPath, 'utf-8');
        return yaml.load(content);
    }
    async validateConcept(workflow) {
        // Validate workflow structure
        if (workflow.stages.length === 0) {
            throw new Error('Workflow must have at least one stage');
        }
        // Validate teams are referenced in stages
        const stageTeams = new Set(workflow.stages.map(s => s.team));
        for (const team of workflow.teams) {
            if (!stageTeams.has(team)) {
                console.warn(`Team ${team} declared but not used in any stage`);
            }
        }
    }
    getSchema() {
        return WorkflowMetadataSchema;
    }
}
exports.WorkflowLoader = WorkflowLoader;
//# sourceMappingURL=workflow.js.map