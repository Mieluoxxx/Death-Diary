/**
 * Item grid — match Cocos ItemCell 84×84 / ItemSection pitch 110×100 / 5 cols.
 * Supports vertical drag/wheel scroll when content exceeds the viewport.
 */

import type { GameObjects, Scene } from 'phaser';
import { itemName as itemNameFromStrings } from '../../data/buildStrings';
import { getItemDef } from '../../data/itemConfig';
import type { ItemCounts } from '../../session/sessionStore';
import { listItems, type TransferResult } from '../../systems/inventory';
import {
    UI_FONT_FAMILY,
    UI_FONT_SIZE,
    UI_TEXT_RESOLUTION,
} from '../uiFont';

export const ITEM_CELL_SIZE = 84;
export const ITEM_CELL_PITCH_X = 110;
export const ITEM_CELL_PITCH_Y = 100;
export const ITEM_GRID_COLUMNS = 5;

export function resolveItemName (itemId: number): string
{
    const fromConfig = getItemDef(itemId).name;
    if (fromConfig && !fromConfig.startsWith('物品'))
    {
        return fromConfig;
    }
    return itemNameFromStrings(itemId);
}

export type ItemGridHandle = {
    root: GameObjects.Container;
    refresh: () => void;
    destroy: () => void;
};

