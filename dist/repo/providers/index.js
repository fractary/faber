"use strict";
/**
 * @fractary/faber - Repo Providers
 *
 * Repository provider exports.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BitbucketRepoProvider = exports.GitLabRepoProvider = exports.GitHubRepoProvider = void 0;
var github_1 = require("./github");
Object.defineProperty(exports, "GitHubRepoProvider", { enumerable: true, get: function () { return github_1.GitHubRepoProvider; } });
var gitlab_1 = require("./gitlab");
Object.defineProperty(exports, "GitLabRepoProvider", { enumerable: true, get: function () { return gitlab_1.GitLabRepoProvider; } });
var bitbucket_1 = require("./bitbucket");
Object.defineProperty(exports, "BitbucketRepoProvider", { enumerable: true, get: function () { return bitbucket_1.BitbucketRepoProvider; } });
//# sourceMappingURL=index.js.map