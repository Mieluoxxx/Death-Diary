/**
 * Item grid — match Cocos ItemCell 84×84 / ItemSection pitch 110×100 / 5 cols.
 */

import { Scene, GameObjects } from 'phaser';
import { getItemDef } from '../../data/itemConfig';
import { itemName as itemNameFromStrings } from '../../data/buildStrings';
import { listItems, type TransferResult } from '../../systems/inventory';
import type { ItemCounts } from '../../session/sessionStore';
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
    const root = scene.add.container(opts.x, opts.y);
    parent.add(root);

    const compact = Boolean(opts.compact);
    const columns = opts.columns ?? (compact ? ITEM_GRID_COLUMNS : 4);
    // Original pitch fixed at 110×100 when compact (5×110=550).
    const cellW = compact ? ITEM_CELL_PITCH_X : opts.width / columns;
    const cellH = compact ? ITEM_CELL_PITCH_Y : 96;
    const face = compact ? ITEM_CELL_SIZE : ITEM_CELL_SIZE;
    const gridInnerW = compact ? columns * cellW : opts.width;
    const offsetX = compact ? Math.max(0, (opts.width - gridInnerW) / 2) : 0;

    const refresh = () =>
    {
        root.removeAll(true);
        const items = listItems(opts.getCounts());
        if (items.length === 0)
        {
            if (opts.emptyText)
            {
                root.add(
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
            return;
        }

        items.forEach((row, index) =>
        {
            const col = index % columns;
            const r = Math.floor(index / columns);
            if ((r + 1) * cellH > opts.height + 12)
            {
                return;
            }
            const cx = offsetX + col * cellW + cellW / 2;
            const cy = r * cellH + cellH / 2;
            const cell = scene.add.container(cx, cy);
            root.add(cell);

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
            hit.on('pointerup', () => opts.onTap?.(row.itemId));
        });
    };

    refresh();
    return {
        root,
        refresh,
        destroy: () => root.destroy(true),
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
