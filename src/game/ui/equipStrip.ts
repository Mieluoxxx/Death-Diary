/**
 * Shared EquipNode strip + dropdown.
 * Used by gate / site storage / work loot (original EquipNode).
 */

import type { GameObjects } from 'phaser';
import { type EquipSlot, getItemDef, HAND_ITEM_ID, itemsForSlot } from '../data/itemConfig';
import { getSession, type ItemCounts } from '../session/sessionStore';
import { type EquipPos, EquipPosMap, equipItem, getCount } from '../systems/inventory';
import type { NodeMountContext } from './navigation';
import { UI_FONT_FAMILY, UI_FONT_SIZE, UI_TEXT_RESOLUTION } from './uiFont';
import { resolveItemName } from './nodes/itemGrid';

const SLOT_KIND: Record<EquipPos, EquipSlot> = {
    0: 'gun',
    1: 'weapon',
    2: 'equip',
    3: 'tool',
};

const EMPTY_SLOT_FRAME: Record<EquipPos, string> = {
    0: 'icon_tab_gun.png',
    1: 'icon_tab_weapon.png',
    2: 'icon_tab_equip.png',
    3: 'icon_tab_tool.png',
};

const EQUIP_W = 572;
const EQUIP_H = 100;
const TAB_BG_W = 110;
const TAB_BG_H = 73;
const TAB_COUNT = 4;
const LINE_H = 108;
const DROP_W = 520;
const DROP_VPAD = 10;

export type EquipStripHandle = {
    /** Bottom edge of equip strip in screen Y (for laying out content below). */
    bottomY: number;
    height: number;
    refresh: () => void;
    closeDropDown: () => void;
    destroy: () => void;
};

export type EquipStripOptions = {
    /**
     * Top edge of equip strip in screen Y.
     * Original: contentTopLine (770 from bg bottom).
     */
    topY: number;
    /** Original NPC exchange reads its cloned temporary bag. */
    getBagCounts?: () => ItemCounts;
    /** Called after a successful equip change. */
    onChanged?: () => void;
};

