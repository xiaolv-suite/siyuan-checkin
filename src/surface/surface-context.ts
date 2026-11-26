import type {
    PageId,
    RootContextLike,
    SurfaceKind,
} from "./types";
import {CompositeDisposer} from "../lifecycle/disposer";
import {FocusSessionStateMachine} from "../features/focus";

/**
 * S5: 独立表面上下文 (SurfaceContext)
 * 职责：
 * 1. 彻底解耦 Dock / Tab / QuickDialog 多宿主表面的会话状态；
 * 2. 独立维护各表面的页面路由、滚动记忆（scrollTops）、输入框草稿及焦点状态；
 * 3. 附带专属于本表面的子级 CompositeDisposer，表面销毁时级联回收本地 DOM 监听与子时钟；
 * 4. 表面注销时无缝联动 FocusSessionStateMachine，保证番茄钟与活跃专注平滑转移，绝不闪退。
 */
export class SurfaceContext {
    public readonly id: string;
    public readonly kind: SurfaceKind;
    public readonly root: HTMLElement;
    public readonly context: RootContextLike;
    public readonly disposer: CompositeDisposer;

    constructor(
        id: string,
        kind: SurfaceKind,
        root: HTMLElement,
        context: RootContextLike,
        parentDisposer?: CompositeDisposer
    ) {
        this.id = id;
        this.kind = kind;
        this.root = root;
        this.context = context;
        this.disposer = parentDisposer ? parentDisposer.createChild() : new CompositeDisposer();
    }

    public get page(): PageId {
        return this.context.page;
    }

    public set page(newPage: PageId) {
        this.context.page = newPage;
    }

    public rememberScroll(key: string, scrollTop: number): void {
        this.context.scrollTops[key] = Math.max(0, Math.floor(scrollTop));
    }

    public getSavedScroll(key: string): number {
        return this.context.scrollTops[key] ?? 0;
    }

    public isConnected(): boolean {
        return this.root.isConnected !== false;
    }

    public dispose(): void {
        this.disposer.dispose();
    }
}

/**
 * S5: 表面注册管理中枢 (SurfaceRegistry)
 */
export class SurfaceRegistry {
    private readonly surfaces = new Map<HTMLElement, SurfaceContext>();

    public register(
        root: HTMLElement,
        kind: SurfaceKind,
        initialContext: RootContextLike,
        parentDisposer?: CompositeDisposer
    ): SurfaceContext {
        let existing = this.surfaces.get(root);
        if (existing) {
            return existing;
        }
        const id = `surface_${kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        const surface = new SurfaceContext(id, kind, root, initialContext, parentDisposer);
        this.surfaces.set(root, surface);
        return surface;
    }

    public get(root: HTMLElement): SurfaceContext | undefined {
        return this.surfaces.get(root);
    }

    public has(root: HTMLElement): boolean {
        return this.surfaces.has(root);
    }

    public release(root: HTMLElement): void {
        const surface = this.surfaces.get(root);
        if (surface) {
            surface.dispose();
            this.surfaces.delete(root);
        }
    }

    public clear(): void {
        for (const surface of this.surfaces.values()) {
            surface.dispose();
        }
        this.surfaces.clear();
    }

    public get size(): number {
        return this.surfaces.size;
    }

    public entries(): IterableIterator<[HTMLElement, SurfaceContext]> {
        return this.surfaces.entries();
    }

    public values(): IterableIterator<SurfaceContext> {
        return this.surfaces.values();
    }

    /**
     * 发现当前所有处于已连接状态的表面
     */
    public findConnectedRoots(): HTMLElement[] {
        return [...this.surfaces.keys()].filter((root) => root.isConnected !== false);
    }

    /**
     * 当某表面断链或关闭时，自愈回退至首个处于连接状态的有效宿主表面
     */
    public resolveFallbackRoot(
        currentRoot: HTMLElement | undefined,
        priorityOrder: Array<HTMLElement | undefined | null> = []
    ): HTMLElement | undefined {
        if (currentRoot && currentRoot.isConnected !== false && this.has(currentRoot)) {
            return currentRoot;
        }
        for (const candidate of [...priorityOrder, ...this.findConnectedRoots()]) {
            if (candidate && candidate !== currentRoot && candidate.isConnected !== false) {
                return candidate;
            }
        }
        return undefined;
    }
}
