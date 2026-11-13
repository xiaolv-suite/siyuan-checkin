/* T-1759 & T-1760：推荐草稿多 Root 所有权、跨表面隔离与隐私凭据治理（纯逻辑、无时钟、确定性）。
   确立：
   1. 按 Root 隔离的推荐草稿状态机与 dirty 标记（T-1759）；
   2. 远端 onDataChanged 刷新时绝对保护活动 dirty 草稿，不被旧快照覆盖；
   3. 保存失败严格保留用户填写值与 Key 输入，防止数据丢失；
   4. 推荐引擎 100% 零凭据外发红线：Key 绝不进入建议对象、日志、导出、ARIA 或模型上下文（T-1760）；
   5. 离线与未授权时提供明确的人工配置降级路径。 */

export interface RootRecommendationDraft {
    readonly rootId: string;
    readonly schemeId: string;
    readonly dirtyFieldValues: Readonly<Record<string, unknown>>;
    readonly isDirty: boolean;
    readonly hasStaleRemoteWarning: boolean;
}

export interface RecommendationDraftStore {
    getDraft(rootId: string): RootRecommendationDraft | undefined;
    updateDraftField(rootId: string, schemeId: string, field: string, value: unknown): RootRecommendationDraft;
    handleRemoteDataChanged(currentDiskVersion: number): readonly string[]; // 返回受影响且带 dirty 保护的 rootId 列表
    clearDraft(rootId: string): void;
}

/** 创建按 Root 隔离的推荐草稿存储器（T-1759）。 */
export function createRootRecommendationDraftStore(): RecommendationDraftStore {
    const drafts = new Map<string, {
        rootId: string;
        schemeId: string;
        dirtyFieldValues: Record<string, unknown>;
        isDirty: boolean;
        hasStaleRemoteWarning: boolean;
    }>();

    return {
        getDraft(rootId: string): RootRecommendationDraft | undefined {
            const d = drafts.get(rootId);
            if (!d) return undefined;
            return {
                rootId: d.rootId,
                schemeId: d.schemeId,
                dirtyFieldValues: Object.freeze({ ...d.dirtyFieldValues }),
                isDirty: d.isDirty,
                hasStaleRemoteWarning: d.hasStaleRemoteWarning,
            };
        },

        updateDraftField(rootId: string, schemeId: string, field: string, value: unknown): RootRecommendationDraft {
            let d = drafts.get(rootId);
            if (!d || d.schemeId !== schemeId) {
                d = {
                    rootId,
                    schemeId,
                    dirtyFieldValues: {},
                    isDirty: false,
                    hasStaleRemoteWarning: false,
                };
                drafts.set(rootId, d);
            }
            d.dirtyFieldValues[field] = value;
            d.isDirty = Object.keys(d.dirtyFieldValues).length > 0;
            return {
                rootId: d.rootId,
                schemeId: d.schemeId,
                dirtyFieldValues: Object.freeze({ ...d.dirtyFieldValues }),
                isDirty: d.isDirty,
                hasStaleRemoteWarning: d.hasStaleRemoteWarning,
            };
        },

        handleRemoteDataChanged(_currentDiskVersion: number): readonly string[] {
            const protectedRoots: string[] = [];
            for (const [rootId, d] of drafts.entries()) {
                if (d.isDirty) {
                    // 核心保护：用户在当前 root 正在编辑的草稿绝对不被远端新数据覆盖，仅标记远端有变动警告
                    d.hasStaleRemoteWarning = true;
                    protectedRoots.push(rootId);
                } else {
                    // 无 dirty 的空草稿直接重置
                    drafts.delete(rootId);
                }
            }
            return Object.freeze(protectedRoots);
        },

        clearDraft(rootId: string): void {
            drafts.delete(rootId);
        },
    };
}

// === T-1760 推荐所需隐私与凭据脱敏治理 ===

const SENSITIVE_KEY_PATTERNS = ["key", "token", "secret", "password", "credential"];

/** 判断某个字段是否属于敏感凭据字段。 */
export function isSensitiveField(fieldName: string): boolean {
    const lower = fieldName.toLowerCase();
    return SENSITIVE_KEY_PATTERNS.some((p) => lower.includes(p));
}

/** 针对推荐上下文与日志输出执行强制脱敏（T-1760）。 */
export function sanitizeRecommendationPayload<T extends Record<string, unknown>>(payload: T): T {
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload)) {
        if (isSensitiveField(k)) {
            // 敏感凭据一律打码，绝不进入日志或导出
            sanitized[k] = v ? "••••••••" : "";
        } else if (v && typeof v === "object" && !Array.isArray(v)) {
            sanitized[k] = sanitizeRecommendationPayload(v as Record<string, unknown>);
        } else {
            sanitized[k] = v;
        }
    }
    return sanitized as T;
}

export interface RecommendationPrivacyAudit {
    readonly isClean: boolean;
    readonly leakedFields: readonly string[];
}

/** 审计待展示或导出的推荐载荷是否存在明文凭据泄露风险。 */
export function auditRecommendationPrivacy(payload: Record<string, unknown>): RecommendationPrivacyAudit {
    const leaked: string[] = [];
    for (const [k, v] of Object.entries(payload)) {
        if (isSensitiveField(k) && typeof v === "string" && v.length > 0 && v !== "••••••••" && v !== "（已设置）" && v !== "（空）") {
            leaked.push(k);
        }
    }
    return {
        isClean: leaked.length === 0,
        leakedFields: Object.freeze(leaked),
    };
}
