"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadRoot = void 0;
const node_path_1 = require("node:path");
const uploadRoot = () => (0, node_path_1.resolve)(process.env.UPLOAD_ROOT || (0, node_path_1.resolve)(process.cwd(), 'uploads'));
exports.uploadRoot = uploadRoot;
//# sourceMappingURL=storage.js.map