/**
 * Shared scroll viewport for Phaser 4 WebGL.
 *
 * Encodes the hard-won patterns from itemGrid / storageNode / radio / buildPanel:
 * - FilterMask clips DRAWING only (world-space mask rect)
 * - Out-of-view interactive hits must be disabled or they click through neighbors
 * - Drag + wheel, with didDrag so cell taps can ignore scroll gestures
 *
 * Content is always local to `content` (0,0 at viewport top-left).
 * Prefer `addScrollHit` / `trackScrollButton` + `isScrollTap` over raw setInteractive
 * inside scroll content — those wire culling and tap guards in one place.
 */

import type { GameObjects, Scene } from 'phaser';

export type ScrollAxis = 'y' | 'x';

export type ScrollHit = {
    hit: GameObjects.Rectangle | GameObjects.Image | GameObjects.Zone;
    /** Position of the hit center along the scroll axis, in content-local coords. */
    local: number;
    /** Half-extent along the scroll axis used for visibility tests. */
    half: number;
};

export type ScrollViewportOptions = {
    x: number;
    y: number;
    width: number;
    height: number;
    axis?: ScrollAxis;
    /** Wheel delta scale (default 0.5). */
    wheelFactor?: number;
    /** Pixel drag threshold before counting as scroll (default 6). */
    dragThreshold?: number;
    /**
     * Full-viewport transparent hit under content so empty areas scroll
     * and swallow presses meant for panels behind this viewport (default true).
     */
    inputBlocker?: boolean;
};

export type ScrollViewportHandle = {
    host: GameObjects.Container;
    /** Put scrollable children here at local coordinates. */
    content: GameObjects.Container;
    axis: ScrollAxis;
    width: number;
    height: number;
    /** Content extent along the scroll axis. */
    setContentSize: (size: number) => void;
    getContentSize: () => number;
    /** Offset ≤ 0; 0 = content top/left aligned with viewport. */
    getOffset: () => number;
    setOffset: (offset: number) => void;
    /** True after a drag exceeded the threshold (until next pointerdown). */
    didDrag: () => boolean;
    isDragging: () => boolean;
    inView: (screenX: number, screenY: number) => boolean;
    worldBounds: () => {
        left: number;
        right: number;
        top: number;
        bottom: number;
    };
    /** Register an interactive target whose input is culled when scrolled out. */
    trackHit: (entry: ScrollHit) => void;
    clearHits: () => void;
    /** Re-enable/disable tracked hits from current offset (also runs on scroll). */
    syncHits: () => void;
    /** Recompute world-space mask (call if parent transforms change). */
    syncMask: () => void;
    destroy: () => void;
};

/** Minimal surface for tap guards (full handle or a pick of it). */
export type ScrollTapGuard = Pick<ScrollViewportHandle, 'didDrag' | 'inView'>;

/** Objects that expose the real setInteractive target for scroll culling. */
export type ScrollButtonHit = {
    hitTarget: GameObjects.Image | GameObjects.Rectangle | GameObjects.Zone;
    hitHalfY: number;
};

/**
 * Unified scroll-content tap check: not a drag, pointer still in the viewport,
 * and movement stayed under the click threshold.
 */
export function isScrollTap(
    guard: ScrollTapGuard,
    pointer: Phaser.Input.Pointer,
    maxDistance = 8,
): boolean {
    return (
        pointer.getDistance() <= maxDistance &&
        !guard.didDrag() &&
        guard.inView(pointer.x, pointer.y)
    );
}

/**
 * Create a transparent hit rect, register it for out-of-view culling, and attach
 * an onTap that already runs through {@link isScrollTap}.
 *
 * `x`/`y` are parent-local (usually row or content). `axisLocal` is the hit
 * center along the scroll axis in **content-local** coordinates for trackHit.
 */
export function addScrollHit(
    scene: Scene,
    scroll: ScrollViewportHandle,
    opts: {
        x: number;
        y: number;
        width: number;
        height: number;
        axisLocal: number;
        useHandCursor?: boolean;
        onTap: (pointer: Phaser.Input.Pointer) => void;
    },
): GameObjects.Rectangle {
    const hit = scene.add
        .rectangle(opts.x, opts.y, opts.width, opts.height, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: opts.useHandCursor !== false });
    hit.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        if (!isScrollTap(scroll, pointer)) {
            return;
        }
        opts.onTap(pointer);
    });
    const half = (scroll.axis === 'y' ? opts.height : opts.width) / 2;
    scroll.trackHit({ hit, local: opts.axisLocal, half });
    return hit;
}

/** Register an atlas/button hitTarget so scroll culling can disable it off-screen. */
export function trackScrollButton(
    scroll: ScrollViewportHandle,
    btn: ScrollButtonHit,
    axisLocal: number,
): void {
    scroll.trackHit({
        hit: btn.hitTarget,
        local: axisLocal,
        half: btn.hitHalfY,
    });
}

