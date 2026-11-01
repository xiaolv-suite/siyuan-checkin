const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

console.log("Starting ecosystem-occasions-deep-linkage tests...");

// 1. Verify api contract and methods in src/api.ts
const apiSource = fs.readFileSync(path.join(__dirname, "..", "src", "api.ts"), "utf8");
assert.match(apiSource, /parseQuickOccasion:/, "api must export parseQuickOccasion");
assert.match(apiSource, /addOccasionQuick:/, "api must export addOccasionQuick");
assert.match(apiSource, /syncBirthdaysFromContacts:/, "api must export syncBirthdaysFromContacts");
assert.match(apiSource, /category: resolveOccasionCategory\(occasion\)/, "cloneOccasionForApi must enrich category");
assert.match(apiSource, /if \(name === "occasions\.write"\) return true;/, "hasCapability must recognize occasions.write");

// 2. Verify backflow and contacts linkage in src/index.ts
const indexSource = fs.readFileSync(path.join(__dirname, "..", "src", "index.ts"), "utf8");
assert.match(indexSource, /backflowOccasionCompletionToEcosystem/, "setOccasionCompleted must call backflowOccasionCompletionToEcosystem");
assert.match(indexSource, /checkin:occasion-completed/, "backflow must broadcast checkin:occasion-completed event");
assert.match(indexSource, /recordInteraction\(\[item\.contextBlockId\]/, "backflow must call contacts.recordInteraction for birthday");
assert.match(indexSource, /syncBirthdaysFromContacts\(root\?: HTMLElement\)/, "index must implement syncBirthdaysFromContacts");
assert.match(indexSource, /openButlerReminders\(\)/, "index must implement openButlerReminders");

// 3. Verify occasions render and bind
const occasionsSource = fs.readFileSync(path.join(__dirname, "..", "src", "render", "occasions.ts"), "utf8");
assert.match(occasionsSource, /data-action="sync-contacts-birthdays"/, "occasions template must contain sync-contacts-birthdays action");
assert.match(occasionsSource, /data-action="open-butler-reminders"/, "occasions template must contain open-butler-reminders action");
assert.match(occasionsSource, /occ\.contactsDoc/, "occasions template must use contactsDoc label for birthday contextBlockId");

const bindSource = fs.readFileSync(path.join(__dirname, "..", "src", "render", "bind-occasions.ts"), "utf8");
assert.match(bindSource, /sync-contacts-birthdays/, "bind-occasions must bind sync-contacts-birthdays");
assert.match(bindSource, /open-butler-reminders/, "bind-occasions must bind open-butler-reminders");

console.log("ecosystem-occasions-deep-linkage: all assertions passed!");
