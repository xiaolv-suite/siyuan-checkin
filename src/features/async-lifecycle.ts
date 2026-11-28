/* T-1664 跨表面异步生命周期、代际与销毁清理审计模型
   纪律：纯函数与纯状态管理、零隐式时钟、无外部副作用。
   职责：
   1. 统一登记并追踪搜索、防抖、来源摄取、总结、渲染块、观察器等跨表面资源；
   2. 统一 owner（plugin / rootId / modal）分级归属，root 销毁或切页时靶向释放；
   3. 统一 generation 代际自增与过期快速失效断言，杜绝迟到回执覆盖新 DOM；
   4. onunload 全量释放审计，排查未释放的 timer/listener/observer。 */

export type AsyncResourceType = "timer" | "raf" | "listener" | "observer" | "generation";

export interface AsyncResourceEntry {
    owner: string;
    key: string;
    type: AsyncResourceType;
    generation: number;
    disposed: boolean;
    registeredAt: number;
    dispose: () => void;
}

export interface AsyncResourceSummary {
    owner: string;
    key: string;
    type: AsyncResourceType;
    generation: number;
    registeredAt: number;
}

export interface AsyncLeakAuditResult {
    leakCount: number;
    activeOwners: string[];
    resources: AsyncResourceSummary[];
}

export class AsyncLifecycleManager {
    private readonly resources = new Map<string, AsyncResourceEntry>();
    private readonly generations = new Map<string, number>();

    private makeCompositeKey(owner: string, key: string): string {
        return `${owner}::${key}`;
    }

    /** 获取指定所有者和键的当前代际（默认 0）。 */
    getGeneration(owner: string, key: string): number {
        return this.generations.get(this.makeCompositeKey(owner, key)) ?? 0;
    }

    /** 自增并推进代际，返回最新代际编号。任何持有旧编号的慢回执将自动失效。 */
    advanceGeneration(owner: string, key: string): number {
        const compositeKey = this.makeCompositeKey(owner, key);
        const current = this.generations.get(compositeKey) ?? 0;
        const next = current + 1;
        this.generations.set(compositeKey, next);
        return next;
    }

    /** 检查指定慢回执携带的代际是否依然是当前有效代际。 */
    isCurrent(owner: string, key: string, candidateGen: number): boolean {
        return this.getGeneration(owner, key) === candidateGen;
    }

    /** 登记一个受管异步资源（timer/listener/observer 等），返回可执行的撤销函数。 */
    trackResource(
        owner: string,
        key: string,
        type: AsyncResourceType,
        disposer: () => void,
        nowMs = 0,
    ): () => void {
        const compositeKey = this.makeCompositeKey(owner, key);
        // 若先前存在同 owner、同 key 的未释放资源，先处置并注销它
        this.disposeByKey(owner, key);

        const generation = this.getGeneration(owner, key);
        const entry: AsyncResourceEntry = {
            owner,
            key,
            type,
            generation,
            disposed: false,
            registeredAt: nowMs,
            dispose: () => {
                if (!entry.disposed) {
                    entry.disposed = true;
                    try { disposer(); } catch { /* 忽略清理错误 */ }
                    this.resources.delete(compositeKey);
                }
            },
        };
        this.resources.set(compositeKey, entry);
        return () => entry.dispose();
    }

    /** 释放指定 owner + key 的单个受管资源。 */
    disposeByKey(owner: string, key: string): boolean {
        const compositeKey = this.makeCompositeKey(owner, key);
        const existing = this.resources.get(compositeKey);
        if (existing && !existing.disposed) {
            existing.dispose();
            return true;
        }
        return false;
    }

    /** 释放指定 owner 下的所有受管资源并推进其所有代际（例如 root destroy 或 modal 关闭）。 */
    disposeByOwner(owner: string): number {
        let count = 0;
        for (const [compositeKey, entry] of [...this.resources.entries()]) {
            if (entry.owner === owner && !entry.disposed) {
                entry.dispose();
                count += 1;
            }
        }
        for (const compositeKey of this.generations.keys()) {
            if (compositeKey.startsWith(`${owner}::`)) {
                const current = this.generations.get(compositeKey) ?? 0;
                this.generations.set(compositeKey, current + 1);
            }
        }
        return count;
    }

    /** 释放全量所有受管资源并推进所有代际（用于 onunload 拆除收尾）。 */
    disposeAll(): number {
        let count = 0;
        for (const entry of [...this.resources.values()]) {
            if (!entry.disposed) {
                entry.dispose();
                count += 1;
            }
        }
        for (const [key, gen] of [...this.generations.entries()]) {
            this.generations.set(key, gen + 1);
        }
        this.resources.clear();
        return count;
    }

    /** 获取当前活跃未释放资源的快照。 */
    getActiveResources(targetOwner?: string): AsyncResourceSummary[] {
        const summaries: AsyncResourceSummary[] = [];
        for (const entry of this.resources.values()) {
            if (entry.disposed) continue;
            if (targetOwner !== undefined && entry.owner !== targetOwner) continue;
            summaries.push({
                owner: entry.owner,
                key: entry.key,
                type: entry.type,
                generation: entry.generation,
                registeredAt: entry.registeredAt,
            });
        }
        return summaries;
    }

    /** 执行资源泄漏审计，返回未释放资源数量与明细。 */
    auditResourceLeaks(): AsyncLeakAuditResult {
        const active = this.getActiveResources();
        const activeOwners = [...new Set(active.map((res) => res.owner))];
        return {
            leakCount: active.length,
            activeOwners,
            resources: active,
        };
    }
}
