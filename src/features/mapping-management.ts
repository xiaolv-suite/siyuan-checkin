/* T-1660 大规模映射、失效保留与批量校验模型
   纪律：纯函数、零隐式时钟、无外部副作用。
   核心职责：
   1. 大规模项目集（>200 项）与映射集（≥50 条）的搜索与有界分页；
   2. 目标失效（已删除/已归档/单位变更）时保留旧身份，给出明确停用/换绑建议，严禁静默删除；
   3. 批量多维度校验（重复来源名称、缺失目标、单位不兼容、字段不完整）；
   4. 映射迁移与变更规划预览。 */

export interface MappingTargetDescriptor {
    id: string;
    name: string;
    unit?: string;
    archived?: boolean;
    available?: boolean;
}

export type MappingIssueType =
    | "incomplete"
    | "duplicate-project"
    | "missing-target"
    | "archived-target"
    | "unit-mismatch";

export interface MappingValidationRowResult {
    project: string;
    itemId: string;
    valid: boolean;
    issue?: MappingIssueType;
    recommendedAction: "none" | "rebind" | "disable" | "fill";
}

export interface BatchMappingValidationSummary {
    total: number;
    validCount: number;
    invalidCount: number;
    issues: Record<MappingIssueType, number>;
    rows: MappingValidationRowResult[];
}

export interface PaginatedTargetsResult {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    items: MappingTargetDescriptor[];
}

/** 对大规模目标项目集进行实时搜索、过滤与有界分页。 */
export function filterAndPaginateTargets(
    targets: readonly MappingTargetDescriptor[],
    query: string,
    page = 0,
    pageSize = 50,
): PaginatedTargetsResult {
    const trimmedQuery = (query || "").trim().toLocaleLowerCase();
    const filtered = trimmedQuery
        ? targets.filter((target) => {
            const nameMatch = target.name.toLocaleLowerCase().includes(trimmedQuery);
            const idMatch = target.id.toLocaleLowerCase().includes(trimmedQuery);
            return nameMatch || idMatch;
        })
        : [...targets];

    const safePageSize = Math.max(1, Math.min(200, pageSize));
    const totalPages = Math.max(1, Math.ceil(filtered.length / safePageSize));
    const safePage = Math.max(0, Math.min(page, totalPages - 1));
    const start = safePage * safePageSize;
    const items = filtered.slice(start, start + safePageSize);

    return {
        total: filtered.length,
        page: safePage,
        pageSize: safePageSize,
        totalPages,
        items,
    };
}

/** 批量校验映射条目：识别重复名称、已归档项目、缺失项目与单位不匹配。保留旧身份并给出修复动作。 */
export function validateMappingsBatch(
    mappings: readonly {project: string; itemId: string}[],
    targets: readonly MappingTargetDescriptor[],
    expectedUnit = "分钟",
): BatchMappingValidationSummary {
    const targetMap = new Map(targets.map((t) => [t.id, t]));
    const seenProjects = new Map<string, number>();

    // 统计来源项目名称频次
    for (const m of mappings) {
        const norm = (m.project || "").trim().toLocaleLowerCase();
        if (norm) {
            seenProjects.set(norm, (seenProjects.get(norm) || 0) + 1);
        }
    }

    const issues: Record<MappingIssueType, number> = {
        incomplete: 0,
        "duplicate-project": 0,
        "missing-target": 0,
        "archived-target": 0,
        "unit-mismatch": 0,
    };

    const rows: MappingValidationRowResult[] = mappings.map((m) => {
        const project = (m.project || "").trim();
        const itemId = (m.itemId || "").trim();

        if (!project || !itemId) {
            issues.incomplete += 1;
            return {
                project,
                itemId,
                valid: false,
                issue: "incomplete",
                recommendedAction: "fill",
            };
        }

        const projectKey = project.toLocaleLowerCase();
        if ((seenProjects.get(projectKey) || 0) > 1) {
            issues["duplicate-project"] += 1;
            return {
                project,
                itemId,
                valid: false,
                issue: "duplicate-project",
                recommendedAction: "rebind",
            };
        }

        const target = targetMap.get(itemId);
        if (!target) {
            issues["missing-target"] += 1;
            return {
                project,
                itemId,
                valid: false,
                issue: "missing-target",
                recommendedAction: "rebind",
            };
        }

        if (target.archived) {
            issues["archived-target"] += 1;
            return {
                project,
                itemId,
                valid: false,
                issue: "archived-target",
                recommendedAction: "rebind",
            };
        }

        if (expectedUnit && target.unit && target.unit !== expectedUnit) {
            issues["unit-mismatch"] += 1;
            return {
                project,
                itemId,
                valid: false,
                issue: "unit-mismatch",
                recommendedAction: "rebind",
            };
        }

        return {
            project,
            itemId,
            valid: true,
            recommendedAction: "none",
        };
    });

    const invalidCount = rows.filter((r) => !r.valid).length;

    return {
        total: mappings.length,
        validCount: mappings.length - invalidCount,
        invalidCount,
        issues,
        rows,
    };
}

export interface MappingMigrationPlan {
    added: Array<{project: string; itemId: string}>;
    removed: Array<{project: string; itemId: string}>;
    rebound: Array<{project: string; oldItemId: string; newItemId: string}>;
    unchangedCount: number;
}

/** 对比新旧映射，生成迁移预览规划（无副作用纯函数）。 */
export function planMappingMigration(
    baselineMappings: readonly {project: string; itemId: string}[],
    currentMappings: readonly {project: string; itemId: string}[],
): MappingMigrationPlan {
    const baseMap = new Map(baselineMappings.map((m) => [m.project.trim().toLocaleLowerCase(), m.itemId.trim()]));
    const currMap = new Map(currentMappings.map((m) => [m.project.trim().toLocaleLowerCase(), m.itemId.trim()]));

    const added: MappingMigrationPlan["added"] = [];
    const removed: MappingMigrationPlan["removed"] = [];
    const rebound: MappingMigrationPlan["rebound"] = [];
    let unchangedCount = 0;

    for (const [projectKey, newItemId] of currMap) {
        const oldItemId = baseMap.get(projectKey);
        const originalProject = currentMappings.find((m) => m.project.trim().toLocaleLowerCase() === projectKey)?.project || projectKey;
        if (!oldItemId) {
            added.push({project: originalProject, itemId: newItemId});
        } else if (oldItemId !== newItemId) {
            rebound.push({project: originalProject, oldItemId, newItemId});
        } else {
            unchangedCount += 1;
        }
    }

    for (const [projectKey, oldItemId] of baseMap) {
        if (!currMap.has(projectKey)) {
            const originalProject = baselineMappings.find((m) => m.project.trim().toLocaleLowerCase() === projectKey)?.project || projectKey;
            removed.push({project: originalProject, itemId: oldItemId});
        }
    }

    return {
        added,
        removed,
        rebound,
        unchangedCount,
    };
}
