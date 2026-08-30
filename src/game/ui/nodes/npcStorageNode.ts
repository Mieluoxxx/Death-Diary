/** Original NpcStorageNode: equip strip + transactional bag/NPC exchange draft. */

import type { GameObjects } from 'phaser';
import { itemWeight } from '../../data/itemConfig';
import { getNpcDef, isNpcId, type NpcId } from '../../data/npcConfig';
import { getSession, type ItemCounts } from '../../session/sessionStore';
import { playEffect, Sound } from '../../systems/audioManager';
import { getBagCapacity, unequipByItemId } from '../../systems/inventory';
import {
    commitNpcTrade,
    getNpcState,
    getNpcTradeRate,
    type NpcActionResult,
} from '../../systems/npcSystem';
import { type AtlasButton, addAtlasButton } from '../atlasButton';
import { mountEquipStrip } from '../equipStrip';
import type { NodeMountContext, NodeMountResult } from '../navigation';
import { openQuantityDialog } from '../quantityDialog';
import { addSectionBar } from '../sectionBar';
import { UI_FONT_SIZE, uiTextStyle } from '../uiFont';
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
            ...uiTextStyle(UI_FONT_SIZE.COMMON_2 + 4),
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
            // 原版 Bag.decreaseItem：草稿把装备中物品扣空时立即真实卸下（拿回不自动装回）。
            if (!toBag && !draftBag[itemId]) {
                unequipByItemId(itemId);
            }
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
            ...uiTextStyle('COMMON_2'),
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