export function mountEquipStrip(ctx: NodeMountContext, opts: EquipStripOptions): EquipStripHandle {
    const padding = (EQUIP_W - TAB_COUNT * TAB_BG_W) / (TAB_COUNT + 1);
    const equipCx = ctx.width / 2;
    const equipCy = opts.topY + EQUIP_H / 2;
    const equipLeft = equipCx - EQUIP_W / 2;
    const equipBottom = opts.topY + EQUIP_H;

    type SlotIcon = {
        pos: EquipPos;
        icon: GameObjects.Image | null;
        bg: GameObjects.Image | GameObjects.Rectangle;
        x: number;
    };
    const slotIcons: SlotIcon[] = [];
    let openPos: EquipPos | null = null;
    let dropRoot: GameObjects.Container | null = null;
    let selectedCap: GameObjects.Image | GameObjects.Rectangle | null = null;
    const bagCounts = (): ItemCounts => opts.getBagCounts?.() ?? getSession()?.bag ?? {};

    ([0, 1, 2, 3] as EquipPos[]).forEach((pos, i) => {
        const x = equipLeft + padding * (i + 1) + TAB_BG_W * (i + 0.5);
        let bg: GameObjects.Image | GameObjects.Rectangle;
        if (
            ctx.scene.textures.exists('ui') &&
            ctx.scene.textures.get('ui').has('build_icon_bg.png')
        ) {
            bg = ctx.scene.add.image(x, equipCy, 'ui', 'build_icon_bg.png');
        } else {
            bg = ctx.scene.add.rectangle(x, equipCy, TAB_BG_W, TAB_BG_H, 0x3a3a3a);
        }
        ctx.content.add(bg);
        slotIcons.push({ pos, icon: null, bg, x });

        const hit = ctx.scene.add
            .rectangle(x, equipCy, TAB_BG_W, 90, 0xffffff, 0.001)
            .setInteractive({ useHandCursor: true });
        ctx.content.add(hit);
        hit.on('pointerup', () => onTabClick(pos));
    });

    const onTabClick = (pos: EquipPos): void => {
        if (openPos === pos) {
            closeDropDown();
            return;
        }
        openDropDown(pos);
    };

    const closeDropDown = (): void => {
        openPos = null;
        dropRoot?.destroy(true);
        dropRoot = null;
        if (selectedCap) {
            selectedCap.setVisible(false);
        }
    };

    const refreshEquipIcons = (): void => {
        const live = getSession();
        if (!live) {
            return;
        }
        for (const slot of slotIcons) {
            const id = live.equip[slot.pos] ?? 0;
            if (slot.icon) {
                slot.icon.destroy();
                slot.icon = null;
            }

            let frame = EMPTY_SLOT_FRAME[slot.pos];
            if (id === HAND_ITEM_ID) {
                frame = 'icon_tab_hand.png';
            } else if (id) {
                frame = `icon_tab_${id}.png`;
            }

            if (ctx.scene.textures.exists('gate') && ctx.scene.textures.get('gate').has(frame)) {
                const img = ctx.scene.add.image(slot.x, equipCy, 'gate', frame);
                ctx.content.add(img);
                slot.icon = img;
            }
        }
        if (dropRoot) {
            ctx.content.bringToTop(dropRoot);
        }
        if (selectedCap?.visible) {
            ctx.content.bringToTop(selectedCap);
            for (const slot of slotIcons) {
                if (slot.icon) {
                    ctx.content.bringToTop(slot.icon);
                }
            }
            if (dropRoot) {
                ctx.content.bringToTop(dropRoot);
            }
        }
    };

    const posOrOpen = (): EquipPos => openPos ?? EquipPosMap.WEAPON;

    const buildDropLine = (itemId: number, y: number): GameObjects.Container => {
        const line = ctx.scene.add.container(0, y);
        const left = -DROP_W / 2;

        const hit = ctx.scene.add
            .rectangle(0, 0, DROP_W - 8, LINE_H - 4, 0x555555, 0.001)
            .setInteractive({ useHandCursor: true });
        line.add(hit);
        hit.on('pointerover', () => hit.setFillStyle(0x555555, 0.55));
        hit.on('pointerout', () => hit.setFillStyle(0x555555, 0.001));
        hit.on('pointerup', () => {
            equipItem(posOrOpen(), itemId);
            closeDropDown();
            refreshEquipIcons();
            opts.onChanged?.();
        });

        if (itemId === 0) {
            line.add(
                ctx.scene.add
                    .text(0, 0, '无', {
                        fontFamily: UI_FONT_FAMILY,
                        resolution: UI_TEXT_RESOLUTION,
                        fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
                        color: '#ffffff',
                    })
                    .setOrigin(0.5),
            );
            return line;
        }

        const ICON_STRIP_W = 200;
        const contentIcon =
            itemId === HAND_ITEM_ID
                ? 'icon_tab_content_hand.png'
                : `icon_tab_content_${itemId}.png`;

        if (ctx.scene.textures.exists('gate') && ctx.scene.textures.get('gate').has(contentIcon)) {
            line.add(ctx.scene.add.image(left + 4, 0, 'gate', contentIcon).setOrigin(0, 0.5));
        } else if (
            itemId !== HAND_ITEM_ID &&
            ctx.scene.textures.exists('icon') &&
            ctx.scene.textures.get('icon').has(`icon_item_${itemId}.png`)
        ) {
            const icon = ctx.scene.add
                .image(left + ICON_STRIP_W / 2, 0, 'icon', `icon_item_${itemId}.png`)
                .setOrigin(0.5);
            const maxDim = Math.max(icon.width, icon.height, 1);
            icon.setScale(70 / maxDim);
            line.add(icon);
        } else if (
            itemId === HAND_ITEM_ID &&
            ctx.scene.textures.exists('gate') &&
            ctx.scene.textures.get('gate').has('icon_tab_hand.png')
        ) {
            line.add(ctx.scene.add.image(left + 55, 0, 'gate', 'icon_tab_hand.png').setOrigin(0.5));
        }

        const textX = left + ICON_STRIP_W + 8;
        const def = getItemDef(itemId);
        const name = itemId === HAND_ITEM_ID ? '拳头' : def.name || resolveItemName(itemId);
        const weight = itemId === HAND_ITEM_ID ? 0 : def.weight;
        const bagNum = itemId === HAND_ITEM_ID ? 0 : getCount(bagCounts(), itemId);
        const speed = itemId === HAND_ITEM_ID ? 1 : (def.effectWeapon?.atkCD ?? 0);
        const topY = -LINE_H / 2 + 10;
        line.add(
            ctx.scene.add
                .text(textX, topY, name, {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
                    color: '#ffffff',
                })
                .setOrigin(0, 0),
        );
        line.add(
            ctx.scene.add
                .text(textX, topY + 30, `重量:${weight}`, {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                    color: '#ffffff',
                })
                .setOrigin(0, 0),
        );
        line.add(
            ctx.scene.add
                .text(textX, topY + 54, `余量:${bagNum}`, {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                    color: '#ffffff',
                })
                .setOrigin(0, 0),
        );

        if (def.effectWeapon || itemId === HAND_ITEM_ID) {
            line.add(
                ctx.scene.add
                    .text(DROP_W / 2 - 16, topY + 30, `速度:${speed}`, {
                        fontFamily: UI_FONT_FAMILY,
                        resolution: UI_TEXT_RESOLUTION,
                        fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                        color: '#ffffff',
                    })
                    .setOrigin(1, 0),
            );
        }

        return line;
    };

    const openDropDown = (pos: EquipPos): void => {
        closeDropDown();
        openPos = pos;

        let list = itemsForSlot(SLOT_KIND[pos]).filter((id) => getCount(bagCounts(), id) > 0);
        if (pos === EquipPosMap.WEAPON) {
            list = [HAND_ITEM_ID, ...list];
        }
        if (list.length === 0) {
            list = [0];
        }
        const dropH = LINE_H * list.length + 2 * DROP_VPAD;
        const dropTop = equipBottom - 5;

        dropRoot = ctx.scene.add.container(equipCx, dropTop);
        dropRoot.setDepth(50);
        ctx.content.add(dropRoot);
        ctx.content.bringToTop(dropRoot);

        if (
            ctx.scene.textures.exists('gate') &&
            ctx.scene.textures.get('gate').has('frame_tab_content.png') &&
            typeof (ctx.scene.add as { nineslice?: unknown }).nineslice === 'function'
        ) {
            const panel = (ctx.scene.add as Phaser.GameObjects.GameObjectFactory).nineslice(
                0,
                0,
                'gate',
                'frame_tab_content.png',
                DROP_W,
                dropH,
                14,
                14,
                14,
                14,
            );
            panel.setOrigin(0.5, 0);
            dropRoot.add(panel);
        } else if (
            ctx.scene.textures.exists('gate') &&
            ctx.scene.textures.get('gate').has('frame_tab_content.png')
        ) {
            const panel = ctx.scene.add
                .image(0, 0, 'gate', 'frame_tab_content.png')
                .setOrigin(0.5, 0)
                .setDisplaySize(DROP_W, dropH);
            dropRoot.add(panel);
        } else {
            dropRoot.add(
                ctx.scene.add
                    .rectangle(0, dropH / 2, DROP_W, dropH, 0x222222, 0.98)
                    .setStrokeStyle(1, 0x555555),
            );
        }

        const tabSlot = slotIcons.find((s) => s.pos === pos);
        if (tabSlot) {
            const capY = equipCy + TAB_BG_H / 2;
            if (!selectedCap) {
                if (
                    ctx.scene.textures.exists('gate') &&
                    ctx.scene.textures.get('gate').has('frame_tab_head.png')
                ) {
                    selectedCap = ctx.scene.add
                        .image(tabSlot.x, capY, 'gate', 'frame_tab_head.png')
                        .setOrigin(0.5, 0);
                } else {
                    selectedCap = ctx.scene.add
                        .rectangle(tabSlot.x, capY, TAB_BG_W, 24, 0x222222)
                        .setOrigin(0.5, 0);
                }
                ctx.content.add(selectedCap);
            } else {
                selectedCap.setPosition(tabSlot.x, capY);
            }
            selectedCap.setVisible(true);
            ctx.content.bringToTop(selectedCap);
            for (const slot of slotIcons) {
                if (slot.icon) {
                    ctx.content.bringToTop(slot.icon);
                }
            }
            ctx.content.bringToTop(dropRoot);
        }

        list.forEach((itemId, index) => {
            const lineY = DROP_VPAD + index * LINE_H + LINE_H / 2;
            dropRoot?.add(buildDropLine(itemId, lineY));

            if (index > 0) {
                if (
                    ctx.scene.textures.exists('gate') &&
                    ctx.scene.textures.get('gate').has('frame_tab_line.png')
                ) {
                    const sep = ctx.scene.add.image(
                        0,
                        DROP_VPAD + index * LINE_H,
                        'gate',
                        'frame_tab_line.png',
                    );
                    sep.setDisplaySize(DROP_W - 40, 2);
                    dropRoot?.add(sep);
                } else {
                    dropRoot?.add(
                        ctx.scene.add.rectangle(
                            0,
                            DROP_VPAD + index * LINE_H,
                            DROP_W - 40,
                            1,
                            0xffffff,
                            0.35,
                        ),
                    );
                }
            }
        });
    };

    refreshEquipIcons();

    return {
        bottomY: equipBottom,
        height: EQUIP_H,
        refresh: refreshEquipIcons,
        closeDropDown,
        destroy: () => {
            closeDropDown();
            selectedCap?.destroy();
            selectedCap = null;
            for (const slot of slotIcons) {
                slot.icon?.destroy();
                slot.bg.destroy();
            }
        },
    };
}
