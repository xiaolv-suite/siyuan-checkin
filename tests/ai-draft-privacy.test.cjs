/* T-1691 专项测试：自然语言起草请求隐私、最小上下文与敏感信息防护门禁 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const compilerOptions = {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS};
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "siyuan-ai-draft-privacy-"));

const transpile = (sourcePath, outName) => {
    const text = fs.readFileSync(sourcePath, "utf8");
    const transpiled = ts.transpileModule(text, {compilerOptions}).outputText;
    fs.writeFileSync(path.join(dir, outName), transpiled);
    return require(path.join(dir, outName));
};

// 预先转译依赖模块
transpile(path.join(root, "src", "features", "schedule-validate.ts"), "schedule-validate.js");
transpile(path.join(root, "src", "features", "project-draft.ts"), "project-draft.js");
transpile(path.join(root, "src", "features", "name-inference.ts"), "name-inference.js");
const nld = transpile(path.join(root, "src", "features", "natural-language-draft.ts"), "natural-language-draft.js");

console.log("Starting ai-draft-privacy tests...");

// 1. 最小上下文边界与不可变性 (Minimal Context Boundary)
{
    const normalText = "每天早上背英语单词30个";
    const ctx = nld.buildMinimalAiDraftContext(normalText, "zh_CN");
    assert.equal(ctx.userDescription, normalText);
    assert.equal(ctx.locale, "zh_CN");
    assert.equal(ctx.sanitizedLength, normalText.length);
    assert.equal(ctx.containsSensitivePattern, false);
    assert.deepEqual(ctx.sensitiveTypes, []);
    assert.ok(Object.isFrozen(ctx), "context must be frozen");
    assert.ok(Object.isFrozen(ctx.sensitiveTypes), "sensitiveTypes array must be frozen");

    // 严禁外发任何笔记路径、历史或系统属性
    const keys = Object.keys(ctx).sort();
    assert.deepEqual(keys, [
        "containsSensitivePattern",
        "locale",
        "sanitizedLength",
        "sensitiveTypes",
        "userDescription",
    ]);

    // 超长文本截断至 500 字符内
    const longText = "每天运动".repeat(200); // 800字
    const longCtx = nld.buildMinimalAiDraftContext(longText);
    assert.equal(longCtx.sanitizedLength, 500);
    assert.equal(longCtx.userDescription.length, 500);
}

// 2. 敏感信息模式检测 (Sensitive Content Detection)
{
    // 邮箱
    const emailSample = "我的邮箱是 test.user@example.com，每天写日记";
    const emailResult = nld.detectSensitiveContent(emailSample);
    assert.equal(emailResult.hasSensitive, true);
    assert.ok(emailResult.types.includes("email"));

    // 手机号
    const phoneSample = "联系电话 13812345678 提醒我喝水";
    const phoneResult = nld.detectSensitiveContent(phoneSample);
    assert.equal(phoneResult.hasSensitive, true);
    assert.ok(phoneResult.types.includes("phone"));

    // Key / Token
    const tokenSample = "使用 sk-abcdef1234567890xyz 访问模型";
    const tokenResult = nld.detectSensitiveContent(tokenSample);
    assert.equal(tokenResult.hasSensitive, true);
    assert.ok(tokenResult.types.includes("token_or_key"));

    // 正常文本
    const cleanSample = "每天跑步5公里坚持30天";
    const cleanResult = nld.detectSensitiveContent(cleanSample);
    assert.equal(cleanResult.hasSensitive, false);
    assert.equal(cleanResult.types.length, 0);
}

// 3. 隐私与成本声明静态契约 (Privacy & Cost Disclosure)
{
    const disclosure = nld.getAiDraftPrivacyDisclosure();
    assert.equal(disclosure.localFirst, true);
    assert.equal(disclosure.dataEgress, "minimal_text_only");
    assert.equal(disclosure.notesSent, false);
    assert.equal(disclosure.historySent, false);
    assert.equal(disclosure.keysSent, false);
    assert.equal(disclosure.costFreeForLocal, true);
    assert.equal(disclosure.promptPersistence, false);
    assert.ok(Object.isFrozen(disclosure));
}

// 4. UI 静态接线与 i18n 双语覆盖断言
{
    const editorTs = fs.readFileSync(path.join(root, "src", "render", "editor.ts"), "utf8");
    const bindEditorTs = fs.readFileSync(path.join(root, "src", "render", "bind-editor.ts"), "utf8");
    const i18nTs = fs.readFileSync(path.join(root, "src", "i18n.ts"), "utf8");

    assert.ok(editorTs.includes("data-ai-draft-privacy"), "editor.ts must render privacy container");
    assert.ok(editorTs.includes('editor.aiDraftPrivacy'), "editor.ts must cite aiDraftPrivacy token");

    assert.ok(bindEditorTs.includes("buildMinimalAiDraftContext"), "bind-editor.ts must use minimal context parser");
    assert.ok(bindEditorTs.includes("containsSensitivePattern"), "bind-editor.ts must guard sensitive content");
    assert.ok(bindEditorTs.includes('editor.aiDraftSensitive'), "bind-editor.ts must display sensitive warning token");

    assert.ok(i18nTs.includes('"editor.aiDraftPrivacy":'), "i18n.ts must define zh_CN aiDraftPrivacy");
    assert.ok(i18nTs.includes('"editor.aiDraftCost":'), "i18n.ts must define zh_CN aiDraftCost");
    assert.ok(i18nTs.includes('"editor.aiDraftSensitive":'), "i18n.ts must define zh_CN aiDraftSensitive");
}

console.log("ai-draft-privacy: all minimal context, sensitive pattern, disclosure and wiring checks passed.");
