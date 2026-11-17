/* T-1538 专项测试：专注计时闲置暂停、番茄承诺制与净时长双口径治理门禁 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const compilerOptions = {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS};
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "siyuan-focus-idle-"));

const transpile = (sourcePath, outName) => {
    const text = fs.readFileSync(sourcePath, "utf8");
    const transpiled = ts.transpileModule(text, {compilerOptions}).outputText;
    fs.writeFileSync(path.join(dir, outName), transpiled);
    return require(path.join(dir, outName));
};

const gov = transpile(path.join(root, "src", "features", "focus-idle-governance.ts"), "focus-idle-governance.js");

console.log("Starting focus-idle-governance tests (T-1538)...");

// 1. 默认配置生成与模式隔离断言 (Default Config)
{
    const strictCfg = gov.createDefaultFocusIdleConfig("strict_pomodoro");
    assert.equal(strictCfg.mode, "strict_pomodoro");
    assert.equal(strictCfg.idleThresholdSec, 180, "默认闲置阈值 180 秒");
    assert.equal(strictCfg.autoPauseOnIdle, false, "严格番茄钟严禁自动静默暂停");

    const relaxedCfg = gov.createDefaultFocusIdleConfig("relaxed_net_duration");
    assert.equal(relaxedCfg.mode, "relaxed_net_duration");
    assert.equal(relaxedCfg.autoPauseOnIdle, true, "宽松净时长模式允许闲置自动暂停");
}

// 2. 正常活跃期评估断言 (Active within threshold)
{
    const cfg = gov.createDefaultFocusIdleConfig("relaxed_net_duration");
    const res = gov.evaluateFocusIdleStep(600, 60, cfg); // 总共跑了 10 分钟，最后 1 分钟前有操作
    assert.equal(res.isIdle, false);
    assert.equal(res.idleDeductedSec, 0);
    assert.equal(res.netFocusSec, 600);
    assert.equal(res.shouldAutoPause, false);
    assert.equal(res.statusNoteKey, "focus.active");
}

// 3. 严格番茄模式超时零扣除断言 (Strict Pomodoro Idle: Zero Deduction)
{
    const strictCfg = gov.createDefaultFocusIdleConfig("strict_pomodoro");
    // 总共 1500 秒 (25分钟)，用户中途离开 360 秒 (6分钟，超额 3分钟)
    const res = gov.evaluateFocusIdleStep(1500, 360, strictCfg);
    assert.equal(res.isIdle, true, "标记处于闲置状态");
    assert.equal(res.idleDeductedSec, 0, "严格番茄钟绝不静默扣减时长");
    assert.equal(res.netFocusSec, 1500, "净时长依然保持总时长");
    assert.equal(res.shouldAutoPause, false, "严格番茄钟不自动暂停，由用户决定坚持或放弃");
    assert.equal(res.statusNoteKey, "focus.idlePrompt");
}

// 4. 宽松净时长模式超时扣除与自动暂停断言 (Relaxed Net Duration: Deduct Idle)
{
    const relaxedCfg = gov.createDefaultFocusIdleConfig("relaxed_net_duration");
    // 总共 1500 秒 (25分钟)，离开 360 秒 (6分钟，阈值 180 秒，超出 180 秒)
    const res = gov.evaluateFocusIdleStep(1500, 360, relaxedCfg);
    assert.equal(res.isIdle, true);
    assert.equal(res.idleDeductedSec, 180, "精准扣除超出阈值的 180 秒 (3分钟)");
    assert.equal(res.netFocusSec, 1320, "净时长结算为 1320 秒 (22分钟)");
    assert.equal(res.shouldAutoPause, true, "宽松模式触发自动暂停");
    assert.equal(res.statusNoteKey, "focus.idlePaused");
}

// 5. 极端超额闲置下限截断保护 (Clamping Guard)
{
    const relaxedCfg = gov.createDefaultFocusIdleConfig("relaxed_net_duration");
    // 刚开始 60 秒，闲置了 600 秒
    const res = gov.evaluateFocusIdleStep(60, 600, relaxedCfg);
    assert.equal(res.idleDeductedSec, 60, "扣除时长不得超过总流逝时间");
    assert.equal(res.netFocusSec, 0, "净时长绝不为负数");
}

// 6. 双口径显示格式化断言 (Dual Duration Formatting)
{
    const withDeduction = gov.formatDualDurationDisplay(1320, 180);
    assert.equal(withDeduction.mainMinutes, 22);
    assert.equal(withDeduction.idleMinutes, 3);
    assert.equal(withDeduction.hasDeduction, true);
    assert.equal(withDeduction.summary, "净专注 22 分钟（闲置扣除 3 分钟）");

    const noDeduction = gov.formatDualDurationDisplay(1500, 0);
    assert.equal(noDeduction.mainMinutes, 25);
    assert.equal(noDeduction.idleMinutes, 0);
    assert.equal(noDeduction.hasDeduction, false);
    assert.equal(noDeduction.summary, "专注 25 分钟");
}

console.log("focus-idle-governance: all strict pomodoro, relaxed net duration, clamping, and dual-display tests passed 100%.");
