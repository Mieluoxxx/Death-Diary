/**
 * GateNode — EquipNode dropdown + ItemChangeNode bag/storage.
 *
 * Equip: click tab → dropdown under tabs (original createDropDownView).
 *   empty list → "无"; weapon always has 拳头(HAND); lines show weight/余量/速度.
 */

import type { GameObjects } from 'phaser';
import {
    type EquipSlot,
    getItemDef,
    HAND_ITEM_ID,
    itemsForSlot,
} from '../../data/itemConfig';
import { getSession } from '../../session/sessionStore';
import { gameBusOff, gameBusOn } from '../../systems/gameBus';
import {
    type EquipPos,
    EquipPosMap,
    equipItem,
    getBagCapacity,
    getBagWeight,
    getCount,
    transferItems,
} from '../../systems/inventory';
import { playerOut } from '../../systems/mapSystem';
import type { NodeMountContext, NodeMountResult } from '../navigation';
import { NavNode } from '../navigation';
import {
    UI_FONT_FAMILY,
    UI_FONT_SIZE,
    UI_TEXT_RESOLUTION,
} from '../uiFont';
import {
    ITEM_GRID_COLUMNS,
    mountItemGrid,
    resolveItemName,
    transferFailMessage,
} from './itemGrid';

const SLOT_KIND: Record<EquipPos, EquipSlot> = {
    0: 'gun',
    1: 'weapon',
    2: 'equip',
    3: 'tool',
};

const LINE_H = 108;
const DROP_W = 520;
const DROP_VPAD = 10;

