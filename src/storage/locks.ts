export const STORAGE_LOCK_NAME = "siyuan-checkin-store-write";

export interface LockManagerLike {
    request<T>(name: string, options: {mode: "exclusive"; signal?: AbortSignal}, callback: (lock?: unknown) => T | PromiseLike<T>): Promise<T>;
    /** ifAvailable 时拿不到锁会立刻 resolve(undefined)，用于拆除期不排队等待。 */
    request<T>(name: string, options: {mode: "exclusive"; ifAvailable?: boolean; signal?: AbortSignal}, callback: (lock?: unknown) => T | PromiseLike<T>): Promise<T | undefined>;
}

export type DocLockFn = <T>(docId: string, operation: () => Promise<T>) => Promise<T>;
export type SyncRetryFn = <T>(operation: () => Promise<T>) => Promise<T>;
export type SyncLockErrorCheckFn = (error: unknown) => boolean;

let registeredDocLock: DocLockFn = (_docId, op) => op();
let registeredSyncRetry: SyncRetryFn = (op) => op();
let registeredSyncLockErrorCheck: SyncLockErrorCheckFn = () => false;

export function registerLockAdapters(adapters: {
    docLock?: DocLockFn;
    syncRetry?: SyncRetryFn;
    isSyncLockError?: SyncLockErrorCheckFn;
}): void {
    if (adapters.docLock) registeredDocLock = adapters.docLock;
    if (adapters.syncRetry) registeredSyncRetry = adapters.syncRetry;
    if (adapters.isSyncLockError) registeredSyncLockErrorCheck = adapters.isSyncLockError;
}

let fallbackStorageQueue: Promise<void> = Promise.resolve();

function getNavigatorLocks(): LockManagerLike | undefined {
    const nav = typeof globalThis !== "undefined" ? (globalThis as unknown as {navigator?: {locks?: LockManagerLike}})["navigator"] : undefined;
    return nav ? nav["locks"] : undefined;
}

/**
 * S2: 跨窗口统一排他存储锁实现
 * 优先使用 Web Lock API (navigator.locks)，并在环境不支持时自动降级至本地有序 Promise 队列。
 * 锁内业务异常严格原样抛出且绝不重跑；获取锁超时（AbortError）明确按超时错误处理，绝不脱锁并发写盘。
 */
export function withStorageLock<T>(operation: () => Promise<T>, timeoutMs = 4000): Promise<T> {
    const locks = getNavigatorLocks();
    if (locks && typeof locks.request === "function") {
        const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timer = ctrl
            ? (globalThis as unknown as {setTimeout: (cb: () => void, ms: number) => unknown})["setTimeout"](() => ctrl.abort(), timeoutMs)
            : null;
        let operationInvoked = false;
        try {
            return locks.request<T>(
                STORAGE_LOCK_NAME,
                {mode: "exclusive", ...(ctrl ? {signal: ctrl.signal} : {})},
                () => {
                    operationInvoked = true;
                    return operation();
                }
            )
                .catch((err: unknown) => {
                    const isAbort = (err as {name?: string})?.name === "AbortError" || Boolean(ctrl?.signal?.aborted);
                    if (operationInvoked || isAbort) {
                        throw err;
                    }
                    const run = fallbackStorageQueue.then(operation, operation);
                    fallbackStorageQueue = run.then(() => undefined, () => undefined);
                    return run;
                })
                .finally(() => {
                    if (timer) {
                        (globalThis as unknown as {clearTimeout: (id: unknown) => void})["clearTimeout"](timer);
                    }
                });
        } catch (err: unknown) {
            if (timer) {
                (globalThis as unknown as {clearTimeout: (id: unknown) => void})["clearTimeout"](timer);
            }
            const isAbort = (err as {name?: string})?.name === "AbortError" || Boolean(ctrl?.signal?.aborted);
            if (operationInvoked || isAbort) {
                return Promise.reject(err);
            }
            const run = fallbackStorageQueue.then(operation, operation);
            fallbackStorageQueue = run.then(() => undefined, () => undefined);
            return run;
        }
    }
    const run = fallbackStorageQueue.then(operation, operation);
    fallbackStorageQueue = run.then(() => undefined, () => undefined);
    return run;
}

/**
 * S2: 拆除期锁争用探测 (ifAvailable)
 * 必须检查 ifAvailable 模式下回调的 lock 参数：若未拿到锁（!lock）坚决返回 undefined，
 * 避免在未持有锁的情况下越锁执行写入，由调用方退化为普通排队等待。
 */
export async function acquireStorageLockIfAvailable<T>(
    operation: () => Promise<T>
): Promise<T | undefined> {
    const locks = getNavigatorLocks();
    if (!locks) {
        return undefined; // 环境不支持时拿不到 ifAvailable，返回 undefined 让调用方走既有排队
    }
    return locks.request<T | undefined>(
        STORAGE_LOCK_NAME,
        {mode: "exclusive", ifAvailable: true},
        async (lock) => {
            if (!lock) return undefined;
            return operation();
        }
    );
}

/**
 * S2: withDocLock 外部适配器
 * 严禁私自修改 packages/lv-kit 源码，仅在此层以适配模式调用生态共享 withDocLock。
 */
export async function withDocLockAdapter<T>(docId: string, operation: () => Promise<T>): Promise<T> {
    return registeredDocLock(docId, operation);
}

/**
 * S2: lvWithSyncRetry 外部安全适配
 * 遇到跨窗口写入争用时自动带指数退避重试，缺失环境优雅回退为普通单次调用。
 */
export async function safeWithSyncRetry<T>(operation: () => Promise<T>): Promise<T> {
    return registeredSyncRetry(operation);
}

/**
 * S2: isLvSyncLockError 外部安全判定
 */
export function isSyncLockError(error: unknown): boolean {
    return registeredSyncLockErrorCheck(error);
}
