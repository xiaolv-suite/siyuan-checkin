/* T-1688, T-1689, T-1690 专项守门：自然语言到项目草案 Envelope、模型输出解析与审阅差异治理。
   - T-1688：Envelope 规范（schemaVersion: 1、双候选上限、来源标识、置信度与诊断码）；
   - T-1689：模型输出解析安全防线（支持纯 JSON 与 Markdown 围栏、过滤注入与超长载荷、诊断码分类）；
   - T-1690：草案审阅、同名冲突检测与用户表单差异比对（保护用户手填字段、安全回填普通编辑器、模型绝不直写 Store）。 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const sourceRoot = path.join(__dirname, "..", "src");

/* 模块安全加载器 */
const loadedModules = new Map();
function loadProduction(relative) {
    const filename = path.resolve(sourceRoot, relative);
    if (loadedModules.has(filename)) return loadedModules.get(filename).exports;
    const productionModule = {exports: {}};
    loadedModules.set(filename, productionModule);
    const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
        compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS},
    }).outputText;
    new Function("require", "module", "exports", compiled)((request) => {
        assert.ok(request.startsWith("."), `unexpected dependency ${request}`);
        return loadProduction(path.resolve(path.dirname(filename), `${request}.ts`));
    }, productionModule, productionModule.exports);
    return productionModule.exports;
}

const nld = loadProduction("features/natural-language-draft.ts");

