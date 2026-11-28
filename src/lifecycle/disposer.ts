export interface IDisposable {
    dispose(): void;
}

export type DisposableFunction = () => void;
export type DisposableItem = IDisposable | DisposableFunction;

/**
 * S4: 树状级联组合注销器 (CompositeDisposer)
 * 核心契约：
 * 1. 严格 LIFO 逆序释放（后注册的先注销）
 * 2. 幂等性保障（多次调用 dispose() 仅执行一次）
 * 3. 异常隔离（单个注销回调抛错不阻断链路上其他注销项）
 * 4. 树形级联支持（createChild() 子注销器跟随父级一键注销）
 * 5. 全面接管定时器、心跳句柄与 DOM 事件监听
 */
export class CompositeDisposer implements IDisposable {
    private readonly items = new Set<DisposableItem>();
    private readonly children = new Set<CompositeDisposer>();
    private _isDisposed = false;
    private parent?: CompositeDisposer;

    constructor(parent?: CompositeDisposer) {
        this.parent = parent;
    }

    public get isDisposed(): boolean {
        return this._isDisposed;
    }

    public get size(): number {
        return this.items.size + this.children.size;
    }

    /**
     * 注册清理项，返回主动注销该单项的取消函数
     */
    public add(item: DisposableItem | undefined | null): () => void {
        if (!item || this._isDisposed) {
            if (item && this._isDisposed) {
                try {
                    if (typeof item === "function") item();
                    else item.dispose();
                } catch (e) {
                    console.error("[CompositeDisposer] Late dispose failed:", e);
                }
            }
            return () => {};
        }

        this.items.add(item);
        let removed = false;
        return () => {
            if (removed) return;
            removed = true;
            this.items.delete(item);
        };
    }

    /**
     * 纳管 setTimeout 句柄
     */
    public addTimeout(timerId: number | undefined | null): () => void {
        if (timerId === undefined || timerId === null) return () => {};
        const cancel = () => {
            if (typeof window !== "undefined") {
                window.clearTimeout(timerId);
            } else if (typeof clearTimeout !== "undefined") {
                clearTimeout(timerId);
            }
        };
        return this.add(cancel);
    }

    /**
     * 纳管 setInterval 句柄
     */
    public addInterval(intervalId: number | undefined | null): () => void {
        if (intervalId === undefined || intervalId === null) return () => {};
        const cancel = () => {
            if (typeof window !== "undefined") {
                window.clearInterval(intervalId);
            } else if (typeof clearInterval !== "undefined") {
                clearInterval(intervalId);
            }
        };
        return this.add(cancel);
    }

    /**
     * 纳管 DOM / EventTarget 事件监听
     */
    public addEvent(
        target: EventTarget | undefined | null,
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
    ): () => void {
        if (!target || typeof target.addEventListener !== "function") return () => {};
        target.addEventListener(type, listener, options);
        return this.add(() => {
            try {
                target.removeEventListener(type, listener, options);
            } catch { /* ignore */ }
        });
    }

    /**
     * 创建附属于本节点的子注销器，支持作用域级联清理
     */
    public createChild(): CompositeDisposer {
        if (this._isDisposed) {
            const child = new CompositeDisposer();
            child.dispose();
            return child;
        }
        const child = new CompositeDisposer(this);
        this.children.add(child);
        return child;
    }

    /**
     * 逆序释放所有已注册资源
     */
    public dispose(): void {
        if (this._isDisposed) return;
        this._isDisposed = true;

        if (this.parent) {
            this.parent.children.delete(this);
            this.parent = undefined;
        }

        // 1. 先释放所有子作用域
        const childList = [...this.children];
        this.children.clear();
        for (let i = childList.length - 1; i >= 0; i--) {
            try {
                childList[i].parent = undefined;
                childList[i].dispose();
            } catch (e) {
                console.error("[CompositeDisposer] Child disposer error:", e);
            }
        }

        // 2. 逆序执行自身所有清理项 (LIFO)
        const itemList = [...this.items];
        this.items.clear();
        for (let i = itemList.length - 1; i >= 0; i--) {
            const item = itemList[i];
            try {
                if (typeof item === "function") {
                    item();
                } else if (item && typeof item.dispose === "function") {
                    item.dispose();
                }
            } catch (e) {
                console.error("[CompositeDisposer] Resource dispose error:", e);
            }
        }
    }
}
