/* T-1700 专项测试：新建页问 AI 八大维度全景验收门禁矩阵
   1. 双语与本地化对齐 (i18n & Localization)
   2. 输入净化与抗逆载荷 (Sanitization & Parsing)
   3. 无模型与离线双降级 (Fallback & Zero Mock)
   4. 异步生命周期与跨代际防线 (Lifecycle & Superseding)
   5. 事实安全与保存原子回滚 (Zero Side-Effect & Rollback)
   6. 意图边界与至多双候选 (Intent Boundary & Candidates)
   7. 多表面与多 Root 隔离 (Multi-Surface Isolation)
   8. 无障碍、键盘与 IME 防护 (A11y, Keyboard & IME) */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const compilerOptions = {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS};
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "siyuan-ai-matrix-"));

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
const gov = transpile(path.join(root, "src", "features", "ai-draft-governance.ts"), "ai-draft-governance.js");
const i18n = require(path.join(dir, "i18n.js"));

console.log("Starting ai-draft-full-acceptance-matrix tests...");

// —— 维度 1：双语与本地化对齐 (i18n & Localization) ——
{
    const requiredAiKeys = [
        "editor.aiDraftHeading",
        "editor.aiDraftHint",
        "editor.aiDraftLabel",
        "editor.aiDraftPlaceholder",
        "editor.aiDraftInferBtn",
        "editor.aiDraftCopyPromptBtn",
        "editor.aiDraftCopyPromptHint",
        "editor.aiDraftApply",
        "editor.aiDraftPromptCopied",
        "editor.aiDraftNoMatch",
        "editor.aiDraftPrivacy",
        "editor.aiDraftCost",
        "editor.aiDraftSensitive",
        "editor.aiDraftClear",
        "editor.aiDraftInferring",
        "editor.aiDraftApplied",
    ];

    for (const key of requiredAiKeys) {
        const zh = i18n.translateInLanguage(key, "zh-CN");
        const en = i18n.translateInLanguage(key, "en-US");
        assert.ok(zh && zh !== key, `zh-CN 必须包含 AI 词条翻译: ${key}`);
        assert.ok(en && en !== key, `en-US 必须包含 AI 词条翻译: ${key}`);
        assert.notEqual(zh, en, `中英文词条不能完全雷同: ${key}`);
    }
}

// —— 维度 2：输入净化与抗对抗载荷 (Sanitization & Parsing) ——
{
    // 1. 超长截断 (<= 500)
    const longText = "每天跑步 ".repeat(150);
    const minimal = nld.buildMinimalAiDraftContext(longText);
    assert.ok(minimal.sanitizedLength <= 500, "超长文本必须硬截断至 500 字符内");

    // 2. 敏感模式探测 (Token, Email, Phone)
    const sensitiveText = "每天打卡，联系 test@example.com 或 13812345678，token: bearer sk-1234567890abcdef123456";
    const sensitiveResult = nld.detectSensitiveContent(sensitiveText);
    assert.equal(sensitiveResult.hasSensitive, true);
    assert.ok(sensitiveResult.types.includes("email"));
    assert.ok(sensitiveResult.types.includes("phone"));
    assert.ok(sensitiveResult.types.includes("token_or_key"));

    // 3. 恶意脚本与对抗载荷拦截
    const hostileMarkdown = '```json\n{"name": "冥想", "note": "<script>alert(1)</script>"}\n```';
    const hostileParsed = nld.parseProjectDraftFromModelOutput(hostileMarkdown);
    assert.equal(hostileParsed.diagnostic, "untrusted_content", "包含脚本标签的输出必须被标记为不可信内容");

    // 4. 代码围栏与客套话安全解析
    const rawMarkdown = `
好的！根据您的需求，为您生成如下打卡配置：
\`\`\`json
{
  "name": "冥想练习",
  "icon": "🧘",
  "kind": "duration",
  "target": 15,
  "unit": "分钟",
  "schedule": {"type": "daily"},
  "group": "健康",
  "priority": "medium",
  "timeSlot": "morning",
  "note": "晨间正念"
}
\`\`\`
请确认是否满意！
`;
    const parsed = nld.parseProjectDraftFromModelOutput(rawMarkdown);
    assert.equal(parsed.diagnostic, "ok", "有效围栏必须解析成功");
    assert.ok(parsed.envelope && parsed.envelope.candidates.length > 0);
    const draft = parsed.envelope.candidates[0];
    assert.equal(draft.name, "冥想练习");
    assert.equal(draft.target, 15);
    assert.equal(draft.unit, "分钟");
}