function runNaturalLanguageDraftChecks() {
    console.log("Starting T-1688 / T-1689 / T-1690 natural language draft governance checks...");

    const validDraft1 = {
        name: "晨间阅读",
        icon: "📖",
        kind: "count",
        target: 20,
        unit: "页",
        schedule: {type: "daily"},
        group: "学习",
        priority: "medium",
        timeSlot: "morning",
        note: "起床后阅读20页经典著作",
    };

    const validDraft2 = {
        name: "晨跑",
        icon: "🏃",
        kind: "duration",
        target: 30,
        unit: "分钟",
        schedule: {type: "daily"},
        group: "健康",
        priority: "high",
        timeSlot: "morning",
        note: "户外慢跑30分钟",
    };

    /* =========================================================================
       T-1688: ProjectDraftEnvelope 数据契约与候选容量治理
       ========================================================================= */
    {
        // 1.1 基础 Envelope 构造与不可变性
        const env = nld.createProjectDraftEnvelope({
            source: "provider",
            modelSummary: "deepseek-chat-v3",
            candidates: [validDraft1],
            confidence: "high",
        });

        assert.equal(env.schemaVersion, 1, "schemaVersion is strictly 1");
        assert.equal(env.source, "provider");
        assert.equal(env.modelSummary, "deepseek-chat-v3");
        assert.equal(env.candidates.length, 1);
        assert.equal(env.candidates[0].name, "晨间阅读");
        assert.equal(env.confidence, "high");
        assert.ok(Number.isFinite(Date.parse(env.capturedAt)), "capturedAt is valid ISO timestamp");

        // 1.2 候选数量上限为 2，超出部分丢弃，且相同候选去重
        const envCapped = nld.createProjectDraftEnvelope({
            source: "provider",
            modelSummary: "test",
            candidates: [validDraft1, validDraft2, validDraft1, {...validDraft1, name: "第三个候选"}],
        });
        assert.equal(envCapped.candidates.length, 2, "candidates capped at strictly 2");
        assert.equal(envCapped.candidates[0].name, "晨间阅读");
        assert.equal(envCapped.candidates[1].name, "晨跑");

        // 1.3 归一化与校验 fail-closed
        assert.equal(nld.normalizeProjectDraftEnvelope(undefined), undefined, "undefined fails closed");
        assert.equal(nld.normalizeProjectDraftEnvelope({schemaVersion: 2}), undefined, "bad schemaVersion fails closed");
        assert.equal(nld.normalizeProjectDraftEnvelope({...env, source: "unknown_hack"}), undefined, "bad source fails closed");
        assert.equal(nld.normalizeProjectDraftEnvelope({...env, capturedAt: "invalid-date"}), undefined, "bad date fails closed");

        const normalized = nld.normalizeProjectDraftEnvelope(env);
        assert.ok(normalized);
        assert.equal(normalized.candidates.length, 1);

        console.log("  ✓ T-1688: ProjectDraftEnvelope schema, capping (<=2), and fail-closed validation verified");
    }

    /* =========================================================================
       T-1689: 模型输出文本安全解析与不可信边界
       ========================================================================= */
    {
        // 2.1 纯 JSON 解析
        const pureJson = JSON.stringify(validDraft1);
        const res1 = nld.parseProjectDraftFromModelOutput(pureJson);
        assert.equal(res1.diagnostic, "ok");
        assert.ok(res1.envelope);
        assert.equal(res1.envelope.candidates[0].name, "晨间阅读");

        // 2.2 Markdown 代码围栏解析 (```json ... ```)
        const fencedJson = `
这是一份为您生成的打卡计划：
\`\`\`json
${JSON.stringify({candidates: [validDraft1, validDraft2]})}
\`\`\`
希望对您有帮助！
`;
        const res2 = nld.parseProjectDraftFromModelOutput(fencedJson);
        assert.equal(res2.diagnostic, "ok");
        assert.equal(res2.envelope.candidates.length, 2);

        // 2.3 无围栏但夹杂前后闲聊文本的 JSON 提取
        const mixedText = `为您规划如下：{ "name": "早起喝水", "icon": "💧", "kind": "quantity", "target": 500, "unit": "毫升", "schedule": { "type": "daily" }, "group": "生活", "priority": "medium", "timeSlot": "morning", "note": "起床一杯水" } 请查收。`;
        const res3 = nld.parseProjectDraftFromModelOutput(mixedText);
        assert.equal(res3.diagnostic, "ok");
        assert.equal(res3.envelope.candidates[0].name, "早起喝水");

        // 2.4 对抗性攻击与脚本注入拦截
        const scriptAttack = `\`\`\`json
{"name": "<script>alert('xss')</script>", "kind": "binary", "target": 1, "unit": "次", "schedule": {"type": "daily"}}
\`\`\``;
        const resAttack = nld.parseProjectDraftFromModelOutput(scriptAttack);
        assert.equal(resAttack.diagnostic, "untrusted_content", "script tag rejected as untrusted content");
        assert.equal(resAttack.envelope, undefined);

        // 2.5 非法 JSON 诊断码
        const badJson = `{ name: "unquotedKey", target: 123 }`;
        const resBad = nld.parseProjectDraftFromModelOutput(badJson);
        assert.equal(resBad.diagnostic, "invalid_json");

        // 2.6 超长 Payload 拦截（> 4096 字符）
        const hugePayload = "a".repeat(4097);
        const resHuge = nld.parseProjectDraftFromModelOutput(hugePayload);
        assert.equal(resHuge.diagnostic, "payload_too_large");

        // 2.7 空 Payload 拦截
        const resEmpty = nld.parseProjectDraftFromModelOutput("");
        assert.equal(resEmpty.diagnostic, "empty_payload");

        console.log("  ✓ T-1689: Model output JSON extraction, code fence handling, and XSS injection defense verified");
    }

    /* =========================================================================
       T-1690: 草案审阅、同名冲突探测与用户手填表单差异保护
       ========================================================================= */
    {
        const existingItems = [
            {id: "exist-1", name: "晨间阅读", archived: false},
            {id: "exist-2", name: "旧习惯", archived: true},
        ];

        // 3.1 同名冲突检测（不区分大小写）
        const conflictReview = nld.evaluateDraftApplicationDiff({}, validDraft1, existingItems);
        assert.equal(conflictReview.hasNameConflict, true, "detected conflict with active item '晨间阅读'");
        assert.equal(conflictReview.conflictingItemName, "晨间阅读");
        assert.equal(conflictReview.canApplyDirectly, false, "cannot apply directly without user disambiguation");

        // 3.2 无冲突项目
        const nonConflictReview = nld.evaluateDraftApplicationDiff({}, validDraft2, existingItems);
        assert.equal(nonConflictReview.hasNameConflict, false, "no conflict for '晨跑'");
        assert.equal(nonConflictReview.canApplyDirectly, true, "can apply directly");

        // 3.3 差异比对（Diff）与保护用户显式手填值
        const userForm = {
            name: "晨跑",
            target: 45, // 用户手动修改了目标为 45 分钟
            note: "用户自己写的心得", // 用户自己手填的备注
        };

        const diffReview = nld.evaluateDraftApplicationDiff(userForm, validDraft2, existingItems);
        assert.equal(diffReview.diffs.length > 0, true, "diffs computed");

        const targetDiff = diffReview.diffs.find((d) => d.field === "target");
        assert.ok(targetDiff);
        assert.equal(targetDiff.before, 45);
        assert.equal(targetDiff.after, 30);
        assert.equal(targetDiff.isUserModified, true);

        // 保护策略：用户的 45 分钟和手动心得在合并后被完整保留！
        assert.equal(diffReview.mergedDraft.target, 45, "user modified target 45 is preserved over draft target 30");
        assert.equal(diffReview.mergedDraft.note, "用户自己写的心得", "user custom note is preserved over draft note");
        assert.equal(diffReview.mergedDraft.unit, "分钟", "unmodified draft unit is filled in");
        assert.equal(diffReview.mergedDraft.timeSlot, "morning", "unmodified draft timeSlot is filled in");
        assert.ok(diffReview.preservedUserFields.includes("target"));
        assert.ok(diffReview.preservedUserFields.includes("note"));

        console.log("  ✓ T-1690: Name conflict detection, diff auditing, and manual user form field protection verified");
    }

    /* =========================================================================
       T-1686 & T-1687: 提示词自足构建、离线纯规则推断与模型就绪降级评定
       ========================================================================= */
    {
        // 4.1 结构化建项提示词构建
        const prompt = nld.buildProjectCreatePrompt("每天早晨跑步30分钟");
        assert.ok(prompt.includes("每天早晨跑步30分钟"), "user text embedded");
        assert.ok(prompt.includes("```json"), "specifies markdown code block");
        assert.ok(prompt.includes("kind"), "specifies target kind enum");
        assert.ok(prompt.includes("schedule"), "specifies schedule type");

        // 4.2 本地离线纯规则推断（零网络零模型）
        const localDraft = nld.generateLocalFallbackDraft("每天早上跑步30分钟");
        assert.ok(localDraft, "local fallback draft generated successfully");
        assert.equal(localDraft.kind, "duration");
        assert.equal(localDraft.unit, "分钟");
        assert.equal(localDraft.target, 30);
        assert.equal(localDraft.timeSlot, "morning");
        assert.equal(localDraft.schedule.type, "daily");

        // 4.3 模型就绪度状态机评定
        // 无用户描述 -> 建议本地
        const r1 = nld.evaluateModelReadiness({hasPublicModelApi: true, isModelConfigured: true, hasUserDescription: false});
        assert.equal(r1.canAutoInvoke, false);
        assert.equal(r1.recommendedAction, "use_local");

        // 宿主无公开模型 API -> 降级为复制提示词
        const r2 = nld.evaluateModelReadiness({hasPublicModelApi: false, isModelConfigured: false, hasUserDescription: true});
        assert.equal(r2.canAutoInvoke, false);
        assert.equal(r2.recommendedAction, "copy_prompt");

        // 宿主有 API 但未配置模型 -> 降级为复制提示词
        const r3 = nld.evaluateModelReadiness({hasPublicModelApi: true, isModelConfigured: false, hasUserDescription: true});
        assert.equal(r3.canAutoInvoke, false);
        assert.equal(r3.recommendedAction, "copy_prompt");

        // 宿主有 API 且模型已就绪 -> 允许自动调用
        const r4 = nld.evaluateModelReadiness({hasPublicModelApi: true, isModelConfigured: true, hasUserDescription: true});
        assert.equal(r4.canAutoInvoke, true);
        assert.equal(r4.recommendedAction, "direct_invoke");

        console.log("  ✓ T-1686 & T-1687: Prompt builder, offline rule fallback, and readiness downgrade verified");
    }

    console.log("All T-1686 ~ T-1690 natural language draft governance checks passed!");
}

runNaturalLanguageDraftChecks();
