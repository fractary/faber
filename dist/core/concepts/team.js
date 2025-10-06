"use strict";
/**
 * Team concept loader
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
exports.TeamLoader = void 0;
const zod_1 = require("zod");
const base_1 = require("./base");
const types_1 = require("../../types");
const yaml = __importStar(require("js-yaml"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const TeamMemberSchema = zod_1.z.object({
    role: zod_1.z.string(),
    name: zod_1.z.string().optional(),
    config: zod_1.z.record(zod_1.z.unknown()).optional()
});
const TeamMetadataSchema = zod_1.z.object({
    name: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    members: zod_1.z.array(TeamMemberSchema),
    coordination: zod_1.z.nativeEnum(types_1.CoordinationType).optional(),
    leader: zod_1.z.string().optional(),
    workflows: zod_1.z.array(zod_1.z.string()).optional()
});
class TeamLoader extends base_1.BaseConceptLoader {
    constructor() {
        super(types_1.ConceptType.TEAM);
    }
    getMetadataSchema() {
        return TeamMetadataSchema;
    }
    async loadConceptContent(conceptPath, metadata) {
        const teamMetadata = TeamMetadataSchema.parse(metadata);
        return {
            name: teamMetadata.name,
            type: types_1.ConceptType.TEAM,
            description: teamMetadata.description,
            members: (teamMetadata.members || []),
            coordination: teamMetadata.coordination,
            leader: teamMetadata.leader,
            workflows: teamMetadata.workflows || []
        };
    }
    async validateSpecific(concept) {
        return [];
    }
    async loadMetadata(conceptPath) {
        const metadataPath = path_1.default.join(conceptPath, 'team.yml');
        const content = await fs_1.promises.readFile(metadataPath, 'utf-8');
        return yaml.load(content);
    }
    async validateConcept(team) {
        // Validate team structure
        if (team.members.length === 0) {
            throw new Error('Team must have at least one member');
        }
        if (team.leader) {
            const leaderExists = team.members.some(m => m.name === team.leader);
            if (!leaderExists) {
                throw new Error(`Leader ${team.leader} not found in team members`);
            }
        }
    }
    getSchema() {
        return TeamMetadataSchema;
    }
}
exports.TeamLoader = TeamLoader;
//# sourceMappingURL=team.js.map