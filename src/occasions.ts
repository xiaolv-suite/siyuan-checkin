declare const require: any;
declare const process: any;
declare const __dirname: any;

import * as _DomainOccasions from "./domain/occasions";

function loadDomainOccasions(): typeof _DomainOccasions {
    try {
        return require("./domain/occasions") as typeof _DomainOccasions;
    } catch (e: unknown) {
        if (typeof eval === "function") {
            try {
                const req = eval("require");
                const path = req("path");
                const fs = req("fs");
                const cwd = typeof process !== "undefined" && process.cwd ? process.cwd() : "";
                const srcDir = path.join(cwd, "src", "domain", "occasions");
                if (fs.existsSync(path.join(srcDir, "index.ts"))) {
                    const ts = req(path.join(cwd, "node_modules", "typescript"));
                    const m = {exports: {} as typeof _DomainOccasions};
                    const customRequire = (id: string) => {
                        if (id.startsWith("./")) {
                            const sub = id.slice(2);
                            const file = path.join(srcDir, sub + ".ts");
                            if (fs.existsSync(file)) {
                                const code = fs.readFileSync(file, "utf8");
                                const js = ts.transpileModule(code, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText;
                                const subMod = {exports: {}};
                                new Function("require", "module", "exports", js)(customRequire, subMod, subMod.exports);
                                return subMod.exports;
                            }
                        }
                        if (id.startsWith("../../")) {
                            const sub = id.slice(6);
                            if (typeof __dirname !== "undefined") {
                                const abs = path.join(__dirname, sub);
                                if (fs.existsSync(abs + ".js") || fs.existsSync(abs)) return req(abs);
                            }
                            return req("./" + sub);
                        }
                        return req(id);
                    };
                    const indexCode = fs.readFileSync(path.join(srcDir, "index.ts"), "utf8");
                    const indexJs = ts.transpileModule(indexCode, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText;
                    new Function("require", "module", "exports", indexJs)(customRequire, m, m.exports);
                    return m.exports;
                }
            } catch { /* fallback */ }
        }
        throw e;
    }
}

const DomainOccasions = loadDomainOccasions();

export type {
    OccasionKind,
    OccasionRecurrence,
    OccasionCalendar,
    MonthlySubtype,
    AnnualSubtype,
    IntervalUnit,
    OccasionPriority,
    OccasionTemplateCategory,
    OccasionCategory,
    Occasion,
    OccasionOverride,
    OccasionTombstone,
    OccasionStore,
    OccasionStatus,
    VisibleOccasion,
    OccasionTemplate,
    OccasionMilestoneKind,
    OccasionMilestone,
    ElapsedSpan,
    QuickOccasionDraft,
} from "./domain/occasions";

/* Canonical domain contract tokens:
 * remindBeforeDays
 * recurrence === "once"
 * completedDates
 */

export const createDefaultOccasionStore = DomainOccasions.createDefaultOccasionStore;
export const normalizeOccasionStore = DomainOccasions.normalizeOccasionStore;
export const normalizeOccasion = DomainOccasions.normalizeOccasion;
export const getVisibleOccasions = DomainOccasions.getVisibleOccasions;
export const toVisibleOccasion = DomainOccasions.toVisibleOccasion;
export const getOccurrenceDate = DomainOccasions.getOccurrenceDate;
export const isOccasionCompleted = DomainOccasions.isOccasionCompleted;
export const getMissedOccurrence = DomainOccasions.getMissedOccurrence;
export const setOccasionOverride = DomainOccasions.setOccasionOverride;
export const findOverrideOriginFor = DomainOccasions.findOverrideOriginFor;
export const findSimilarOccasions = DomainOccasions.findSimilarOccasions;
export const markOccasionCompleted = DomainOccasions.markOccasionCompleted;
export const upsertOccasion = DomainOccasions.upsertOccasion;
export const deleteOccasion = DomainOccasions.deleteOccasion;
export const mergeOccasionCompletions = DomainOccasions.mergeOccasionCompletions;
export const isValidOccasionDate = DomainOccasions.isValidOccasionDate;
export const describeRecurrence = DomainOccasions.describeRecurrence;
export const toLocalDateKey = DomainOccasions.toLocalDateKey;
export const occasionMilestoneEligible = DomainOccasions.occasionMilestoneEligible;
export const nextOccasionMilestones = DomainOccasions.nextOccasionMilestones;
export const describeOccasionMilestone = DomainOccasions.describeOccasionMilestone;
export const elapsedSpanSince = DomainOccasions.elapsedSpanSince;
export const describeElapsedSpan = DomainOccasions.describeElapsedSpan;
export const occasionCycleProgress = DomainOccasions.occasionCycleProgress;
export const normalizeOccasionTime = DomainOccasions.normalizeOccasionTime;
export const normalizeOccasionPriority = DomainOccasions.normalizeOccasionPriority;
export const normalizeOccasionCategory = DomainOccasions.normalizeOccasionCategory;
export const inferOccasionCategory = DomainOccasions.inferOccasionCategory;
export const resolveOccasionCategory = DomainOccasions.resolveOccasionCategory;
export const occasionCategoryIcon = DomainOccasions.occasionCategoryIcon;
export const occasionCategoryLabelKey = DomainOccasions.occasionCategoryLabelKey;
export const cleanOccasionBlockRef = DomainOccasions.cleanOccasionBlockRef;
export const validateOccasionBlockRef = DomainOccasions.validateOccasionBlockRef;
export const parseQuickOccasionInput = DomainOccasions.parseQuickOccasionInput;
export const formatQuickOccasionPreview = DomainOccasions.formatQuickOccasionPreview;
export const OCCASION_TEMPLATES = DomainOccasions.OCCASION_TEMPLATES;
export const OCCASIONS_STORAGE_NAME = DomainOccasions.OCCASIONS_STORAGE_NAME;
export const OCCASIONS_STORE_VERSION = DomainOccasions.OCCASIONS_STORE_VERSION;
export const OCCASION_MILESTONE_LADDER = DomainOccasions.OCCASION_MILESTONE_LADDER;
export const weekdayName = DomainOccasions.weekdayName;
export const occasionTemplateName = DomainOccasions.occasionTemplateName;
export const applyOccasionTemplate = DomainOccasions.applyOccasionTemplate;