export function mountItemGrid (
    scene: Scene,
    parent: GameObjects.Container,
    opts: {
        x: number;
        y: number;
        width: number;
        height: number;
        getCounts: () => ItemCounts;
        onTap?: (itemId: number) => void;
        emptyText?: string;
        columns?: number;
        /** Dense icon grid (gate bag/storage) — original 84 face / 110×100 pitch. */
        compact?: boolean;
    },
): ItemGridHandle
{
    // Viewport host stays fixed; listRoot scrolls under a world-space FilterMask.
    const host = scene.add.container(opts.x, opts.y);
    parent.add(host);

    const listRoot = scene.add.container(0, 0);
    host.add(listRoot);

    const compact = Boolean(opts.compact);
    const columns = opts.columns ?? (compact ? ITEM_GRID_COLUMNS : 4);
    // Original pitch fixed at 110×100 when compact (5×110=550).
    const cellW = compact ? ITEM_CELL_PITCH_X : opts.width / columns;
    const cellH = compact ? ITEM_CELL_PITCH_Y : 96;
    const face = compact ? ITEM_CELL_SIZE : ITEM_CELL_SIZE;
    const gridInnerW = compact ? columns * cellW : opts.width;
    const offsetX = compact ? Math.max(0, (opts.width - gridInnerW) / 2) : 0;
    const viewW = opts.width;
    const viewH = opts.height;

    // Mask must be world-space (same pattern as storageNode / radioNode).
    // Recomputed on refresh in case parent containers move.
    const maskRect = scene.add
        .rectangle(0, 0, viewW, viewH, 0xffffff)
        .setVisible(false);

    const syncMaskToHost = () =>
    {
        const m = host.getWorldTransformMatrix();
        const center = m.transformPoint(viewW / 2, viewH / 2);
        maskRect.setPosition(center.x, center.y);
        maskRect.setDisplaySize(viewW * Math.abs(m.scaleX), viewH * Math.abs(m.scaleY));
    };
    syncMaskToHost();

    listRoot.enableFilters();
    if (listRoot.filters)
    {
        listRoot.filters.internal.addMask(
            maskRect,
            false,
            scene.cameras.main,
            'world',
        );
    }

    // FilterMask only clips drawing — scrolled cells still receive input outside
    // the viewport and can "click through" a neighboring panel (e.g. bag over storage).
    // A full-viewport hit on host swallows those presses for lower display-list grids.
    const inputBlocker = scene.add
        .rectangle(viewW / 2, viewH / 2, viewW, viewH, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: false });
    host.add(inputBlocker);
    host.sendToBack(inputBlocker);
    // Keep listRoot above blocker so in-view item hits win.
    host.bringToTop(listRoot);

    let contentH = 0;
    let scrollOffset = 0;
    let dragBaseOffset = 0;
    let dragStartPointerY = 0;
    let dragging = false;
    let didDrag = false;
    /** Per-cell hit targets — interactivity toggled with scroll so out-of-view
     *  cells cannot steal clicks from a neighboring panel. */
    const cellHits: Array<{ hit: GameObjects.Rectangle; localY: number }> = [];

    const worldBounds = () =>
    {
        // host is parent-local; convert to world via matrix so nested panels work.
        const m = host.getWorldTransformMatrix();
        const tl = m.transformPoint(0, 0);
        const br = m.transformPoint(viewW, viewH);
        const left = Math.min(tl.x, br.x);
        const right = Math.max(tl.x, br.x);
        const top = Math.min(tl.y, br.y);
        const bottom = Math.max(tl.y, br.y);
        return { left, right, top, bottom };
    };

    const inView = (x: number, y: number) =>
    {
        const b = worldBounds();
        return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
    };

    const syncCellInput = () =>
    {
        // Cell local Y is relative to listRoot; use matrix so nested containers stay correct.
        const m = listRoot.getWorldTransformMatrix();
        const bounds = worldBounds();
        for (const entry of cellHits)
        {
            const p = m.transformPoint(0, entry.localY);
            const half = cellH / 2;
            const visible = p.y + half > bounds.top && p.y - half < bounds.bottom;
            if (visible)
            {
                if (!entry.hit.input?.enabled)
                {
                    entry.hit.setInteractive({ useHandCursor: true });
                }
            }
            else if (entry.hit.input?.enabled)
            {
                entry.hit.disableInteractive();
            }
        }
    };

    const applyScroll = () =>
    {
        const minOffset = Math.min(0, viewH - contentH);
        scrollOffset = Math.max(minOffset, Math.min(0, scrollOffset));
        listRoot.y = scrollOffset;
        syncCellInput();
    };

    const onPointerDown = (pointer: Phaser.Input.Pointer) =>
    {
        if (!inView(pointer.x, pointer.y))
        {
            return;
        }
        dragging = true;
        didDrag = false;
        dragBaseOffset = scrollOffset;
        dragStartPointerY = pointer.y;
    };
    const onPointerMove = (pointer: Phaser.Input.Pointer) =>
    {
        if (!dragging || !pointer.isDown)
        {
            return;
        }
        const dy = pointer.y - dragStartPointerY;
        if (Math.abs(dy) > 6)
        {
            didDrag = true;
        }
        if (didDrag)
        {
            scrollOffset = dragBaseOffset + dy;
            applyScroll();
        }
    };
    const onPointerUp = () =>
    {
        dragging = false;
    };
    const onWheel = (
        pointer: Phaser.Input.Pointer,
        _gos: unknown,
        _dx: number,
        dy: number,
    ) =>
    {
        if (!inView(pointer.x, pointer.y))
        {
            return;
        }
        scrollOffset -= dy * 0.5;
        applyScroll();
    };
    scene.input.on('pointerdown', onPointerDown);
    scene.input.on('pointermove', onPointerMove);
    scene.input.on('pointerup', onPointerUp);
    scene.input.on('wheel', onWheel);

    const refresh = () =>
    {
        syncMaskToHost();
        listRoot.removeAll(true);
        cellHits.length = 0;
        const items = listItems(opts.getCounts());
        if (items.length === 0)
        {
            if (opts.emptyText)
            {
                listRoot.add(
                    scene.add
                        .text(opts.width / 2, 40, opts.emptyText, {
                            fontFamily: UI_FONT_FAMILY,
                            resolution: UI_TEXT_RESOLUTION,
                            fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                            color: '#888888',
                        })
                        .setOrigin(0.5, 0),
                );
            }
            contentH = 80;
            applyScroll();
            return;
        }

        items.forEach((row, index) =>
        {
            const col = index % columns;
            const r = Math.floor(index / columns);
            const cx = offsetX + col * cellW + cellW / 2;
            const cy = r * cellH + cellH / 2;
            const cell = scene.add.container(cx, cy);
            listRoot.add(cell);

            const isEquipLike =
                row.itemId >= 1301000
                && row.itemId < 1305000;
            const bgFrame = isEquipLike ? 'item_equip_bg.png' : 'item_bg.png';

            // Force 84×84 face (atlas frame may be trimmed 82×82).
            if (scene.textures.exists('ui') && scene.textures.get('ui').has(bgFrame))
            {
                const bg = scene.add.image(0, 0, 'ui', bgFrame);
                bg.setDisplaySize(face, face);
                cell.add(bg);
            }
            else
            {
                cell.add(scene.add.rectangle(0, 0, face, face, 0x2a2a2a));
            }

            // Icons authored for 84×84 sourceSize; fill the cell face.
            const iconFrame = `icon_item_${row.itemId}.png`;
            if (scene.textures.exists('icon') && scene.textures.get('icon').has(iconFrame))
            {
                const icon = scene.add.image(0, 0, 'icon', iconFrame);
                const maxDim = Math.max(icon.width, icon.height, 1);
                // Original draws icon at full cell scale; trim crops need upscale.
                icon.setScale((face * 0.95) / maxDim);
                cell.add(icon);
            }
            // Original: num at bottom-right of cell, COMMON_2, black stroke.
            const half = face / 2;
            cell.add(
                scene.add
                    .text(half - 4, half - 4, String(row.num), {
                        fontFamily: UI_FONT_FAMILY,
                        resolution: UI_TEXT_RESOLUTION,
                        fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
                        color: '#ffffff',
                        stroke: '#000000',
                        strokeThickness: 3,
                    })
                    .setOrigin(1, 1),
            );

            if (!compact)
            {
                cell.add(
                    scene.add
                        .text(0, half + 6, resolveItemName(row.itemId), {
                            fontFamily: UI_FONT_FAMILY,
                            resolution: UI_TEXT_RESOLUTION,
                            fontSize: '12px',
                            color: '#e8e0d0',
                            align: 'center',
                            wordWrap: { width: cellW - 8 },
                        })
                        .setOrigin(0.5, 0),
                );
            }

            const hit = scene.add
                .rectangle(0, 0, cellW - 2, cellH - 2, 0xffffff, 0.001)
                .setInteractive({ useHandCursor: true });
            cell.add(hit);
            hit.on('pointerup', (pointer: Phaser.Input.Pointer) =>
            {
                // Ignore if this was mostly a scroll drag, or the cell is outside
                // the clipped viewport (FilterMask does not cull input).
                if (pointer.getDistance() > 8 || didDrag || !inView(pointer.x, pointer.y))
                {
                    return;
                }
                opts.onTap?.(row.itemId);
            });
            cellHits.push({ hit, localY: cy });
        });

        const rows = Math.ceil(items.length / columns);
        contentH = rows * cellH + 12;

        if (dragging)
        {
            dragBaseOffset = scrollOffset;
            dragStartPointerY = scene.input.activePointer?.y ?? dragStartPointerY;
        }
        applyScroll();
    };

    refresh();
    return {
        root: host,
        refresh,
        destroy: () =>
        {
            scene.input.off('pointerdown', onPointerDown);
            scene.input.off('pointermove', onPointerMove);
            scene.input.off('pointerup', onPointerUp);
            scene.input.off('wheel', onWheel);
            listRoot.filters?.internal.clear();
            maskRect.destroy();
            host.destroy(true);
        },
    };
}

export function transferFailMessage (res: TransferResult): string
{
    if (res.ok)
    {
        return '';
    }
    if (res.reason === 'overweight')
    {
        return '负重不足，无法放入背包';
    }
    if (res.reason === 'not_enough')
    {
        return '数量不足';
    }
    return '无法转移';
}
