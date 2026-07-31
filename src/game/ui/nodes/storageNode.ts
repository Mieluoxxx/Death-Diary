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

import type { GameObjects } from 'phaser';
import { getSession, type ItemCounts } from '../../session/sessionStore';
import { gameBusOff, gameBusOn } from '../../systems/gameBus';
import { advanceGuide, GuideStep, isGuideStep } from '../../systems/userGuide';
import { createItemDetailModel } from '../itemDetailContext';
import { openItemDetailDialog } from '../itemDialog';
import type { NodeMountContext, NodeMountResult } from '../navigation';
import { isScrollTap, mountScrollViewport, type ScrollViewportHandle } from '../scrollViewport';
import { UI_FONT_FAMILY, UI_FONT_SIZE, UI_TEXT_RESOLUTION } from '../uiFont';
import { addGuideWarn } from '../userGuideUi';
import {
    ITEM_CELL_PITCH_X,
    ITEM_CELL_PITCH_Y,
    ITEM_CELL_SIZE,
    ITEM_GRID_COLUMNS,
} from './itemGrid';

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

function groupStorageItems(counts: ItemCounts): Record<string, ItemRow[]> {
    const groups: Record<string, ItemRow[]> = {};
    for (const sec of STORAGE_SECTIONS) {
        groups[sec.key] = [];
    }

    for (const [idText, num] of Object.entries(counts)) {
        const itemId = Number(idText);
        if (!Number.isFinite(itemId) || num <= 0) {
            continue;
        }
        if (STORAGE_DISPLAY_HIDE.has(itemId)) {
            continue;
        }
        const idStr = String(itemId);
        let placed = false;
        for (const sec of STORAGE_SECTIONS) {
            if (!sec.prefix) {
                continue;
            }
            if (idStr.startsWith(sec.prefix)) {
                groups[sec.key].push({ itemId, num });
                placed = true;
                break;
            }
        }
        if (!placed) {
            groups.other.push({ itemId, num });
        }
    }

    for (const key of Object.keys(groups)) {
        groups[key].sort((a, b) => a.itemId - b.itemId);
    }
    return groups;
}

