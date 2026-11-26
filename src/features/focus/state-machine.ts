import type {FocusDurabilityPolicy, FocusOwner, FocusSessionState} from "./types";
import {DEFAULT_FOCUS_DURABILITY_POLICY} from "./types";

/**
 * S3 (Topic#7): 番茄钟专注生命周期状态机
 * 集中收拢并守护专注生命周期核心不变性：
 * 1. 外部可用性抖动不自杀 (可用性短暂 false -> true 时保留 ownedFocus)
 * 2. 跨 Facade 热重连 (重载后比对 sessionId 无感续链)
 * 3. 根断链与多 Root 销毁转移 (弹窗关闭后自愈至活跃表面)
 * 4. 记账幂等 (同一 sessionId 1 次且仅 1 次记账)
 */
export class FocusSessionStateMachine {
    private currentOwner?: FocusOwner;
    private state: FocusSessionState = {active: false, running: false, paused: false};
    private readonly completedSessions = new Set<string>();
    private readonly policy: FocusDurabilityPolicy;

    constructor(policy: FocusDurabilityPolicy = DEFAULT_FOCUS_DURABILITY_POLICY) {
        this.policy = policy;
    }

    public getOwner(): FocusOwner | undefined {
        return this.currentOwner;
    }

    public getState(): Readonly<FocusSessionState> {
        return this.state;
    }

    public isActive(): boolean {
        return this.state.active && Boolean(this.currentOwner);
    }

    public isRunning(): boolean {
        return this.state.running && Boolean(this.currentOwner);
    }

    public startSession(owner: FocusOwner, options?: {mode?: "countdown" | "countup" | "stopwatch"; targetMinutes?: number}): void {
        this.currentOwner = {
            ...owner,
            startedAt: owner.startedAt || new Date().toISOString(),
        };
        this.state = {
            active: true,
            running: true,
            paused: false,
            sessionId: owner.sessionId,
            itemId: owner.itemId,
            mode: options?.mode || "countdown",
            targetDurationMinutes: options?.targetMinutes,
            elapsedSeconds: 0,
        };
    }

    /**
     * Topic#7 核心防护：解绑时若声明 preserve 或处于抖动保护期，保留归属供重连，严禁自杀清空
     */
    public unbind(options?: {preserveOwnedFocus?: boolean}): void {
        if (!options?.preserveOwnedFocus) {
            this.currentOwner = undefined;
            this.state = {active: false, running: false, paused: false};
        }
    }

    /**
     * 判定当前活跃会话是否能在新提供方出现时无感续接
     */
    public canRetainSession(providerActive: boolean, incomingSessionId?: string): boolean {
        if (!this.currentOwner || !this.policy.preserveOnReload) return false;
        if (!providerActive) return false;
        if (!incomingSessionId || incomingSessionId === this.currentOwner.sessionId) {
            return true;
        }
        return false;
    }

    /**
     * 重新绑定至新提供方 Facade
     */
    public rebind(newProvider: unknown, incomingSessionId?: string): void {
        if (!this.currentOwner) return;
        this.currentOwner = {
            provider: newProvider,
            sessionId: incomingSessionId || this.currentOwner.sessionId,
            itemId: this.currentOwner.itemId,
            startedAt: this.currentOwner.startedAt,
        };
        this.state = {
            ...this.state,
            active: true,
            running: true,
            paused: false,
            sessionId: this.currentOwner.sessionId,
        };
    }

    public pause(): void {
        if (!this.currentOwner) return;
        this.state = {
            ...this.state,
            running: false,
            paused: true,
        };
    }

    public resume(): void {
        if (!this.currentOwner) return;
        this.state = {
            ...this.state,
            running: true,
            paused: false,
        };
    }

    public stop(): void {
        this.currentOwner = undefined;
        this.state = {active: false, running: false, paused: false};
    }

    /**
     * 幂等记账守卫：1 次且仅 1 次入账
     * 返回 true 表示该会话首次完成入账；返回 false 表示已入账过，坚决拦截重复记账。
     */
    public recordCompletionOnce(sessionId: string): boolean {
        if (!sessionId) return false;
        if (this.completedSessions.has(sessionId)) {
            return false;
        }
        this.completedSessions.add(sessionId);
        // 保留最近 500 个会话防内存无限增长
        if (this.completedSessions.size > 500) {
            const oldest = this.completedSessions.values().next().value;
            if (oldest) this.completedSessions.delete(oldest);
        }
        return true;
    }

    public hasCompleted(sessionId: string): boolean {
        return this.completedSessions.has(sessionId);
    }

    /**
     * 多 Root 表面自愈解析器：
     * 当当前 focusTimerRoot 断开连接 (isConnected === false) 时，
     * 自动在候选表面（Tab > Dock > Dialog > ActiveRoot）中回退至首个处于连接状态的有效表面。
     */
    public static resolveConnectedSurface<T extends {isConnected?: boolean}>(
        currentRoot: T | undefined,
        candidates: Array<T | undefined | null>
    ): T | undefined {
        if (currentRoot && currentRoot.isConnected !== false) {
            return currentRoot;
        }
        for (const candidate of candidates) {
            if (candidate && candidate.isConnected !== false) {
                return candidate;
            }
        }
        return undefined;
    }
}
