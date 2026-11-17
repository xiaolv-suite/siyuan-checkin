// @ts-check
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

console.log("Starting storage-failure-classification tests...");

const root = path.join(__dirname, "..");
const srcFailure = fs.readFileSync(path.join(root, "src", "features", "storage-failure.ts"), "utf8");
const srcDiagnostics = fs.readFileSync(path.join(root, "src", "features", "diagnostics.ts"), "utf8");
const compilerOptions = {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS};

const modDiagnostics = {exports: {}};
new Function("module", "exports", ts.transpileModule(srcDiagnostics, {compilerOptions}).outputText)(modDiagnostics, modDiagnostics.exports);

const modFailure = {exports: {}};
const customRequire = (id) => {
    if (id === "./diagnostics") return modDiagnostics.exports;
    return require(id);
};
new Function("module", "exports", "require", ts.transpileModule(srcFailure, {compilerOptions}).outputText)(modFailure, modFailure.exports, customRequire);
const {classifyStorageFailure} = modFailure.exports;

// 1. 测试只读工作区分类
const readonly1 = classifyStorageFailure(new Error("kernel error: workspace is readonly"));
assert.equal(readonly1.kind, "readonly");
assert.equal(readonly1.messageKey, "storage.errReadonly");
assert.equal(readonly1.recoverable, false);

const readonly2 = classifyStorageFailure({msg: "read-only mode active"});
assert.equal(readonly2.kind, "readonly");

// 2. 测试磁盘配额不足分类
const quota1 = classifyStorageFailure(new Error("write failed: ENOSPC, no space left on device"));
assert.equal(quota1.kind, "quota-exceeded");
assert.equal(quota1.messageKey, "storage.errQuotaExceeded");
assert.equal(quota1.recoverable, true);

const quota2 = classifyStorageFailure("storage quota exceeded");
assert.equal(quota2.kind, "quota-exceeded");

// 3. 测试认证令牌失效分类
const auth1 = classifyStorageFailure(new Error("401 Unauthorized: token invalid"));
assert.equal(auth1.kind, "auth-failed");
assert.equal(auth1.messageKey, "storage.errAuthFailed");
assert.equal(auth1.recoverable, false);

// 4. 测试通信超时分类
const timeout1 = classifyStorageFailure(new Error("kernel-post-timeout: request timed out"));
assert.equal(timeout1.kind, "timeout");
assert.equal(timeout1.messageKey, "storage.errTimeout");
assert.equal(timeout1.recoverable, true);

// 5. 测试网络或内核不可用分类
const unavail1 = classifyStorageFailure(new Error("fetch failed: ECONNREFUSED 127.0.0.1:6806"));
assert.equal(unavail1.kind, "unavailable");
assert.equal(unavail1.messageKey, "storage.errUnavailable");
assert.equal(unavail1.recoverable, true);

// 6. 测试未知错误安全兜底
const unknown1 = classifyStorageFailure(new Error("something unexpected"));
assert.equal(unknown1.kind, "unknown");
assert.equal(unknown1.messageKey, "msg.saveFail");

console.log("storage-failure-classification: all assertions passed successfully!");