export function mountStorageNode(ctx: NodeMountContext): NodeMountResult {
    ctx.setTitle('仓库');
    ctx.setLeftEnabled(true);
    // Original: rightBtn false; shop is a separate SpriteButton on the title bar.
    ctx.setRightEnabled(false);

    // Original table sat at y=10; use 20 so icons stay inside the bottom frame edge.
    const TABLE_BOTTOM_LOCAL = 20;
    const TABLE_TOP_LOCAL = 760;
    const tableTop = ctx.toScreenY(TABLE_TOP_LOCAL);
    const tableBottom = ctx.toScreenY(TABLE_BOTTOM_LOCAL);
    const tableHeight = Math.max(120, tableBottom - tableTop);
    const tableWidth = ITEM_CELL_PITCH_X * ITEM_GRID_COLUMNS;
    const tableLeft = ctx.width / 2 - tableWidth / 2;

    // Shop cart — original (bgW-60, actionBarBaseHeight=803).
    const titleY = ctx.toScreenY(803);
    const shopX = ctx.toScreenX(ctx.bgWidth - 60);
    if (ctx.scene.textures.exists('ui') && ctx.scene.textures.get('ui').has('btn_shop.png')) {
        const shop = ctx.scene.add
            .image(shopX, titleY, 'ui', 'btn_shop.png')
            .setInteractive({ useHandCursor: true });
        ctx.content.add(shop);
        shop.on('pointerup', () => {
            ctx.showToast('商店暂未开放');
        });
        if (ctx.scene.textures.get('ui').has('btn_shop_highlight.png')) {
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

    const scroll = mountScrollViewport(ctx.scene, ctx.content, {
        x: tableLeft,
        y: tableTop,
        width: tableWidth,
        height: tableHeight,
        axis: 'y',
        inputBlocker: true,
    });

    let lastStorageKey = '';

    const storageKey = (counts: ItemCounts): string => {
        const entries = Object.entries(counts)
            .filter(([, num]) => (num ?? 0) > 0)
            .map(([id, num]) => `${id}:${num}`)
            .sort();
        return entries.join('|');
    };

    const rebuild = (force = false) => {
        const live = getSession();
        const counts = live?.storage ?? {};
        const key = storageKey(counts);
        // Survival ticks emit session_updated constantly — skip no-op rebuilds
        // so scroll position is not torn down mid-drag.
        if (!force && key === lastStorageKey) {
            return;
        }
        lastStorageKey = key;

        const preserved = scroll.getOffset();
        scroll.syncMask();
        scroll.content.removeAll(true);
        scroll.clearHits();
        const groups = groupStorageItems(counts);

        let y = 0;
        let any = false;

        for (const sec of STORAGE_SECTIONS) {
            const items = groups[sec.key] ?? [];
            if (items.length === 0) {
                continue;
            }
            any = true;
            const rows = Math.ceil(items.length / ITEM_GRID_COLUMNS);
            const gridH = rows * ITEM_CELL_PITCH_Y;
            const sectionH = gridH + SECTION_TITLE_H;

            scroll.content.add(
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
            items.forEach((row, index) => {
                const col = index % ITEM_GRID_COLUMNS;
                const r = Math.floor(index / ITEM_GRID_COLUMNS);
                const cx = col * ITEM_CELL_PITCH_X + ITEM_CELL_PITCH_X / 2;
                const cy = gridTop + r * ITEM_CELL_PITCH_Y + ITEM_CELL_PITCH_Y / 2;
                addItemCell(ctx, scroll, scroll.content, cx, cy, row.itemId, row.num);
            });

            y += sectionH;
        }

        if (!any) {
            scroll.content.add(
                ctx.scene.add
                    .text(tableWidth / 2, 40, '仓库空空如也', {
                        fontFamily: UI_FONT_FAMILY,
                        resolution: UI_TEXT_RESOLUTION,
                        fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                        color: '#888888',
                    })
                    .setOrigin(0.5, 0),
            );
            scroll.setContentSize(80);
        } else {
            scroll.setContentSize(y + 24);
        }

        // Keep scroll position across rebuilds unless content shrank past it.
        scroll.setOffset(preserved);
    };

    rebuild(true);
    const onSession = () => rebuild(false);
    gameBusOn('session_updated', onSession);

    return {
        onLeft: () => ctx.back(),
        destroy: () => {
            gameBusOff('session_updated', onSession);
            scroll.destroy();
        },
    };
}

function addItemCell(
    ctx: NodeMountContext,
    scroll: ScrollViewportHandle,
    parent: GameObjects.Container,
    cx: number,
    cy: number,
    itemId: number,
    num: number,
): void {
    const cell = ctx.scene.add.container(cx, cy);
    parent.add(cell);

    const isEquipLike =
        itemId >= 1300000 && itemId < 1400000 && !(itemId >= 1305000 && itemId < 1306000);
    const bgFrame = isEquipLike ? 'item_equip_bg.png' : 'item_bg.png';
    const face = ITEM_CELL_SIZE;

    if (ctx.scene.textures.exists('ui') && ctx.scene.textures.get('ui').has(bgFrame)) {
        const bg = ctx.scene.add.image(0, 0, 'ui', bgFrame);
        bg.setDisplaySize(face, face);
        cell.add(bg);
    } else {
        cell.add(ctx.scene.add.rectangle(0, 0, face, face, 0x2a2a2a));
    }

    const iconFrame = `icon_item_${itemId}.png`;
    if (ctx.scene.textures.exists('icon') && ctx.scene.textures.get('icon').has(iconFrame)) {
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
    const guideWarn =
        itemId === 1103083 && isGuideStep(GuideStep.STORAGE_ITEM)
            ? addGuideWarn(ctx.scene, cell)
            : null;
    hit.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        if (!isScrollTap(scroll, pointer)) {
            return;
        }
        if (itemId === 1103083) {
            advanceGuide(GuideStep.STORAGE_ITEM);
            guideWarn?.destroy();
        }
        openItemDetailDialog(
            ctx.scene,
            createItemDetailModel(
                itemId,
                { kind: 'storage' },
                {
                    onToast: (msg) => ctx.showToast(msg),
                },
            ),
        );
    });
    scroll.trackHit({
        hit,
        local: cy,
        half: ITEM_CELL_PITCH_Y / 2,
    });
}
