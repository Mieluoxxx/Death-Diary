/**
 * StorageNode — port of Buried-City storageNode.js + SectionTableView/ItemSection.
 *
 * Layout:
 * - Title bar: back | 仓库 | shop cart (btn_shop + highlight pulse)
 * - SectionTableView 5-col ItemCell grid (84 face / 110×100 pitch)
 * - Sections (string 3006): 材料 / 食品 / 药物 / 强化 / 装备 / 其他
 * - Type prefixes: 1101, 1103, 1104, 1107, 13, other
 * - Empty sections hidden; no name labels under icons
 */

import { getSession, type ItemCounts } from '../../session/sessionStore';
import { gameBusOn, gameBusOff } from '../../systems/gameBus';
import type { NodeMountContext, NodeMountResult } from '../navigation';
import {
    ITEM_CELL_PITCH_X,
    ITEM_CELL_PITCH_Y,
    ITEM_CELL_SIZE,
    ITEM_GRID_COLUMNS,
    resolveItemName,
} from './itemGrid';
import {
    UI_FONT_FAMILY,
    UI_FONT_SIZE,
    UI_TEXT_RESOLUTION,
} from '../uiFont';

/** Original blackList.storageDisplay — hidden in warehouse. */
const STORAGE_DISPLAY_HIDE = new Set([
    1305023, 1305024, 1304024, 1305053, 1305064, 1305034, 1305044,
]);

/** string 3006 + typeArray from storageNode.updateView. */
const STORAGE_SECTIONS: Array<{ key: string; title: string; prefix?: string }> = [
    { key: '1101', title: '材料', prefix: '1101' },
    { key: '1103', title: '食品', prefix: '1103' },
    { key: '1104', title: '药物', prefix: '1104' },
    { key: '1107', title: '强化', prefix: '1107' },
    { key: '13', title: '装备', prefix: '13' },
    { key: 'other', title: '其他' },
];

const SECTION_TITLE_H = 50;

type ItemRow = { itemId: number; num: number };

function groupStorageItems (counts: ItemCounts): Record<string, ItemRow[]>
{
    const groups: Record<string, ItemRow[]> = {};
    for (const sec of STORAGE_SECTIONS)
    {
        groups[sec.key] = [];
    }

    for (const [idText, num] of Object.entries(counts))
    {
        const itemId = Number(idText);
        if (!Number.isFinite(itemId) || num <= 0)
        {
            continue;
        }
        if (STORAGE_DISPLAY_HIDE.has(itemId))
        {
            continue;
        }
        const idStr = String(itemId);
        let placed = false;
        for (const sec of STORAGE_SECTIONS)
        {
            if (!sec.prefix)
            {
                continue;
            }
            if (idStr.startsWith(sec.prefix))
            {
                groups[sec.key].push({ itemId, num });
                placed = true;
                break;
            }
        }
        if (!placed)
        {
            groups.other.push({ itemId, num });
        }
    }

    // Stable numeric order within section (original map order is unstable; numeric is fine).
    for (const key of Object.keys(groups))
    {
        groups[key].sort((a, b) => a.itemId - b.itemId);
    }
    return groups;
}

