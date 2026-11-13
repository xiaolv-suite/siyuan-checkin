/**
 * 全生态统一定时器收敛储备 (LvTicker Client Protocol)
 *
 * 目标：将插件内部散落的后台轮询定时器（微信读书、思播、健康箱、笔记块查询、叶归 LifeLog、提醒槽位、午夜边界）
 * 统一解耦为标准化轮询任务声明 (LvPollingTask)，为接入全局去中心化 Ticker 协调器打好架构基础。
 *
 * 核心契约：
 * 1. 宿主协同：检测 window.__LV_TICKER__ 与 lvTicker；挂载至生态全局 Ticker，由统一步频调度，降低 CPU 唤醒与能耗；
 * 2. 优雅降级：若全局 Ticker 尚未就绪，安全回退至本地 window.setInterval 并由注册表集中管理，杜绝孤儿定时器；
 * 3. 严格安全：捕获 tick 执行异常，杜绝任何外部轮询错误打断主线程；Node/测试环境无 window 时安全空跑；
 * 4. 兼容既有：保持与既有定时器句柄和生命周期的 100% 互操作性。
 */

import {lvTicker} from "./lv-notice-kit";

export interface LvPollingTask {
    /** 任务唯一标识符（如 "health-inbox"、"weread"、"siplayer"） */
    id: string;
    /** 人类可读名称 */
    name: string;
    /** 预期轮询间隔（毫秒） */
    intervalMs: number;
    /** 周期回调函数 */
    tick: () => void | Promise<void>;
    /** 是否在注册后立即执行一次（可选） */
    immediate?: boolean;
}

export interface RegisteredPollerEntry {
    task: LvPollingTask;
    localTimer?: number;
    globalUnregister?: () => void;
}

export class LvPollerRegistry {
    private entries = new Map<string, RegisteredPollerEntry>();
    private pluginName: string;

    constructor(pluginName = "siyuan-checkin") {
        this.pluginName = pluginName;
    }

    /**
     * 注册一个后台轮询任务
     * @returns 若使用本地定时器，返回 localTimer id；若由全局 Ticker 接管，返回 undefined
     */
    register(task: LvPollingTask): number | undefined {
        this.stop(task.id);

        let localTimer: number | undefined;
        let globalUnregister: (() => void) | undefined;

        try {
            globalUnregister = lvTicker.subscribe(this.pluginName, task.intervalMs, () => {
                try {
                    void task.tick();
                } catch {
                    // 防御式捕获，杜绝异常向上冒泡
                }
            });
        } catch {
            globalUnregister = undefined;
        }

        if (!globalUnregister && typeof window !== "undefined" && typeof window.setInterval === "function") {
            localTimer = window.setInterval(() => {
                try {
                    void task.tick();
                } catch {
                    // 防御式捕获，杜绝异常向上冒泡
                }
            }, task.intervalMs);
        }

        if (task.immediate) {
            try {
                void task.tick();
            } catch {
                // 忽略立即执行异常
            }
        }

        this.entries.set(task.id, {
            task,
            localTimer,
            globalUnregister,
        });

        return localTimer;
    }

    /**
     * 停止指定轮询任务
     */
    stop(taskId: string): void {
        const entry = this.entries.get(taskId);
        if (!entry) return;

        if (entry.globalUnregister) {
            try {
                entry.globalUnregister();
            } catch {
                // ignore
            }
        }

        if (entry.localTimer !== undefined && typeof window !== "undefined") {
            window.clearInterval(entry.localTimer);
        }

        this.entries.delete(taskId);
    }

    /**
     * 停止全部已注册任务
     */
    stopAll(): void {
        for (const taskId of Array.from(this.entries.keys())) {
            this.stop(taskId);
        }
    }

    /**
     * 判断某个任务是否正在运行
     */
    isRunning(taskId: string): boolean {
        return this.entries.has(taskId);
    }

    /**
     * 列出所有登记任务的快照（用于诊断与审查）
     */
    listTasks(): Array<Pick<LvPollingTask, "id" | "name" | "intervalMs"> & { mode: "global" | "local" | "idle" }> {
        return Array.from(this.entries.values()).map((entry) => ({
            id: entry.task.id,
            name: entry.task.name,
            intervalMs: entry.task.intervalMs,
            mode: entry.globalUnregister ? "global" : (entry.localTimer !== undefined ? "local" : "idle"),
        }));
    }
}

export function createPollerRegistry(pluginName = "siyuan-checkin"): LvPollerRegistry {
    return new LvPollerRegistry(pluginName);
}
