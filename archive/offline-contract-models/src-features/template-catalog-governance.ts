/* T-1679：循证模板目录治理与重复/本地化身份纯模型（研究与规则收敛）。
   定义稳定 slug 派生、单位与同义目标判重、方法论来源元数据及目录容量约束，
   无隐式时钟，受 CLOCK_FREE_MODULES 保护。 */

export const TEMPLATE_CATALOG_MAX_BUILTINS = 120;

/** 常用计量单位同义映射表（中英与常用缩写对齐）。 */
const UNIT_SYNONYM_MAP: Readonly<Record<string, string>> = {
    "ml": "毫升",
    "毫升": "毫升",
    "l": "升",
    "升": "升",
    "min": "分钟",
    "mins": "分钟",
    "minute": "分钟",
    "minutes": "分钟",
    "分钟": "分钟",
    "hour": "小时",
    "hours": "小时",
    "hr": "小时",
    "hrs": "小时",
    "小时": "小时",
    "time": "次",
    "times": "次",
    "次": "次",
    "遍": "次",
    "回": "次",
    "step": "步",
    "steps": "步",
    "步": "步",
    "kg": "千克",
    "公斤": "千克",
    "千克": "千克",
    "页": "页",
    "page": "页",
    "pages": "页",
    "个": "个",
    "item": "个",
    "items": "个",
};

/** T-1679：单位规范化——将中英缩写/别名收敛至标准度量单位。 */
export function normalizeUnit(unit: string | undefined): string {
    if (!unit || typeof unit !== "string") return "次";
    const trimmed = unit.trim().toLowerCase();
    return UNIT_SYNONYM_MAP[trimmed] || unit.trim();
}

/** T-1679：稳定模板 Slug 派生——基于标识符或英文键生成稳定 kebab-case slug。 */
export function deriveTemplateSlug(name: string): string {
    if (!name || typeof name !== "string") return "custom-template";
    const trimmed = name.trim();
    // 英文/字母数字直接 kebab
    if (/^[A-Za-z0-9\s_-]+$/.test(trimmed)) {
        return trimmed.toLowerCase().replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, "");
    }
    // 中文模板已知标准 Slug 映射表
    const KNOWN_SLUGS: Record<string, string> = {
        "喝水": "water",
        "早睡早起": "early-rise",
        "睡眠时长": "sleep-duration",
        "运动": "workout",
        "步数": "steps",
        "体重": "weight",
        "拉伸": "stretch",
        "阅读": "reading",
        "背单词": "vocabulary",
        "写日记": "journal",
        "问卷日记": "survey-journal",
        "在线课程": "online-course",
        "深度工作": "deep-work",
        "整理收件箱": "inbox-zero",
        "每日计划": "daily-plan",
        "任务打卡": "task-checkin",
        "番茄钟": "pomodoro",
        "整理房间": "tidy-room",
        "做饭": "cooking",
        "记账": "expense-log",
        "植物浇水": "water-plant",
        "练习乐器": "music-practice",
        "绘画练习": "sketching",
        "拍照记录": "photo-log",
        "冥想": "meditation",
        "情绪记录": "mood-log",
        "每日反思": "daily-reflection",
        "周复盘": "weekly-review",
        "晨间补水": "morning-water",
        "维生素": "vitamins",
        "戒烟": "quit-smoking",
        "戒奶茶": "quit-milk-tea",
        "读一页书": "read-one-page",
        "按时服药": "take-medicine",
        "定时起身": "stand-up-regularly",
        "联系亲友": "connect-friends",
        "分散复习": "spaced-review",
        "思阅精读": "sireader-deep-read",
        "思播精听": "siplayer-listen",
        "闪卡复习": "flashcards-review",
        "考证刷题": "exam-practice",
        "拾遗精读": "glean-read",
    };
    return KNOWN_SLUGS[trimmed] || `tpl-${encodeURIComponent(trimmed).toLowerCase().replace(/%/g, "")}`;
}

/** T-1679：循证生活与行为习惯方法论来源元数据。 */
const METHODOLOGY_PROVENANCE: Readonly<Record<string, string>> = {
    "读一页书": "《掌控习惯》两分钟定律（Two-Minute Rule）",
    "定时起身": "《HowToLiveBetter 循证指南》久坐中断代谢保护",
    "分散复习": "艾宾浩斯遗忘曲线与间隔重复（Spaced Repetition）",
    "晨间补水": "生理节律代谢激活（Circadian Hydration）",
    "番茄钟": "弗朗西斯科·西里洛番茄工作法（Pomodoro Technique）",
    "深度工作": "卡尔·纽波特《深度工作》专注心流理论",
    "每日反思": "吉布斯反思循环（Gibbs' Reflective Cycle）",
    "联系亲友": "哈佛成人发展研究（长期幸福感关系预测模型）",
    "整理收件箱": "戴维·艾伦 GTD 收件箱清零原则（Inbox Zero）",
};

export function resolveTemplateProvenance(name: string): string | undefined {
    return METHODOLOGY_PROVENANCE[name];
}

/** T-1679：同义目标与重复判定规则。
    当两模板名称相同、或别名命中、或 Slug 与规范单位一致时视为同义项目。 */
export function areTemplatesSynonymous(
    a: {name: string; unit: string; kind?: string},
    b: {name: string; unit: string; kind?: string},
): boolean {
    if (a.name.trim() === b.name.trim()) return true;
    const slugA = deriveTemplateSlug(a.name);
    const slugB = deriveTemplateSlug(b.name);
    if (slugA === slugB && slugA !== "custom-template") {
        const unitA = normalizeUnit(a.unit);
        const unitB = normalizeUnit(b.unit);
        if (unitA === unitB) return true;
    }
    return false;
}

export interface TemplateCatalogAudit {
    total: number;
    hasOverCapacity: boolean;
    slugCollisions: Array<{slug: string; names: string[]}>;
    duplicateTemplates: Array<{nameA: string; nameB: string}>;
}

/** T-1679：模板目录健康度与防冲突审计。 */
export function auditTemplateCatalog(
    templates: readonly {name: string; unit: string; group?: string}[],
): TemplateCatalogAudit {
    const slugMap = new Map<string, string[]>();
    const duplicateTemplates: Array<{nameA: string; nameB: string}> = [];

    for (let i = 0; i < templates.length; i += 1) {
        const item = templates[i];
        const slug = deriveTemplateSlug(item.name);
        const existing = slugMap.get(slug) || [];
        existing.push(item.name);
        slugMap.set(slug, existing);

        for (let j = i + 1; j < templates.length; j += 1) {
            const other = templates[j];
            if (areTemplatesSynonymous(item, other)) {
                duplicateTemplates.push({nameA: item.name, nameB: other.name});
            }
        }
    }

    const slugCollisions = [...slugMap.entries()]
        .filter(([, names]) => names.length > 1)
        .map(([slug, names]) => ({slug, names}));

    return {
        total: templates.length,
        hasOverCapacity: templates.length > TEMPLATE_CATALOG_MAX_BUILTINS,
        slugCollisions,
        duplicateTemplates,
    };
}
