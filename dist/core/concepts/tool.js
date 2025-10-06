"use strict";
/**
 * Tool concept loader
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
exports.ToolLoader = void 0;
const zod_1 = require("zod");
const base_1 = require("./base");
const types_1 = require("../../types");
const yaml = __importStar(require("js-yaml"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const ToolMetadataSchema = zod_1.z.object({
    name: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    tool_type: zod_1.z.nativeEnum(types_1.ToolType),
    mcp_server: zod_1.z.boolean().optional(),
    protocols: zod_1.z.array(zod_1.z.string()).optional(),
    command: zod_1.z.string().optional(),
    args: zod_1.z.array(zod_1.z.string()).optional(),
    env: zod_1.z.record(zod_1.z.string()).optional()
});
class ToolLoader extends base_1.BaseConceptLoader {
    async loadConceptContent(conceptPath, metadata) {
        const toolMetadata = ToolMetadataSchema.parse(metadata);
        return {
            name: toolMetadata.name,
            type: types_1.ConceptType.TOOL,
            description: toolMetadata.description,
            tool_type: toolMetadata.tool_type,
            mcp_server: toolMetadata.mcp_server || false,
            protocols: toolMetadata.protocols || [],
            command: toolMetadata.command,
            args: toolMetadata.args,
            env: toolMetadata.env
        };
    }
    async loadMetadata(conceptPath) {
        const metadataPath = path_1.default.join(conceptPath, 'tool.yml');
        const content = await fs_1.promises.readFile(metadataPath, 'utf-8');
        return yaml.load(content);
    }
    async validateConcept(tool) {
        // Validate tool configuration
        if (tool.mcp_server) {
            if (!tool.command) {
                throw new Error('MCP server tools must have a command');
            }
        }
        if (tool.tool_type === types_1.ToolType.MCP_SERVER && !tool.mcp_server) {
            throw new Error('Tool type mcp-server must have mcp_server: true');
        }
    }
    getSchema() {
        return ToolMetadataSchema;
    }
}
exports.ToolLoader = ToolLoader;
//# sourceMappingURL=tool.js.map