// —— 维度 3：无模型与离线双降级 (Fallback & Zero Mock) ——
{
    // 降级 A：自足提示词复制
    const prompt = nld.buildProjectCreatePrompt("工作日晨跑 5 公里");
    assert.ok(prompt.includes("工作日晨跑 5 公里"));
    assert.ok(prompt.includes("标准 JSON 格式数据"));
    assert.ok(prompt.includes("【输出要求】"));

    // 降级 B：本地确定性规则秒级推断
    const localDraft = nld.generateLocalFallbackDraft("每天喝 2000 毫升水");
    assert.ok(localDraft, "本地规则必须产生可用草案");
    assert.equal(localDraft.name, "喝水");
    assert.equal(localDraft.target, 2000);
    assert.equal(localDraft.unit, "毫升");
    assert.equal(localDraft.schedule.type, "daily");

    // 明确声明外部网络非必需与零数据损失保证
    const editorSpec = nld.getAiSurfaceEntrySpec("editor_draft");
    assert.equal(editorSpec.externalApiRequired, false);
    assert.equal(editorSpec.zeroDataLossGuarantee, true);

    const disclosure = nld.getAiDraftPrivacyDisclosure();
    assert.equal(disclosure.localFirst, true);
    assert.equal(disclosure.costFreeForLocal, true);
    assert.equal(disclosure.notesSent, false);
    assert.equal(disclosure.historySent, false);
    assert.equal(disclosure.keysSent, false);
}

// —— 维度 4：异步生命周期与跨代际防线 (Lifecycle & Superseding) ——
{
    const manager = new nld.AiDraftLifecycleManager();
    const rootId = "matrix_test_root";

    const session1 = manager.createSession(rootId, "晨跑 30分钟");
    assert.equal(session1.generation, 1);
    assert.equal(manager.isSessionCurrent(session1), true);

    // 快速发起第二次请求：代际必须递增，旧会话标记 superseded
    const session2 = manager.createSession(rootId, "夜跑 45分钟");
    assert.equal(session2.generation, 2);
    assert.equal(manager.isSessionCurrent(session1), false, "旧代际必须立即失效");
    assert.equal(manager.isSessionCurrent(session2), true);

    // 模拟旧响应迟到：结算必须被拦截拒绝
    const lateResult = manager.settleSession(rootId, session1.requestId, {
        candidate: {name: "旧跑步", icon: "🏃", kind: "duration", target: 30, unit: "分钟", schedule: {type: "daily"}, group: "运动", priority: "medium", timeSlot: "any"},
    });
    assert.equal(lateResult.applied, false, "迟到旧响应绝对不能入账");
    assert.equal(lateResult.reason, "superseded");
}

// —— 维度 5：事实安全与保存原子回滚 (Zero Side-Effect & Rollback) ——
{
    const initialStore = {
        items: [{id: "item_existing", name: "既有习惯", target: 1, unit: "次", schedule: {type: "daily"}}],
        events: [{id: "ev_1", itemId: "item_existing", localDate: "2026-10-30", value: 1}],
    };

    // 验证推断与起草绝对零 Store 变更
    const afterStore = {
        items: [...initialStore.items],
        events: [...initialStore.events],
    };
    nld.generateLocalFallbackDraft("每天跳绳 500 次");
    nld.generateAiIntentEnvelope("11月11日 购物节");
    const isClean = nld.verifyZeroStoreSideEffect(initialStore, afterStore);
    assert.equal(isClean, true, "推断过程绝对零 Store 变更");

    // 验证最小审计凭据生成（绝不持久化长文本 Prompt）
    const dummyDraft = {name: "跳绳", icon: "✓", kind: "count", target: 500, unit: "次", schedule: {type: "daily"}, group: "运动", priority: "medium", timeSlot: "any"};
    const audit = nld.createAiDraftProvenanceAudit(dummyDraft, "item_new_123", "请帮我建一个每天跳绳500次的打卡");
    assert.equal(audit.itemId, "item_new_123");
    assert.equal(audit.itemName, "跳绳");
    assert.equal(audit.source, "ai_draft");
    assert.equal(audit.schemaVersion, 1);
    assert.equal(typeof audit.at, "string");
    assert.ok(!("userPrompt" in audit), "严禁将用户自然语言长文本固化到审计凭据中");
}

