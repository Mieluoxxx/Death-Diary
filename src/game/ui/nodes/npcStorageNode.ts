/** Original NpcStorageNode: equip strip + transactional bag/NPC exchange draft. */

import type { GameObjects, Scene } from 'phaser';
import { ITEM_STRINGS } from '../../data/buildStrings';
import { getItemDef, itemWeight } from '../../data/itemConfig';
import { getNpcDef, isNpcId, type NpcId } from '../../data/npcConfig';
import { getSession, type ItemCounts } from '../../session/sessionStore';
import { playEffect, Sound } from '../../systems/audioManager';
import { getBagCapacity } from '../../systems/inventory';
import {
    commitNpcTrade,
    getNpcState,
    getNpcTradeRate,
    type NpcActionResult,
} from '../../systems/npcSystem';
import { type AtlasButton, addAtlasButton } from '../atlasButton';
import { mountEquipStrip } from '../equipStrip';
import type { NodeMountContext, NodeMountResult } from '../navigation';
import { addSectionBar } from '../sectionBar';
import { UI_FONT_FAMILY, UI_FONT_SIZE, UI_TEXT_RESOLUTION, uiWordWrap } from '../uiFont';
import { ITEM_GRID_COLUMNS, mountItemGrid } from './itemGrid';

const RATE_LABELS = [
    '你太豪爽了！！',
    '你很慷慨！',
    '这是个公平的交易。',
    '差点儿。',
    '完全无法接受！',
    '开什么玩笑！！',
] as const;

function cloneCounts(counts: ItemCounts): ItemCounts {
    return { ...counts };
}

function setCount(counts: ItemCounts, itemId: number, amount: number): void {
    if (amount <= 0) {
        delete counts[itemId];
    } else {
        counts[itemId] = amount;
    }
}

function moveCount(from: ItemCounts, to: ItemCounts, itemId: number, amount: number): number {
    const moved = Math.min(Math.max(0, amount), from[itemId] ?? 0);
    if (moved <= 0) return 0;
    setCount(from, itemId, (from[itemId] ?? 0) - moved);
    setCount(to, itemId, (to[itemId] ?? 0) + moved);
    return moved;
}

function countsWeight(counts: ItemCounts): number {
    return Object.entries(counts).reduce(
        (total, [id, amount]) => total + itemWeight(Number(id)) * amount,
        0,
    );
}

function tradeDiff(
    originalBag: ItemCounts,
    draftBag: ItemCounts,
): { offer: ItemCounts; requested: ItemCounts } {
    const offer: ItemCounts = {};
    const requested: ItemCounts = {};
    const ids = new Set([...Object.keys(originalBag), ...Object.keys(draftBag)].map(Number));
    for (const itemId of ids) {
        const delta = (draftBag[itemId] ?? 0) - (originalBag[itemId] ?? 0);
        if (delta > 0) requested[itemId] = delta;
        if (delta < 0) offer[itemId] = -delta;
    }
    return { offer, requested };
}

function rateLabel(rate: number): string {
    if (rate >= 1.3) return RATE_LABELS[0];
    if (rate >= 1.1) return RATE_LABELS[1];
    if (rate >= 1) return RATE_LABELS[2];
    if (rate >= 0.9) return RATE_LABELS[3];
    if (rate >= 0.7) return RATE_LABELS[4];
    return RATE_LABELS[5];
}

function failureMessage(result: NpcActionResult): string {
    if (result.ok) return '';
    if (result.reason === 'overweight') return '背包负重不足';
    if (result.reason === 'unfair_trade') return '对方不接受这笔交换';
    if (result.reason === 'not_enough') return '物品数量不足';
    return '无法完成交易';
}

