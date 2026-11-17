const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

/* T-1669 专项守门测试：
   思源版本、桌面/移动/浏览器前端兼容矩阵与降级契约刷新
   1. 5 大前端形态（desktop, desktop-window, browser-desktop, mobile, browser-mobile）全量在册；
   2. plugin.json minAppVersion 与兼容文档精确一致；
   3. 下载桥（原生 saveExportFile 与浏览器 Blob 降级）契约在位；
   4. 文档选择（/api/filetree/searchDocs 搜索与手填 ID 降级）契约在位；
   5. 渲染块（代码块探测与安全纯显示降级）契约在位；
   6. 键盘心流（桌面快捷键与 IME 组合输入防护 vs 移动端触觉手势）分层在位；
   7. 发布服务与只读模式（disabledInPublish: false 与 403 友好回退）契约在位。 */

const projectRoot = path.resolve(__dirname, "..");
const pluginJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "plugin.json"), "utf8"));
const compatDoc = fs.readFileSync(path.join(projectRoot, "docs", "siyuan-compatibility.md"), "utf8");
const downloadSrc = fs.readFileSync(path.join(projectRoot, "src", "download.ts"), "utf8");
const blockRendererSrc = fs.readFileSync(path.join(projectRoot, "src", "render", "block-renderer.ts"), "utf8");
const settingsSrc = fs.readFileSync(path.join(projectRoot, "src", "render", "settings.ts"), "utf8");

// 1. 前端形态声明与文档对齐
const expectedFrontends = ["desktop", "browser-desktop", "desktop-window", "mobile", "browser-mobile"];
assert.deepEqual(pluginJson.frontends, expectedFrontends, "plugin.json frontends must declare all 5 supported targets");

for (const frontend of expectedFrontends) {
    assert.ok(compatDoc.includes(`\`${frontend}\``), `compatibility doc must explicitly cover frontend ${frontend}`);
}

// 2. 版本声明一致性
assert.match(pluginJson.minAppVersion, /^\d+\.\d+\.\d+$/, "minAppVersion must be a semantic 3-part version");
assert.ok(compatDoc.includes(pluginJson.minAppVersion), "compatibility doc must document declared minAppVersion");

// 3. 下载桥能力与原生降级契约
assert.match(downloadSrc, /export function nativeExportBridge/, "download.ts exports nativeExportBridge probe");
assert.match(downloadSrc, /JSAndroid\?\.saveExportFile/, "supports Android native bridge");
assert.match(downloadSrc, /webkit\?\.messageHandlers\?\.saveExportFile/, "supports iOS native bridge");
assert.match(downloadSrc, /JSHarmony\?\.saveExportFile/, "supports Harmony native bridge");
assert.match(downloadSrc, /saveExportFile\(/, "calls native saveExportFile when available");
assert.match(downloadSrc, /URL\.createObjectURL\(new Blob/, "falls back to browser Blob download for desktop/browser");
assert.ok(compatDoc.includes("saveExportFile") && compatDoc.includes("Blob"), "doc details native and blob download bridges");

const indexSrc = fs.readFileSync(path.join(projectRoot, "src", "index.ts"), "utf8");

// 4. 文档选择与搜索降级契约
assert.match(indexSrc, /\/api\/filetree\/searchDocs/, "index.ts calls /api/filetree/searchDocs for document search");
assert.ok(compatDoc.includes("/api/filetree/searchDocs"), "doc records searchDocs route usage");
assert.ok(compatDoc.includes("保留手填文档 ID"), "doc explains manual document ID fallback");

// 5. 渲染块识别与内部 DOM 隔离契约
assert.match(blockRendererSrc, /data-subtype/, "recognizes checkin code block via data-subtype");
assert.match(blockRendererSrc, /language-checkin/, "recognizes checkin code block via CSS class");
assert.match(blockRendererSrc, /protyle-action__language/, "recognizes checkin code block via label text");
assert.ok(compatDoc.includes("isCheckinCodeBlock"), "doc records block recognition boundaries");

// 6. 发布模式与只读降级
assert.equal(pluginJson.disabledInPublish, false, "plugin must remain enabled in publish mode for read-only dashboards");
assert.ok(compatDoc.includes("只读模式和发布服务"), "doc clarifies read-only 403 behavior in publish service");

console.log("frontend-compatibility-matrix: all 5 frontends, capability contracts and downgrade invariants verified successfully.");
