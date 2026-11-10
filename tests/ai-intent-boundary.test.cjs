/* T-1698 专项测试：多候选追问评估、习惯与事项边界判定及统一意图 Envelope 门禁 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const compilerOptions = {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS};
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "siyuan-intent-boundary-"));

const transpile = (sourcePath, outName) => {
    const text = fs.readFileSync(sourcePath, "utf8");
    const transpiled = ts.transpileModule(text, {compilerOptions}).outputText;
    fs.writeFileSync(path.join(dir, outName), transpiled);
    return require(path.join(dir, outName));
};

transpile(path.join(root, "src", "types.ts"), "types.js");
transpile(path.join(root, "src", "i18n.ts"), "i18n.js");
transpile(path.join(root, "src", "lunar.ts"), "lunar.js");
transpile(path.join(root, "src", "date-keys.ts"), "date-keys.js");
transpile(path.join(root, "src", "occasions.ts"), "occasions.js");
transpile(path.join(root, "src", "catalog.ts"), "catalog.js");
transpile(path.join(root, "src", "features", "schedule-validate.ts"), "schedule-validate.js");
transpile(path.join(root, "src", "features", "project-draft.ts"), "project-draft.js");
transpile(path.join(root, "src", "features", "name-inference.ts"), "name-inference.js");
const nld = transpile(path.join(root, "src", "features", "natural-language-draft.ts"), "natural-language-draft.js");

console.log("Starting ai-intent-boundary tests...");

const mockToday = "2026-10-30";

// 1. 习惯打卡分类与一次性草案断言 (Checkin Item Classification & One-Shot Draft)
{
    const env = nld.generateAiIntentEnvelope("每天喝 2000 毫升水", {currentDate: mockToday});
    assert.equal(env.schemaVersion, 1);
    assert.equal(env.intentType, "checkin_item");
    assert.ok(env.confidence >= 0.9);
    assert.ok(env.primaryCandidate);
    assert.equal(env.primaryCandidate.type, "checkin_item");
    assert.equal(env.primaryCandidate.draft.name, "喝水");
    assert.equal(env.primaryCandidate.draft.target, 2000);
    assert.equal(env.primaryCandidate.draft.unit, "毫升");
    assert.equal(env.primaryCandidate.draft.schedule.type, "daily");
    assert.equal(env.cognitiveBurdenAssessment.strategy, "one_shot");
    assert.equal(env.cognitiveBurdenAssessment.burdenScore, "low");
    assert.equal(env.cognitiveBurdenAssessment.followUpDisallowed, true, "严禁发起多轮对话追问");
}

// 2. 工作日习惯排期提取与一次性草案 (Workdays Checkin Item)
{
    const env = nld.generateAiIntentEnvelope("工作日晨跑 30 分钟", {currentDate: mockToday});
    assert.equal(env.intentType, "checkin_item");
    assert.ok(env.primaryCandidate);
    assert.equal(env.primaryCandidate.type, "checkin_item");
    assert.equal(env.primaryCandidate.draft.schedule.type, "workdays");
    assert.equal(env.primaryCandidate.draft.timeSlot, "morning");
    assert.equal(env.cognitiveBurdenAssessment.strategy, "one_shot");
}

// 3. 习惯多模态双候选上限断言 (Two-Candidate Cap)
{
    const env = nld.generateAiIntentEnvelope("背单词", {currentDate: mockToday});
    assert.equal(env.intentType, "checkin_item");
    assert.ok(env.primaryCandidate, "必须有首选候选");
    assert.ok(env.secondaryCandidate, "针对背单词多模态提供第 2 个备选候选");
    assert.equal(env.primaryCandidate.type, "checkin_item");
    assert.equal(env.secondaryCandidate.type, "checkin_item");
    assert.equal(env.secondaryCandidate.draft.kind, "duration", "次选候选提供按时长模式");
    assert.equal(env.secondaryCandidate.draft.target, 30);
    assert.equal(env.secondaryCandidate.draft.unit, "分钟");
    assert.equal(env.cognitiveBurdenAssessment.strategy, "two_candidates");
    assert.equal(env.cognitiveBurdenAssessment.burdenScore, "low");
}

// 4. 单次日期事项分类断言 (Occasion Intent Classification)
{
    const env = nld.generateAiIntentEnvelope("2026-11-15 妈妈生日", {currentDate: mockToday});
    assert.equal(env.intentType, "occasion");
    assert.ok(env.confidence >= 0.9);
    assert.ok(env.primaryCandidate);
    assert.equal(env.primaryCandidate.type, "occasion");
    assert.equal(env.primaryCandidate.draft.name, "妈妈生日");
    assert.equal(env.primaryCandidate.draft.date, "2026-11-15");
    assert.equal(env.primaryCandidate.draft.kind, "birthday");
    assert.equal(env.primaryCandidate.draft.recurrence, "annual");
    assert.equal(env.cognitiveBurdenAssessment.strategy, "one_shot");
}

// 5. 相对天数与单次事项断言 (Relative Days Occasion)
{
    const env = nld.generateAiIntentEnvelope("明天下午去医院体检", {currentDate: mockToday});
    assert.equal(env.intentType, "occasion");
    assert.ok(env.primaryCandidate);
    assert.equal(env.primaryCandidate.type, "occasion");
    assert.ok(env.primaryCandidate.draft.name.includes("医院体检"));
    assert.equal(env.primaryCandidate.draft.date, "2026-10-31", "明天日期推算必须准确");
    assert.equal(env.primaryCandidate.draft.kind, "scheduled");
    assert.equal(env.primaryCandidate.draft.recurrence, "once");
}

// 6. 模糊两可两意图消歧断言 (Ambiguous Disambiguation)
{
    const env = nld.generateAiIntentEnvelope("10月28日跑步", {currentDate: mockToday});
    assert.equal(env.intentType, "ambiguous", "同时包含日期与动词且无周期词必须判定为歧义");
    assert.ok(env.primaryCandidate, "候选 1 必须存在");
    assert.ok(env.secondaryCandidate, "候选 2 必须存在");
    assert.equal(env.primaryCandidate.type, "checkin_item", "候选 1 为长期习惯");
    assert.equal(env.secondaryCandidate.type, "occasion", "候选 2 为单次事项");
    assert.ok(env.disambiguation, "必须给出消歧提示");
    assert.equal(env.disambiguation.options.length, 2);
    assert.equal(env.cognitiveBurdenAssessment.strategy, "disambiguation");
}

// 7. 无效输入安全拒绝与零污染断言 (Unsupported Input Rejection)
{
    const emptyEnv = nld.generateAiIntentEnvelope("");
    assert.equal(emptyEnv.intentType, "unsupported");
    assert.equal(emptyEnv.primaryCandidate, undefined);
    assert.equal(emptyEnv.secondaryCandidate, undefined);
    assert.equal(emptyEnv.cognitiveBurdenAssessment.strategy, "reject");

    const symbolEnv = nld.generateAiIntentEnvelope("？？？！！！");
    assert.equal(symbolEnv.intentType, "unsupported");
}

// 8. 隐私防护、零副作用与不可变性断言 (Privacy & Immutability Guard)
{
    const env = nld.generateAiIntentEnvelope("每天阅读 30 分钟，联系邮箱 test@example.com", {currentDate: mockToday});
    assert.equal(env.zeroDataLossGuarantee, true);
    assert.equal(env.externalApiRequired, false);
    assert.ok(env.privacyDisclosure);
    assert.ok(Object.isFrozen(env), "envelope must be frozen");
    assert.ok(Object.isFrozen(env.primaryCandidate), "candidate must be frozen");
    assert.ok(Object.isFrozen(env.cognitiveBurdenAssessment), "burden assessment must be frozen");
}

console.log("ai-intent-boundary: all classification, one-shot, two-candidate, occasion and disambiguation checks passed.");