export function mountGateNode (ctx: NodeMountContext): NodeMountResult
{
    ctx.setTitle('大门');
    ctx.setLeftEnabled(true);
    ctx.setRightEnabled(true);

    const contentTop = ctx.toScreenY(770);
    const panelLeft = ctx.width / 2 - ctx.bgWidth / 2;
    const panelWidth = ctx.bgWidth;

    // EquipNode: 572×100, tab bg 110×73.
    const equipW = 572;
    const equipH = 100;
    const tabBgW = 110;
    const tabBgH = 73;
    const tabCount = 4;
    const padding = (equipW - tabCount * tabBgW) / (tabCount + 1);
    const equipCx = ctx.width / 2;
    const equipCy = contentTop + equipH / 2;
    const equipLeft = equipCx - equipW / 2;

    type SlotIcon = {
        pos: EquipPos;
        icon: GameObjects.Image | null;
        bg: GameObjects.Image | GameObjects.Rectangle;
        x: number;
    };
    const slotIcons: SlotIcon[] = [];
    let openPos: EquipPos | null = null;
    let dropRoot: GameObjects.Container | null = null;
    // Original selectedCap: frame_tab_head under active tab, connecting to dropdown.
    let selectedCap: GameObjects.Image | GameObjects.Rectangle | null = null;
    ([0, 1, 2, 3] as EquipPos[]).forEach((pos, i) =>
    {
        const x = equipLeft + padding * (i + 1) + tabBgW * (i + 0.5);
        let bg: GameObjects.Image | GameObjects.Rectangle;
        if (ctx.scene.textures.exists('ui') && ctx.scene.textures.get('ui').has('build_icon_bg.png'))
        {
            bg = ctx.scene.add.image(x, equipCy, 'ui', 'build_icon_bg.png');
        }
        else
        {
            bg = ctx.scene.add.rectangle(x, equipCy, tabBgW, tabBgH, 0x3a3a3a);
        }
        ctx.content.add(bg);
        slotIcons.push({ pos, icon: null, bg, x });

        const hit = ctx.scene.add
            .rectangle(x, equipCy, tabBgW, 90, 0xffffff, 0.001)
            .setInteractive({ useHandCursor: true });
        ctx.content.add(hit);
        hit.on('pointerup', () => onTabClick(pos));
    });

    // ItemChangeNode 50/50 bag vs storage.
    const changeTop = contentTop + equipH;
    const changeBottom = ctx.bgBottomY - 6;
    const changeH = Math.max(400, changeBottom - changeTop);
    const halfH = changeH / 2;
    const sectionH = 45;
    const gridWidth = 550;
    const gridLeft = panelLeft + (panelWidth - gridWidth) / 2;

    const bagSectionY = changeTop + sectionH / 2;
    addSectionBar(ctx, panelLeft, bagSectionY, panelWidth, '背包');
    const weightText = ctx.scene.add
        .text(panelLeft + panelWidth - 18, bagSectionY, '', {
            fontFamily: UI_FONT_FAMILY,
            resolution: UI_TEXT_RESOLUTION,
            fontSize: `${UI_FONT_SIZE.COMMON_2 + 4}px`,
            color: '#111111',
        })
        .setOrigin(1, 0.5);
    ctx.content.add(weightText);

    const bagGrid = mountItemGrid(ctx.scene, ctx.content, {
        x: gridLeft,
        y: changeTop + sectionH + 4,
        width: gridWidth,
        height: halfH - sectionH - 10,
        columns: ITEM_GRID_COLUMNS,
        getCounts: () => getSession()?.bag ?? {},
        emptyText: '',
        compact: true,
        onTap: (itemId) =>
        {
            closeDropDown();
            const res = transferItems('bag', 'storage', itemId, 1);
            if (!res.ok)
            {
                ctx.showToast(transferFailMessage(res));
            }
            refresh();
        },
    });

    const storageSectionY = changeTop + halfH + sectionH / 2;
    addSectionBar(ctx, panelLeft, storageSectionY, panelWidth, '仓库');

    const storageGrid = mountItemGrid(ctx.scene, ctx.content, {
        x: gridLeft,
        y: changeTop + halfH + sectionH + 4,
        width: gridWidth,
        height: halfH - sectionH - 10,
        columns: ITEM_GRID_COLUMNS,
        getCounts: () => getSession()?.storage ?? {},
        emptyText: '',
        compact: true,
        onTap: (itemId) =>
        {
            closeDropDown();
            const res = transferItems('storage', 'bag', itemId, 1);
            if (!res.ok)
            {
                ctx.showToast(transferFailMessage(res));
            }
            refresh();
        },
    });

    function onTabClick (pos: EquipPos): void
    {
        if (openPos === pos)
        {
            closeDropDown();
            return;
        }
        openDropDown(pos);
    }

    function closeDropDown (): void
    {
        openPos = null;
        dropRoot?.destroy(true);
        dropRoot = null;
        if (selectedCap)
        {
            selectedCap.setVisible(false);
        }
    }

    function openDropDown (pos: EquipPos): void
    {
        closeDropDown();
        openPos = pos;

        const session = getSession();
        if (!session)
        {
            return;
        }

        // Candidate ids for this slot (from bag) — original getItemsByType(130x).
        let list = itemsForSlot(SLOT_KIND[pos]).filter(
            (id) => getCount(session.bag, id) > 0,
        );
        if (pos === EquipPosMap.WEAPON)
        {
            list = [HAND_ITEM_ID, ...list];
        }
        // Empty → show "无" (id 0) — original string 1024.
        if (list.length === 0)
        {
            list = [0];
        }
        const dropH = LINE_H * list.length + 2 * DROP_VPAD;

        // EquipNode.createDropDownView: content anchor top @ (equipW/2, 5) in equip-local y-up.
        // ≈ just under equip strip bottom.
        const equipBottom = contentTop + equipH;
        const dropTop = equipBottom - 5;

        dropRoot = ctx.scene.add.container(equipCx, dropTop);
        dropRoot.setDepth(50);
        ctx.content.add(dropRoot);
        ctx.content.bringToTop(dropRoot);

        // frame_tab_content.png 31×31, scale9 inset 14 — dark sheet (#222).
        if (
            ctx.scene.textures.exists('gate')
            && ctx.scene.textures.get('gate').has('frame_tab_content.png')
            && 'add' in ctx.scene
            && typeof (ctx.scene.add as { nineslice?: unknown }).nineslice === 'function'
        )
        {
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
        }
        else if (
            ctx.scene.textures.exists('gate')
            && ctx.scene.textures.get('gate').has('frame_tab_content.png')
        )
        {
            const panel = ctx.scene.add
                .image(0, 0, 'gate', 'frame_tab_content.png')
                .setOrigin(0.5, 0)
                .setDisplaySize(DROP_W, dropH);
            dropRoot.add(panel);
        }
        else
        {
            // Fallback: original content fill ≈ #222222
            dropRoot.add(
                ctx.scene.add
                    .rectangle(0, dropH / 2, DROP_W, dropH, 0x222222, 0.98)
                    .setStrokeStyle(1, 0x555555),
            );
        }
        // selectedCap: frame_tab_head, Cocos anchor (0.5,1) at y = equipH/2 + tabH/2
        // → top of cap sits at bottom of tab, hanging into the dropdown.
        const tabSlot = slotIcons.find((s) => s.pos === pos);
        if (tabSlot)
        {
            const capY = equipCy + tabBgH / 2;
            if (!selectedCap)
            {
                if (
                    ctx.scene.textures.exists('gate')
                    && ctx.scene.textures.get('gate').has('frame_tab_head.png')
                )
                {
                    selectedCap = ctx.scene.add
                        .image(tabSlot.x, capY, 'gate', 'frame_tab_head.png')
                        .setOrigin(0.5, 0);
                }
                else
                {
                    selectedCap = ctx.scene.add
                        .rectangle(tabSlot.x, capY, tabBgW, 24, 0x222222)
                        .setOrigin(0.5, 0);
                }
                ctx.content.add(selectedCap);
            }
            else
            {
                selectedCap.setPosition(tabSlot.x, capY);
            }
            selectedCap.setVisible(true);
            // Cap under dropdown; tab icons stay readable above.
            ctx.content.bringToTop(selectedCap);
            for (const slot of slotIcons)
            {
                if (slot.icon)
                {
                    ctx.content.bringToTop(slot.icon);
                }
            }
            ctx.content.bringToTop(dropRoot);
        }

        list.forEach((itemId, index) =>
        {
            const lineY = DROP_VPAD + index * LINE_H + LINE_H / 2;
            const line = buildDropLine(itemId, lineY);
            dropRoot?.add(line);

            if (index > 0)
            {
                if (
                    ctx.scene.textures.exists('gate')
                    && ctx.scene.textures.get('gate').has('frame_tab_line.png')
                )
                {
                    const sep = ctx.scene.add.image(
                        0,
                        DROP_VPAD + index * LINE_H,
                        'gate',
                        'frame_tab_line.png',
                    );
                    sep.setDisplaySize(DROP_W - 40, 2);
                    dropRoot?.add(sep);
                }
                else
                {
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
    }

    function buildDropLine (itemId: number, y: number): GameObjects.Container
    {
        const line = ctx.scene.add.container(0, y);
        const left = -DROP_W / 2;

        // Full-row hit — original tab_content_btn_normal is transparent; pressed #555.
        const hit = ctx.scene.add
            .rectangle(0, 0, DROP_W - 8, LINE_H - 4, 0x555555, 0.001)
            .setInteractive({ useHandCursor: true });
        line.add(hit);
        hit.on('pointerover', () => hit.setFillStyle(0x555555, 0.55));
        hit.on('pointerout', () => hit.setFillStyle(0x555555, 0.001));
        hit.on('pointerup', () =>
        {
            equipItem(posOrOpen(), itemId);
            closeDropDown();
            refresh();
        });

        if (itemId === 0)
        {
            // Original string 1024: "无"
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

        // Left content icon is 200×80 (original icon_tab_content_*).
        // Text column starts immediately after that strip.
        const ICON_STRIP_W = 200;
        const contentIcon =
            itemId === HAND_ITEM_ID
                ? 'icon_tab_content_hand.png'
                : `icon_tab_content_${itemId}.png`;

        if (ctx.scene.textures.exists('gate') && ctx.scene.textures.get('gate').has(contentIcon))
        {
            line.add(
                ctx.scene.add
                    .image(left + 4, 0, 'gate', contentIcon)
                    .setOrigin(0, 0.5),
            );
        }
        else if (
            itemId !== HAND_ITEM_ID
            && ctx.scene.textures.exists('icon')
            && ctx.scene.textures.get('icon').has(`icon_item_${itemId}.png`)
        )
        {
            const icon = ctx.scene.add
                .image(left + ICON_STRIP_W / 2, 0, 'icon', `icon_item_${itemId}.png`)
                .setOrigin(0.5);
            const maxDim = Math.max(icon.width, icon.height, 1);
            icon.setScale(70 / maxDim);
            line.add(icon);
        }
        else if (
            itemId === HAND_ITEM_ID
            && ctx.scene.textures.exists('gate')
            && ctx.scene.textures.get('gate').has('icon_tab_hand.png')
        )
        {
            line.add(
                ctx.scene.add
                    .image(left + 55, 0, 'gate', 'icon_tab_hand.png')
                    .setOrigin(0.5),
            );
        }

        // Original: name at icon.right, weight/num stacked, 速度 on right.
        const textX = left + ICON_STRIP_W + 8;
        const def = getItemDef(itemId);
        const name =
            itemId === HAND_ITEM_ID ? '拳头' : (def.name || resolveItemName(itemId));
        const weight = itemId === HAND_ITEM_ID ? 0 : def.weight;
        const bagNum =
            itemId === HAND_ITEM_ID
                ? 0
                : getCount(getSession()?.bag ?? {}, itemId);
        const speed =
            itemId === HAND_ITEM_ID
                ? 1
                : (def.effectWeapon?.atkCD ?? 0);
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

        if (def.effectWeapon || itemId === HAND_ITEM_ID)
        {
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
    }

    function posOrOpen (): EquipPos
    {
        return openPos ?? EquipPosMap.WEAPON;
    }

    function refreshEquipIcons (): void
    {
        const live = getSession();
        if (!live)
        {
            return;
        }
        for (const slot of slotIcons)
        {
            const id = live.equip[slot.pos] ?? 0;
            if (slot.icon)
            {
                slot.icon.destroy();
                slot.icon = null;
            }

            let frame = '';
            if (id === HAND_ITEM_ID)
            {
                frame = 'icon_tab_hand.png';
            }
            else if (id)
            {
                frame = `icon_tab_${id}.png`;
            }
            else if (slot.pos === 0)
            {
                frame = 'icon_tab_gun.png';
            }
            else if (slot.pos === 1)
            {
                frame = 'icon_tab_weapon.png';
            }
            else if (slot.pos === 2)
            {
                frame = 'icon_tab_equip.png';
            }
            else
            {
                frame = 'icon_tab_tool.png';
            }

            if (ctx.scene.textures.exists('gate') && ctx.scene.textures.get('gate').has(frame))
            {
                const img = ctx.scene.add.image(slot.x, equipCy, 'gate', frame);
                ctx.content.add(img);
                slot.icon = img;
            }
        }
        // Keep dropdown above refreshed icons.
        if (dropRoot)
        {
            ctx.content.bringToTop(dropRoot);
        }
    }

    function refresh (): void
    {
        const live = getSession();
        if (!live)
        {
            return;
        }
        const cur = getBagWeight(live);
        const max = getBagCapacity(live);
        weightText.setText(`重量 ${cur}/${max}`);
        weightText.setColor(cur >= max ? '#aa0000' : '#111111');
        refreshEquipIcons();
        bagGrid.refresh();
        storageGrid.refresh();
    }

    refresh();
    const onSession = () => refresh();
    gameBusOn('session_updated', onSession);

    return {
        onLeft: () =>
        {
            closeDropDown();
            ctx.back();
        },
        onRight: () =>
        {
            closeDropDown();
            playerOut();
            ctx.forward(NavNode.GATE_OUT);
        },
        destroy: () =>
        {
            gameBusOff('session_updated', onSession);
            closeDropDown();
            selectedCap?.destroy();
            selectedCap = null;
            for (const slot of slotIcons)
            {
                slot.icon?.destroy();
            }
            bagGrid.destroy();
            storageGrid.destroy();
        },
    };
}

function addSectionBar (
    ctx: NodeMountContext,
    left: number,
    centerY: number,
    width: number,
    title: string,
): void
{
    const cx = left + width / 2;
    if (ctx.scene.textures.exists('ui') && ctx.scene.textures.get('ui').has('frame_section_bg.png'))
    {
        const bar = ctx.scene.add.image(cx, centerY, 'ui', 'frame_section_bg.png');
        bar.setDisplaySize(Math.min(width - 8, 584), 45);
        ctx.content.add(bar);
    }
    else
    {
        ctx.content.add(
            ctx.scene.add.rectangle(cx, centerY, width - 8, 45, 0xe8e0d0),
        );
    }
    ctx.content.add(
        ctx.scene.add
            .text(left + 18, centerY, title, {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
                color: '#111111',
            })
            .setOrigin(0, 0.5),
    );
}
