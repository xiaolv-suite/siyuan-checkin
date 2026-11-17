/* T-1684 专项守门测试：外部来源迟到响应与代际配置守门
   - 微信读书：时长/完读/笔记三链路代际透传与写前 enabled/itemId 复核；
   - 叶归 LifeLog：写前复核 notebookId、指纹与 mappings 动态解析，换绑/停用/指纹改变拒绝写回；
   - 健康收件箱：写前复核 docId、指纹与 metricBindings 动态匹配；
   - 笔记推导：写前复核 itemId、指纹与 enabled 状态；
   - 思阅与思播：会话代际防护与写前 itemId/enabled 复核；
   - 偏好重载与 onunload 卸载时全来源代际失效阻断。 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const pluginSource = fs.readFileSync(path.join(root, "src", "index.ts"), "utf8");

/* 1. 思播与思阅代际计数器与复位守门 */
assert.match(pluginSource, /private sireaderGeneration = 0;/, "sireaderGeneration declared");
assert.match(pluginSource, /private siplayerGeneration = 0;/, "siplayerGeneration declared");
assert.match(pluginSource, /this\.sireaderGeneration \+= 1;\s*this\.sireaderTracker\?\.discardInFlight\(\);/, "resetSireaderTracker increments sireaderGeneration");
assert.match(pluginSource, /this\.siplayerGeneration \+= 1;\s*this\.siplayerTracker\?\.discardInFlight\(\);/, "resetSiplayerTracker increments siplayerGeneration");

/* 2. 思播与思阅写前动态复核代际与目标 */
assert.match(pluginSource, /this\.siplayerGeneration !== generation/, "writeSiplayerSegments checks generation inside mutation");
assert.match(pluginSource, /this\.siplayerIntegration\.itemId !== expectedItemId/, "writeSiplayerSegments checks current itemId dynamically inside mutation");
assert.match(pluginSource, /this\.sireaderGeneration !== generation/, "writeSireaderSegments checks generation inside mutation");
assert.match(pluginSource, /this\.sireaderIntegration\.itemId !== expectedItemId/, "writeSireaderSegments checks current itemId dynamically inside mutation");

/* 3. 微信读书三链路代际透传与写前复核 */
assert.match(pluginSource, /if \(governance\.finishItemId\) finished = await this\.ingestWereadFinished\(generation\);/, "ingestWereadFinished receives generation parameter");
assert.match(pluginSource, /if \(governance\.notesItemId && yesterday\) notes = await this\.ingestWereadNotes\(yesterday, generation\);/, "ingestWereadNotes receives generation parameter");
assert.match(pluginSource, /if \(!this\.wereadIntegration\.enabled \|\| this\.wereadIntegration\.itemId !== governance\.itemId\) return Promise\.resolve\(undefined\);/, "weread duration checks current itemId dynamically inside mutation");
assert.match(pluginSource, /if \(generation !== undefined && this\.wereadGeneration !== generation\) return \{written: 0, pending: 0\};/, "weread finished checks generation on entry");
assert.match(pluginSource, /if \(!this\.wereadIntegration\.enabled \|\| this\.wereadIntegration\.finishItemId !== governance\.finishItemId\) return Promise\.resolve\(undefined\);/, "weread finished checks current finishItemId dynamically inside mutation");
assert.match(pluginSource, /if \(generation !== undefined && this\.wereadGeneration !== generation\) return \{status: "skipped", tally: 0\};/, "weread notes checks generation on entry");
assert.match(pluginSource, /if \(!this\.wereadIntegration\.enabled \|\| this\.wereadIntegration\.notesItemId !== governance\.notesItemId\) return Promise\.resolve\(undefined\);/, "weread notes checks current notesItemId dynamically inside mutation");

