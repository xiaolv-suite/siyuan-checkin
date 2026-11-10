// @ts-check
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

console.log("Starting attachment-boundary-ingest tests...");

const root = path.join(__dirname, "..");
const srcIndex = fs.readFileSync(path.join(root, "src", "index.ts"), "utf8");
const srcModelHelpers = fs.readFileSync(path.join(root, "src", "model-helpers.ts"), "utf8");
const srcModel = fs.readFileSync(path.join(root, "src", "model.ts"), "utf8");

// 1. T-1868 静态代码断言：recordExternalEvent 签名与实现支持 attachment 与 energy 摄取
assert.ok(srcIndex.includes("attachment?: string; energy?: 1 | 2 | 3 | 4 | 5"), "recordExternalEvent must accept attachment and energy options");
assert.ok(srcIndex.includes("const attachment = typeof input.attachment === \"string\" ? input.attachment : undefined;"), "attachment must be sanitized string");
assert.ok(srcIndex.includes("const energy = Number.isInteger(input.energy) && Number(input.energy) >= 1 && Number(input.energy) <= 5 ? input.energy : undefined;"), "energy must be integer 1-5");

// 2. makeEventValue 必须规范化 attachment
assert.ok(srcModelHelpers.includes("attachment: normalizeAttachmentDataUrl(attachment),"), "makeEventValue must normalize attachment via normalizeAttachmentDataUrl");

// 3. normalizeAttachmentDataUrl 边界核验
assert.ok(srcModel.includes("if (typeof value !== \"string\" || value.length > 700000) return undefined;"), "normalizeAttachmentDataUrl must enforce 700KB size cap");
assert.ok(srcModel.includes("match[1].length % 4 === 0"), "normalizeAttachmentDataUrl must enforce base64 padding grammar");

console.log("attachment-boundary-ingest: all assertions passed successfully!");
