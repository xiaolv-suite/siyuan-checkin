/* T-1354 CSS 卫生门禁：维护态硬约束——
   1) dist/index.css 不允许出现源码无字面引用的死类（动态 is-/has-/数字后缀单独归类待人工核对）；
   2) 重复规则体积受护栏约束（esbuild 已合并大部分，超出即回归）。
   预算数字（D-718 覆盖层清理与单向下调契约）：硬上限下调至 640KiB（655,360 字节），此后只降不升。 */
const assert = require("node:assert/strict");
const {cssAudit} = require("../scripts/css-audit.cjs");

const HARD_BUDGET_BYTES = 640 * 1024;
const result = cssAudit();
assert.equal(result.dead.length, 0, `CSS 出现源码无引用的死类，先人工核对再清理：\n${result.dead.join("\n")}`);
assert.ok(result.duplicateRuleBytes < 1000, `duplicate rule volume regressed (~${result.duplicateRuleBytes} bytes)`);
assert.ok(result.bytes <= HARD_BUDGET_BYTES, `CSS ${result.bytes} bytes exceeds the D-718 ratchet-down hard budget of ${HARD_BUDGET_BYTES} bytes`);
console.log(`CSS hygiene checks passed: ${result.total} class tokens, 0 dead, duplicates ~${result.duplicateRuleBytes} bytes, size ${result.bytes} bytes (hard budget <= 640KiB)`);