export function mountScrollViewport(
    scene: Scene,
    parent: GameObjects.Container,
    opts: ScrollViewportOptions,
): ScrollViewportHandle {
    const axis: ScrollAxis = opts.axis ?? 'y';
    const wheelFactor = opts.wheelFactor ?? 0.5;
    const dragThreshold = opts.dragThreshold ?? 6;
    const useBlocker = opts.inputBlocker !== false;
    const viewW = opts.width;
    const viewH = opts.height;

    const host = scene.add.container(opts.x, opts.y);
    parent.add(host);

    const content = scene.add.container(0, 0);
    host.add(content);

    // World-space mask; FilterMask is WebGL-safe (GeometryMask is Canvas-only in Phaser 4).
    const maskRect = scene.add.rectangle(0, 0, viewW, viewH, 0xffffff).setVisible(false);

    const syncMask = () => {
        const m = host.getWorldTransformMatrix();
        const center = m.transformPoint(viewW / 2, viewH / 2);
        maskRect.setPosition(center.x, center.y);
        maskRect.setDisplaySize(viewW * Math.abs(m.scaleX), viewH * Math.abs(m.scaleY));
    };
    syncMask();

    content.enableFilters();
    if (content.filters) {
        content.filters.internal.addMask(maskRect, false, scene.cameras.main, 'world');
    }

    if (useBlocker) {
        const inputBlocker = scene.add
            .rectangle(viewW / 2, viewH / 2, viewW, viewH, 0xffffff, 0.001)
            .setInteractive({ useHandCursor: false });
        host.add(inputBlocker);
        host.sendToBack(inputBlocker);
        host.bringToTop(content);
    }

    let contentSize = 0;
    let offset = 0;
    let dragBase = 0;
    let dragStart = 0;
    let dragging = false;
    let didDragFlag = false;
    const hits: ScrollHit[] = [];

    const viewExtent = () => (axis === 'y' ? viewH : viewW);

    const worldBounds = () => {
        const m = host.getWorldTransformMatrix();
        const tl = m.transformPoint(0, 0);
        const br = m.transformPoint(viewW, viewH);
        return {
            left: Math.min(tl.x, br.x),
            right: Math.max(tl.x, br.x),
            top: Math.min(tl.y, br.y),
            bottom: Math.max(tl.y, br.y),
        };
    };

    const inView = (screenX: number, screenY: number) => {
        const b = worldBounds();
        return screenX >= b.left && screenX <= b.right && screenY >= b.top && screenY <= b.bottom;
    };

    const syncHits = () => {
        const m = content.getWorldTransformMatrix();
        const b = worldBounds();
        for (const entry of hits) {
            const p =
                axis === 'y' ? m.transformPoint(0, entry.local) : m.transformPoint(entry.local, 0);
            const coord = axis === 'y' ? p.y : p.x;
            const minEdge = axis === 'y' ? b.top : b.left;
            const maxEdge = axis === 'y' ? b.bottom : b.right;
            const visible = coord + entry.half > minEdge && coord - entry.half < maxEdge;
            const enabled = Boolean(entry.hit.input?.enabled);
            if (visible && !enabled) {
                entry.hit.setInteractive({ useHandCursor: true });
            } else if (!visible && enabled) {
                entry.hit.disableInteractive();
            }
        }
    };

    const applyOffset = () => {
        const minOffset = Math.min(0, viewExtent() - contentSize);
        offset = Math.max(minOffset, Math.min(0, offset));
        if (axis === 'y') {
            content.y = offset;
        } else {
            content.x = offset;
        }
        syncHits();
    };

    const onPointerDown = (pointer: Phaser.Input.Pointer) => {
        if (!inView(pointer.x, pointer.y)) {
            return;
        }
        dragging = true;
        didDragFlag = false;
        dragBase = offset;
        dragStart = axis === 'y' ? pointer.y : pointer.x;
    };

    const onPointerMove = (pointer: Phaser.Input.Pointer) => {
        if (!dragging || !pointer.isDown) {
            return;
        }
        const cur = axis === 'y' ? pointer.y : pointer.x;
        const delta = cur - dragStart;
        if (Math.abs(delta) > dragThreshold) {
            didDragFlag = true;
        }
        if (didDragFlag) {
            offset = dragBase + delta;
            applyOffset();
        }
    };

    const onPointerUp = () => {
        dragging = false;
    };

    const onWheel = (pointer: Phaser.Input.Pointer, _gos: unknown, dx: number, dy: number) => {
        if (!inView(pointer.x, pointer.y)) {
            return;
        }
        // Vertical wheel scrolls vertical lists; also drives horizontal strips
        // (common touchpad path, matches dialogSmall status strip).
        const delta = axis === 'y' ? dy : Math.abs(dx) > Math.abs(dy) ? dx : dy;
        offset -= delta * wheelFactor;
        applyOffset();
    };

    scene.input.on('pointerdown', onPointerDown);
    scene.input.on('pointermove', onPointerMove);
    scene.input.on('pointerup', onPointerUp);
    scene.input.on('wheel', onWheel);

    return {
        host,
        content,
        axis,
        width: viewW,
        height: viewH,
        setContentSize: (size: number) => {
            contentSize = Math.max(0, size);
            applyOffset();
        },
        getContentSize: () => contentSize,
        getOffset: () => offset,
        setOffset: (next: number) => {
            offset = next;
            applyOffset();
        },
        didDrag: () => didDragFlag,
        isDragging: () => dragging,
        inView,
        worldBounds,
        trackHit: (entry: ScrollHit) => {
            hits.push(entry);
        },
        clearHits: () => {
            hits.length = 0;
        },
        syncHits,
        syncMask,
        destroy: () => {
            scene.input.off('pointerdown', onPointerDown);
            scene.input.off('pointermove', onPointerMove);
            scene.input.off('pointerup', onPointerUp);
            scene.input.off('wheel', onWheel);
            content.filters?.internal.clear();
            maskRect.destroy();
            host.destroy(true);
        },
    };
}