export function mountStorageNode (ctx: NodeMountContext): NodeMountResult
{
    ctx.setTitle('仓库');
    ctx.setLeftEnabled(true);
    // Original: rightBtn false; shop is a separate SpriteButton on the title bar.
    ctx.setRightEnabled(false);

    // SectionTableView: 640×750 @ y=10 from bg bottom.
    // Item grid itself is 5×110=550; center under the frame.
    const tableTop = ctx.toScreenY(760);
    const tableHeight = 750;
    const tableWidth = ITEM_CELL_PITCH_X * ITEM_GRID_COLUMNS;
    const tableLeft = ctx.width / 2 - tableWidth / 2;

    // Shop cart — original (bgW-60, actionBarBaseHeight=803).
    const titleY = ctx.toScreenY(803);
    const shopX = ctx.toScreenX(ctx.bgWidth - 60);
    if (ctx.scene.textures.exists('ui') && ctx.scene.textures.get('ui').has('btn_shop.png'))
    {
        const shop = ctx.scene.add
            .image(shopX, titleY, 'ui', 'btn_shop.png')
            .setInteractive({ useHandCursor: true });
        ctx.content.add(shop);
        shop.on('pointerup', () =>
        {
            // ShopNode not ported yet — keep chrome parity.
            ctx.showToast('商店暂未开放');
        });
        if (ctx.scene.textures.get('ui').has('btn_shop_highlight.png'))
        {
            const highlight = ctx.scene.add.image(shopX, titleY, 'ui', 'btn_shop_highlight.png');
            ctx.content.add(highlight);
            ctx.scene.tweens.add({
                targets: highlight,
                alpha: 0,
                duration: 1500,
                yoyo: true,
                repeat: -1,
            });
        }
    }

    const listRoot = ctx.scene.add.container(tableLeft, tableTop);
    ctx.content.add(listRoot);

    // Clip to table bounds (SectionTableView clippingToBounds).
    const maskG = ctx.scene.make.graphics({ x: 0, y: 0 });
    maskG.fillStyle(0xffffff);
    maskG.fillRect(tableLeft, tableTop, tableWidth, tableHeight);
    const mask = maskG.createGeometryMask();
    listRoot.setMask(mask);

    let contentH = 0;
    let dragBaseY = 0;
    let dragStartPointerY = 0;
    let dragging = false;
    let didDrag = false;

    const clampOffset = () =>
    {
        const minY = tableTop + Math.min(0, tableHeight - contentH);
        const maxY = tableTop;
        listRoot.y = Math.max(minY, Math.min(maxY, listRoot.y));
    };

    const inTable = (x: number, y: number) =>
        x >= tableLeft
        && x <= tableLeft + tableWidth
        && y >= tableTop
        && y <= tableTop + tableHeight;

    // Drag-scroll without a full-area hit that steals item taps.
    const onPointerDown = (pointer: Phaser.Input.Pointer) =>
    {
        if (!inTable(pointer.x, pointer.y))
        {
            return;
        }
        dragging = true;
        didDrag = false;
        dragBaseY = listRoot.y;
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
            listRoot.y = dragBaseY + dy;
            clampOffset();
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
        if (!inTable(pointer.x, pointer.y))
        {
            return;
        }
        listRoot.y -= dy * 0.5;
        clampOffset();
    };
    ctx.scene.input.on('pointerdown', onPointerDown);
    ctx.scene.input.on('pointermove', onPointerMove);
    ctx.scene.input.on('pointerup', onPointerUp);
    ctx.scene.input.on('wheel', onWheel);
    const rebuild = () =>
    {
        listRoot.removeAll(true);
        const live = getSession();
        const counts = live?.storage ?? {};
        const groups = groupStorageItems(counts);

        let y = 0;
        let any = false;

        for (const sec of STORAGE_SECTIONS)
        {
            const items = groups[sec.key] ?? [];
            if (items.length === 0)
            {
                continue;
            }
            any = true;
            const rows = Math.ceil(items.length / ITEM_GRID_COLUMNS);
            const gridH = rows * ITEM_CELL_PITCH_Y;
            const sectionH = gridH + SECTION_TITLE_H;

            // Title (ItemSection): COMMON_2, left-aligned at x≈(100-84)/2=8
            listRoot.add(
                ctx.scene.add
                    .text(8, y + SECTION_TITLE_H / 2, sec.title, {
                        fontFamily: UI_FONT_FAMILY,
                        resolution: UI_TEXT_RESOLUTION,
                        fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
                        color: '#ffffff',
                    })
                    .setOrigin(0, 0.5),
            );

            const gridTop = y + SECTION_TITLE_H;
            items.forEach((row, index) =>
            {
                const col = index % ITEM_GRID_COLUMNS;
                const r = Math.floor(index / ITEM_GRID_COLUMNS);
                const cx = col * ITEM_CELL_PITCH_X + ITEM_CELL_PITCH_X / 2;
                // ItemSection places cells from top of grid area downward.
                const cy = gridTop + r * ITEM_CELL_PITCH_Y + ITEM_CELL_PITCH_Y / 2;
                addItemCell(ctx, listRoot, cx, cy, row.itemId, row.num);
            });

            y += sectionH;
        }

        if (!any)
        {
            listRoot.add(
                ctx.scene.add
                    .text(tableWidth / 2, 40, '仓库空空如也', {
                        fontFamily: UI_FONT_FAMILY,
                        resolution: UI_TEXT_RESOLUTION,
                        fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                        color: '#888888',
                    })
                    .setOrigin(0.5, 0),
            );
            contentH = 80;
        }
        else
        {
            contentH = y;
        }

        // Pin to top on rebuild (original first open).
        listRoot.y = tableTop;
        clampOffset();
    };

    rebuild();
    const onSession = () => rebuild();
    gameBusOn('session_updated', onSession);

    return {
        onLeft: () => ctx.back(),
        destroy: () =>
        {
            gameBusOff('session_updated', onSession);
            ctx.scene.input.off('pointerdown', onPointerDown);
            ctx.scene.input.off('pointermove', onPointerMove);
            ctx.scene.input.off('pointerup', onPointerUp);
            ctx.scene.input.off('wheel', onWheel);
            maskG.destroy();
        },
    };
}

function addItemCell (
    ctx: NodeMountContext,
    parent: Phaser.GameObjects.Container,
    cx: number,
    cy: number,
    itemId: number,
    num: number,
): void
{
    const cell = ctx.scene.add.container(cx, cy);
    parent.add(cell);

    // ItemCell: equip bg for equipment type (prefix 13 except bags etc.).
    const isEquipLike = itemId >= 1300000 && itemId < 1400000
        && !(itemId >= 1305000 && itemId < 1306000);
    const bgFrame = isEquipLike ? 'item_equip_bg.png' : 'item_bg.png';
    const face = ITEM_CELL_SIZE;

    if (ctx.scene.textures.exists('ui') && ctx.scene.textures.get('ui').has(bgFrame))
    {
        const bg = ctx.scene.add.image(0, 0, 'ui', bgFrame);
        bg.setDisplaySize(face, face);
        cell.add(bg);
    }
    else
    {
        cell.add(ctx.scene.add.rectangle(0, 0, face, face, 0x2a2a2a));
    }

    const iconFrame = `icon_item_${itemId}.png`;
    if (ctx.scene.textures.exists('icon') && ctx.scene.textures.get('icon').has(iconFrame))
    {
        const icon = ctx.scene.add.image(0, 0, 'icon', iconFrame);
        const maxDim = Math.max(icon.width, icon.height, 1);
        icon.setScale((face * 0.95) / maxDim);
        cell.add(icon);
    }

    const half = face / 2;
    cell.add(
        ctx.scene.add
            .text(half - 4, half - 4, String(num), {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3,
            })
            .setOrigin(1, 1),
    );

    const hit = ctx.scene.add
        .rectangle(0, 0, ITEM_CELL_PITCH_X - 2, ITEM_CELL_PITCH_Y - 2, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true });
    cell.add(hit);
    hit.on('pointerup', (pointer: Phaser.Input.Pointer) =>
    {
        // Ignore if this was mostly a scroll drag.
        if (pointer.getDistance() > 8)
        {
            return;
        }
        ctx.showToast(`${resolveItemName(itemId)} ×${num}`);
    });
}
