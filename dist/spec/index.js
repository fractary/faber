"use strict";
/**
 * @fractary/faber - Spec Module
 *
 * Specification management for FABER workflows.
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
exports.templates = exports.listTemplates = exports.getTemplate = exports.SpecManager = void 0;
var manager_1 = require("./manager");
Object.defineProperty(exports, "SpecManager", { enumerable: true, get: function () { return manager_1.SpecManager; } });
__exportStar(require("./types"), exports);
var templates_1 = require("./templates");
Object.defineProperty(exports, "getTemplate", { enumerable: true, get: function () { return templates_1.getTemplate; } });
Object.defineProperty(exports, "listTemplates", { enumerable: true, get: function () { return templates_1.listTemplates; } });
Object.defineProperty(exports, "templates", { enumerable: true, get: function () { return templates_1.templates; } });
//# sourceMappingURL=index.js.map