/* 4. 健康收件箱写前复核 docId、指纹与当前指标绑定 */
assert.match(pluginSource, /const currentGov = this\.healthInbox;\s*if \(!currentGov\.enabled \|\| currentGov\.docId !== governance\.docId\) return Promise\.resolve\(undefined\);/, "health inbox checks enabled and docId inside mutation");
assert.match(pluginSource, /const currentFingerprintNow = getHealthInboxFingerprint\(currentGov\);\s*if \(currentFingerprintNow !== currentFingerprint\) return Promise\.resolve\(undefined\);/, "health inbox checks fingerprint inside mutation");
assert.match(pluginSource, /const activeBinding = currentGov\.metricBindings\.find\(\(binding\) => binding\.metric === entry\.metric\);\s*if \(!activeBinding \|\| activeBinding\.itemId !== itemId\) return Promise\.resolve\(undefined\);/, "health inbox checks active metric binding inside mutation");

/* 5. 笔记推导写前复核目标项目与查询指纹 */
assert.match(pluginSource, /const currentGov = normalizeNoteQueryPreference\(this\.noteQuery\);\s*if \(!currentGov\.enabled \|\| currentGov\.itemId !== governance\.itemId\) return Promise\.resolve\(undefined\);/, "note query checks enabled and itemId inside mutation");
assert.match(pluginSource, /const currentFp = getNoteQueryFingerprint\(currentGov\);\s*if \(currentFp !== currentFingerprint\) return Promise\.resolve\(undefined\);/, "note query checks fingerprint inside mutation");

/* 6. 叶归 LifeLog 写前复核 notebookId、指纹与动态映射解析结果（支持零配置回退） */
assert.match(pluginSource, /const currentGov = this\.yeguifIntegration;\s*if \(!currentGov\.enabled \|\| (?:\(governance\.notebookId && )?currentGov\.notebookId !== governance\.notebookId\)?\) return Promise\.resolve\(undefined\);/, "yeguif checks enabled and notebookId inside mutation");
assert.match(pluginSource, /const currentFingerprintNow = getYeguifFingerprint\(currentGov\);\s*if \(currentFingerprintNow !== currentFingerprint\) return Promise\.resolve\(undefined\);/, "yeguif checks fingerprint inside mutation");
assert.match(pluginSource, /const activeItemId = resolveYeguifItemId\(entry\.type, currentGov\.mappings \|\| \[\], this\.store\.items\.filter\(\(item\) => !item\.archived && this\.hasMinuteTargetOnDate\(item\.id, today\)\)\);\s*if \(!activeItemId \|\| activeItemId !== itemId\) return Promise\.resolve\(undefined\);/, "yeguif dynamically validates mapping resolution inside mutation");

/* 7. onunload 卸载与偏好重载时的全来源代际失效阻断 */
assert.match(pluginSource, /async onunload\(\) \{\s*this\.anchorJumpRequestId \+= 1;\s*\/\* T-1684：自增所有外部来源代际[\s\S]*?this\.wereadGeneration \+= 1;\s*this\.yeguifGeneration \+= 1;\s*this\.healthGeneration \+= 1;\s*this\.noteQueryGeneration \+= 1;\s*this\.siplayerGeneration \+= 1;\s*this\.sireaderGeneration \+= 1;\s*this\.resetSireaderTracker\(\);\s*this\.resetSiplayerTracker\(\);/, "onunload increments generations of all 6 external sources and resets trackers");
assert.match(pluginSource, /\/\* T-1684：偏好重载或失败回滚时自增外部代际[\s\S]*?this\.sireaderGeneration \+= 1;\s*this\.siplayerGeneration \+= 1;\s*this\.healthGeneration \+= 1;\s*this\.noteQueryGeneration \+= 1;\s*this\.wereadGeneration \+= 1;\s*this\.yeguifGeneration \+= 1;\s*this\.resetSireaderTracker\(\);\s*this\.resetSiplayerTracker\(\);/, "applyViewPreferences increments generations of all 6 external sources and resets trackers");

console.log("External late response & configuration generation tests passed: 6 external sources guarded, dynamic target/mapping validation inside mutation, onunload & preference reload invalidation complete.");