function openQuantityDialog(
    scene: Scene,
    itemId: number,
    max: number,
    onConfirm: (amount: number) => void,
): GameObjects.Container {
    const existing = scene.children.list.find(
        (child) => (child as GameObjects.Container).name === 'npcTradeQuantityDialog',
    );
    existing?.destroy(true);

    const { width, height } = scene.scale;
    const root = scene.add.container(0, 0).setDepth(320).setName('npcTradeQuantityDialog');
    root.add(
        scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72).setInteractive(),
    );

    // Original DialogBig: 448x625, title 90px, action 72px.
    const panelW = 448;
    const panelH = 625;
    const cocosBgBottom = 29 + (839 - panelH) / 2;
    const bgBottom = height - cocosBgBottom;
    const bgTop = bgBottom - panelH;
    const cx = width / 2;
    const cy = bgTop + panelH / 2;
    if (scene.textures.exists('ui') && scene.textures.get('ui').has('dialog_big_bg.png')) {
        root.add(scene.add.image(cx, cy, 'ui', 'dialog_big_bg.png').setDisplaySize(panelW, panelH));
    } else {
        root.add(scene.add.rectangle(cx, cy, panelW, panelH, 0xe8e0d0).setStrokeStyle(2, 0x222222));
    }

    const item = getItemDef(itemId);
    const textLeft = cx - panelW / 2 + 20;
    const iconFrame = `icon_item_${itemId}.png`;
    let titleX = textLeft;
    if (scene.textures.exists('icon') && scene.textures.get('icon').has(iconFrame)) {
        const icon = scene.add.image(textLeft, bgTop + 41, 'icon', iconFrame).setOrigin(0, 0.5);
        root.add(icon);
        titleX += icon.displayWidth + 8;
    }
    root.add(
        scene.add
            .text(titleX, bgTop + 18, item.name, {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${UI_FONT_SIZE.COMMON_1}px`,
                color: '#111111',
            })
            .setOrigin(0, 0),
    );
    const quantity = scene.add
        .text(titleX, bgTop + 58, '', {
            fontFamily: UI_FONT_FAMILY,
            resolution: UI_TEXT_RESOLUTION,
            fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
            color: '#111111',
        })
        .setOrigin(0, 0);
    root.add(quantity);

    const description = ITEM_STRINGS[String(itemId)]?.des;
    const digFrame = `dig_item_${itemId}.png`;
    let descriptionY = bgTop + 105;
    if (scene.textures.exists('dig_item') && scene.textures.get('dig_item').has(digFrame)) {
        const dig = scene.add.image(cx, bgTop + 105, 'dig_item', digFrame).setOrigin(0.5, 0);
        if (dig.width > panelW - 40) dig.setScale((panelW - 40) / dig.width);
        root.add(dig);
        descriptionY = dig.y + dig.displayHeight + 12;
    }
    if (description) {
        root.add(
            scene.add
                .text(textLeft, descriptionY, description, {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                    color: '#111111',
                    wordWrap: uiWordWrap(panelW - 40),
                    lineSpacing: 4,
                })
                .setOrigin(0, 0),
        );
    }

    const trackY = bgBottom - 112;
    const trackW = 316;
    if (scene.textures.exists('ui') && scene.textures.get('ui').has('slider_bg.png')) {
        root.add(scene.add.image(cx, trackY, 'ui', 'slider_bg.png'));
        root.add(scene.add.image(cx, trackY, 'ui', 'slider_content.png'));
    } else {
        root.add(scene.add.rectangle(cx, trackY, trackW, 15, 0x777777));
    }

    let value = 1;
    const cap =
        scene.textures.exists('ui') && scene.textures.get('ui').has('slider_cap.png')
            ? scene.add.image(cx - trackW / 2, trackY, 'ui', 'slider_cap.png')
            : scene.add.circle(cx - trackW / 2, trackY, 18, 0x222222);
    cap.setInteractive({ draggable: true, useHandCursor: true });
    scene.input.setDraggable(cap);
    root.add(cap);

    const update = (pointerX: number) => {
        const ratio = Math.max(0, Math.min(1, (pointerX - (cx - trackW / 2)) / trackW));
        value = Math.max(1, Math.round(1 + ratio * (max - 1)));
        const valueRatio = max <= 1 ? 0 : (value - 1) / (max - 1);
        cap.setX(cx - trackW / 2 + valueRatio * trackW);
        quantity.setText(`数量 ${value}/${max}  重量 ${item.weight * value}`);
    };
    update(cx - trackW / 2);
    cap.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number) => update(dragX));
    const trackHit = scene.add
        .rectangle(cx, trackY, trackW + 36, 52, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true });
    trackHit.on('pointerdown', (pointer: Phaser.Input.Pointer) => update(pointer.x));
    root.add(trackHit);
    root.bringToTop(cap);

    root.list[0]?.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        if (
            pointer.x < cx - panelW / 2 ||
            pointer.x > cx + panelW / 2 ||
            pointer.y < bgTop ||
            pointer.y > bgBottom
        ) {
            root.destroy(true);
        }
    });

    const confirm = addAtlasButton(scene, cx, bgBottom - 36, {
        atlas: 'ui',
        frame: 'btn_common_black_normal.png',
        label: '确定',
        labelColor: '#f5f0e6',
        onClick: () => {
            root.destroy(true);
            onConfirm(value);
        },
    });
    confirm.setName('npcTradeQuantityConfirm');
    root.add(confirm);
    return root;
}

export function mountNpcStorageNode(ctx: NodeMountContext): NodeMountResult {
    const rawNpcId = typeof ctx.userData === 'number' ? ctx.userData : Number(ctx.userData);
    if (!isNpcId(rawNpcId)) {
        ctx.setTitle('邻居');
        ctx.setLeftEnabled(true);
        ctx.setRightEnabled(false);
        return { onLeft: () => ctx.back() };
    }
    const npcId: NpcId = rawNpcId;
    const npc = getNpcDef(npcId)!;
    const session = getSession();
    const npcState = getNpcState(npcId);
    ctx.setTitle(npc.name);
    ctx.setLeftEnabled(true);
    ctx.setRightEnabled(false);
    if (!session || !npcState?.unlocked) {
        return { onLeft: () => ctx.back() };
    }
    const activeSession = session;

    playEffect(Sound.EXCHANGE);
    const originalBag = cloneCounts(session.bag);
    const originalNpcStorage = cloneCounts(npcState.storage);
    const draftBag = cloneCounts(originalBag);
    const draftNpcStorage = cloneCounts(originalNpcStorage);
    let didMove = false;
    let quantityDialog: GameObjects.Container | null = null;

    const bgLeft = ctx.width / 2 - ctx.bgWidth / 2;
    const bgBottom = ctx.bgBottomY;
    const contentTopY = bgBottom - 770;
    const equip = mountEquipStrip(ctx, {
        topY: contentTopY,
        getBagCounts: () => draftBag,
    });

    const changeH = 670;
    const changeTopY = bgBottom - changeH;
    const halfH = changeH / 2;
    const sectionH = 45;
    const gridWidth = 550;
    const gridLeft = bgLeft + (ctx.bgWidth - gridWidth) / 2;

    const bagSectionY = changeTopY + sectionH / 2;
    addSectionBar(ctx, bgLeft, bagSectionY, ctx.bgWidth, '背包');
    const weightText = ctx.scene.add
        .text(bgLeft + ctx.bgWidth - 18, bagSectionY, '', {
            fontFamily: UI_FONT_FAMILY,
            resolution: UI_TEXT_RESOLUTION,
            fontSize: `${UI_FONT_SIZE.COMMON_2 + 4}px`,
            color: '#111111',
        })
        .setOrigin(1, 0.5);
    ctx.content.add(weightText);

    const move = (
        from: ItemCounts,
        to: ItemCounts,
        itemId: number,
        amount: number,
        toBag: boolean,
    ) => {
        const available = from[itemId] ?? 0;
        const requested = Math.min(amount, available);
        if (requested <= 0) return;
        if (toBag) {
            const extraWeight = itemWeight(itemId) * requested;
            if (countsWeight(draftBag) + extraWeight > getBagCapacity(activeSession)) {
                ctx.showToast('背包负重不足');
                return;
            }
        }
        if (moveCount(from, to, itemId, requested) > 0) {
            didMove = true;
            refresh();
        }
    };

    const bagGrid = mountItemGrid(ctx.scene, ctx.content, {
        x: gridLeft,
        y: changeTopY + sectionH + 4,
        width: gridWidth,
        height: halfH - sectionH - 14,
        columns: ITEM_GRID_COLUMNS,
        getCounts: () => draftBag,
        emptyText: '',
        compact: true,
        onTap: (itemId) => move(draftBag, draftNpcStorage, itemId, 1, false),
        onInspect: (itemId) => {
            quantityDialog = openQuantityDialog(
                ctx.scene,
                itemId,
                draftBag[itemId] ?? 1,
                (amount) => move(draftBag, draftNpcStorage, itemId, amount, false),
            );
        },
    });
    bagGrid.root.setName('npcTradeBagGrid');

    const npcSectionY = changeTopY + halfH + sectionH / 2;
    addSectionBar(ctx, bgLeft, npcSectionY, ctx.bgWidth, npc.name);
    const rateText = ctx.scene.add
        .text(bgLeft + ctx.bgWidth - 188, npcSectionY, '', {
            fontFamily: UI_FONT_FAMILY,
            resolution: UI_TEXT_RESOLUTION,
            fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
            color: '#111111',
        })
        .setOrigin(1, 0.5)
        .setName('npcTradeRate');
    ctx.content.add(rateText);

    let tradeEnabled = false;
    const tradeButton: AtlasButton = addAtlasButton(
        ctx.scene,
        bgLeft + ctx.bgWidth - 99,
        npcSectionY,
        {
            atlas: 'ui',
            frame: 'btn_common_black_normal.png',
            label: '交易',
            labelColor: '#f5f0e6',
            labelSizeTier: 'COMMON_3',
            onClick: () => {
                if (!tradeEnabled) return;
                const { offer, requested } = tradeDiff(originalBag, draftBag);
                const result = commitNpcTrade(npcId, offer, requested);
                if (!result.ok) {
                    ctx.showToast(failureMessage(result));
                    return;
                }
                ctx.back();
            },
        },
    );
    tradeButton.setName('npcTradeConfirm');
    ctx.scene.children.remove(tradeButton);
    ctx.content.add(tradeButton);

    const npcGrid = mountItemGrid(ctx.scene, ctx.content, {
        x: gridLeft,
        y: changeTopY + halfH + sectionH + 4,
        width: gridWidth,
        height: halfH - sectionH - 14,
        columns: ITEM_GRID_COLUMNS,
        getCounts: () => draftNpcStorage,
        emptyText: '',
        compact: true,
        onTap: (itemId) => move(draftNpcStorage, draftBag, itemId, 1, true),
        onInspect: (itemId) => {
            quantityDialog = openQuantityDialog(
                ctx.scene,
                itemId,
                draftNpcStorage[itemId] ?? 1,
                (amount) => move(draftNpcStorage, draftBag, itemId, amount, true),
            );
        },
    });
    npcGrid.root.setName('npcTradeNpcGrid');

    function refresh(): void {
        weightText.setText(`重量 ${countsWeight(draftBag)}/${getBagCapacity(activeSession)}`);
        const { offer, requested } = tradeDiff(originalBag, draftBag);
        const rate = didMove ? getNpcTradeRate(npcId, offer, requested) : 0;
        rateText.setText(didMove ? rateLabel(rate) : '');
        tradeEnabled = didMove && rate >= 1;
        if (tradeEnabled) {
            tradeButton.hitTarget.setInteractive({ useHandCursor: true }).setAlpha(1);
        } else {
            tradeButton.hitTarget.disableInteractive().setAlpha(0.45);
        }
        equip.refresh();
        bagGrid.refresh();
        npcGrid.refresh();
    }
    refresh();

    return {
        onLeft: () => {
            quantityDialog?.destroy(true);
            ctx.back();
        },
        destroy: () => {
            quantityDialog?.destroy(true);
            equip.destroy();
            bagGrid.destroy();
            npcGrid.destroy();
        },
    };
}