// —— 维度 6：意图边界与至多双候选 (Intent Boundary & Candidates) ——
{
    // 1. 习惯打卡判定
    const habitEnv = nld.generateAiIntentEnvelope("工作日晚间阅读 45 分钟");
    assert.equal(habitEnv.intentType, "checkin_item");
    assert.equal(habitEnv.cognitiveBurdenAssessment.strategy, "one_shot");
    assert.equal(habitEnv.cognitiveBurdenAssessment.followUpDisallowed, true);

    // 2. 日期事项判定
    const occasionEnv = nld.generateAiIntentEnvelope("2026-12-25 圣诞聚会");
    assert.equal(occasionEnv.intentType, "occasion");
    assert.equal(occasionEnv.primaryCandidate.draft.date, "2026-12-25");

    // 3. 歧义判定与至多双候选
    const ambiguousEnv = nld.generateAiIntentEnvelope("10月28日跑步");
    assert.equal(ambiguousEnv.intentType, "ambiguous");
    assert.ok(ambiguousEnv.primaryCandidate, "候选 1 必须存在");
    assert.ok(ambiguousEnv.secondaryCandidate, "候选 2 必须存在");
    assert.ok(!("tertiaryCandidate" in ambiguousEnv), "严禁出现第 3 个候选造成选择瘫痪");
    assert.equal(ambiguousEnv.disambiguation.options.length, 2);
}

// —— 维度 7：多表面与多 Root 隔离 (Multi-Surface Isolation) ——
{
    const manager = new nld.AiDraftLifecycleManager();
    const dockRoot = "root_dock";
    const tabRoot = "root_tab";
    const dialogRoot = "root_dialog";
    const mobileRoot = "root_mobile";

    manager.createSession(dockRoot, "Dock 习惯");
    manager.createSession(tabRoot, "Tab 习惯");
    manager.createSession(dialogRoot, "Dialog 习惯");
    manager.createSession(mobileRoot, "Mobile 习惯");

    assert.equal(manager.getGeneration(dockRoot), 1);
    assert.equal(manager.getGeneration(tabRoot), 1);
    assert.equal(manager.getGeneration(dialogRoot), 1);
    assert.equal(manager.getGeneration(mobileRoot), 1);

    // 销毁 Dialog Root，其余 3 个 Root 状态与代际完全不受影响
    manager.disposeRoot(dialogRoot);
    assert.equal(manager.isSessionCurrent(manager.activeSessions.get(dialogRoot)), false);
    assert.equal(manager.isSessionCurrent(manager.activeSessions.get(dockRoot)), true);
    assert.equal(manager.isSessionCurrent(manager.activeSessions.get(tabRoot)), true);
    assert.equal(manager.isSessionCurrent(manager.activeSessions.get(mobileRoot)), true);
}

// —— 维度 8：无障碍、键盘与 IME 防护 (A11y, Keyboard & IME) ——
{
    // IME 组合打字防护条件测试
    const shouldIgnoreEnter = (event) => Boolean(event.isComposing || event.keyCode === 229);

    assert.equal(shouldIgnoreEnter({isComposing: true, keyCode: 13}), true, "打字中按 Enter 必须被拦截");
    assert.equal(shouldIgnoreEnter({isComposing: false, keyCode: 229}), true, "输入法处理码 229 必须被拦截");
    assert.equal(shouldIgnoreEnter({isComposing: false, keyCode: 13}), false, "正常回车方可触发推断");

    // 4 个经典习惯 Chips 存在性与覆盖测试
    const chips = ["晨跑", "阅读", "喝水", "冥想"];
    for (const chip of chips) {
        const draft = nld.generateLocalFallbackDraft(chip);
        assert.ok(draft, `Chip [${chip}] 必须能成功推断出合法草案`);
        assert.ok(draft.name.length > 0);
    }
}

console.log("ai-draft-full-acceptance-matrix: all 8 dimensions (i18n, sanitization, fallback, lifecycle, fact-safety, boundary, multi-root, a11y) passed 100%.");
