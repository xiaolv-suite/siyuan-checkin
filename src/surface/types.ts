import type {PageId} from "../types";

export type SurfaceKind = "dock" | "tab" | "dialog" | "mobile";

export interface SurfaceDescriptor {
    id: string;
    kind: SurfaceKind;
    root: HTMLElement;
    mountedAt: string;
}

export interface RootContextLike {
    page: PageId;
    scrollTops: Partial<Record<PageId, number>> & Record<string, number | undefined>;
}

export type {PageId};
