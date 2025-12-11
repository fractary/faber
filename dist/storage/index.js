"use strict";
/**
 * @fractary/faber - Storage Module
 *
 * Provides local storage for artifacts (specs, logs, state).
 * When @fractary/codex is installed and enabled, delegates to Codex.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStorage = exports.CodexAdapter = exports.LocalStorage = void 0;
var local_1 = require("./local");
Object.defineProperty(exports, "LocalStorage", { enumerable: true, get: function () { return local_1.LocalStorage; } });
var codex_adapter_1 = require("./codex-adapter");
Object.defineProperty(exports, "CodexAdapter", { enumerable: true, get: function () { return codex_adapter_1.CodexAdapter; } });
Object.defineProperty(exports, "createStorage", { enumerable: true, get: function () { return codex_adapter_1.createStorage; } });
//# sourceMappingURL=index.js.map