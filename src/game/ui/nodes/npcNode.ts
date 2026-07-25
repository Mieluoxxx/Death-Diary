/**
 * NpcNode — dialog, reputation requests and value-based item exchange.
 */

import { getItemDef } from '../../data/itemConfig';
import { getNpcDef, isNpcId, type NpcId } from '../../data/npcConfig';
import { getSession, type ItemCounts } from '../../session/sessionStore';
import {
    commitNpcTrade,
    getNpcNeed,
    getNpcState,
    getNpcTradeRate,
    giveNpcNeed,
    type NpcActionResult,
} from '../../systems/npcSystem';
import { gameBusOff, gameBusOn } from '../../systems/gameBus';
import { addAtlasButton } from '../atlasButton';
import { createReadOnlyItemDetailModel } from '../itemDetailContext';
import { openItemDetailDialog } from '../itemDialog';
import type { NodeMountContext, NodeMountResult } from '../navigation';
import { mountItemGrid } from './itemGrid';
import { UI_FONT_FAMILY, UI_FONT_SIZE, UI_TEXT_RESOLUTION, uiWordWrap } from '../uiFont';

function addCount(counts: ItemCounts, itemId: number, amount: number): void {
    const next = (counts[itemId] ?? 0) + amount;
    if (next <= 0) {
        delete counts[itemId];
        return;
    }
    counts[itemId] = next;
}

function describeCounts(counts: ItemCounts): string {
    const text = Object.entries(counts)
        .filter(([, num]) => num > 0)
        .map(([id, num]) => `${getItemDef(Number(id)).name}x${num}`)
        .join('、');
    return text || '未选择';
}

function failureMessage(res: NpcActionResult): string {
    if (res.ok) {
        return '';
    }
    const messages: Record<Exclude<typeof res.reason, never>, string> = {
        no_session: '存档未加载',
        unknown_npc: 'NPC不存在',
        locked: '尚未认识此人',
        not_enough: '物品数量不足',
        max_reputation: '好感度已满',
        overweight: '背包负重不足',
        unfair_trade: '对方不接受这笔交换',
    };
    return messages[res.reason];
}

export function mountNpcNode(ctx: NodeMountContext): NodeMountResult {
    const rawNpcId = typeof ctx.userData === 'number' ? ctx.userData : Number(ctx.userData);
    if (!isNpcId(rawNpcId)) {
        ctx.setTitle('邻居');
        ctx.setLeftEnabled(true);
        ctx.setRightEnabled(false);
        return { onLeft: () => ctx.back() };
    }
    const npcId: NpcId = rawNpcId;
    const npc = getNpcDef(npcId)!;
    const state = getNpcState(npcId);
    ctx.setTitle(`${npc.name}家`);
    ctx.setLeftEnabled(true);
    ctx.setRightEnabled(false);
    if (!state?.unlocked) {
        ctx.showToast('尚未认识此人');
        return { onLeft: () => ctx.back() };
    }

    const bgLeft = ctx.width / 2 - ctx.bgWidth / 2;
    const top = ctx.bgBottomY - 760;
    const gridLeft = bgLeft + 23;
    const gridWidth = ctx.bgWidth - 46;
    const offer: ItemCounts = {};
    const requested: ItemCounts = {};

    const dialog = ctx.scene.add
        .text(
            ctx.width / 2,
            top + 12,
            npc.dialogs[state.tradingCount % npc.dialogs.length] ?? npc.des,
            {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                color: '#e8e0d0',
                align: 'center',
                wordWrap: uiWordWrap(ctx.bgWidth - 66),
            },
        )
        .setOrigin(0.5, 0);
    ctx.content.add(dialog);

    const reputationText = ctx.scene.add
        .text(bgLeft + 24, top + 93, '', {
            fontFamily: UI_FONT_FAMILY,
            resolution: UI_TEXT_RESOLUTION,
            fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
            color: '#f0df9d',
        })
        .setOrigin(0, 0.5);
    ctx.content.add(reputationText);

    const needText = ctx.scene.add
        .text(bgLeft + 24, top + 127, '', {
            fontFamily: UI_FONT_FAMILY,
            resolution: UI_TEXT_RESOLUTION,
            fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
            color: '#e8e0d0',
        })
        .setOrigin(0, 0.5);
    ctx.content.add(needText);

    const section = (y: number, title: string): void => {
        const bar = ctx.scene.add.rectangle(ctx.width / 2, y, ctx.bgWidth - 20, 40, 0xede4d3);
        const label = ctx.scene.add
            .text(bgLeft + 25, y, title, {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
                color: '#111111',
            })
            .setOrigin(0, 0.5);
        ctx.content.add([bar, label]);
    };

    section(top + 170, '对方物品（点选想要的物品）');
    const npcGrid = mountItemGrid(ctx.scene, ctx.content, {
        x: gridLeft,
        y: top + 195,
        width: gridWidth,
        height: 185,
        getCounts: () => getNpcState(npcId)?.storage ?? {},
        compact: true,
        emptyText: '对方今天没有可交换的物品',
        onTap: (itemId) => {
            const available = getNpcState(npcId)?.storage[itemId] ?? 0;
            if ((requested[itemId] ?? 0) >= available) {
                addCount(requested, itemId, -1);
            } else {
                addCount(requested, itemId, 1);
            }
            refresh();
        },
        onInspect: (itemId) => {
            const quantity = getNpcState(npcId)?.storage[itemId] ?? 0;
            openItemDetailDialog(ctx.scene, createReadOnlyItemDetailModel(itemId, quantity));
        },
    });

    section(top + 396, '你的背包（点选拿去交换的物品）');
    const bagGrid = mountItemGrid(ctx.scene, ctx.content, {
        x: gridLeft,
        y: top + 421,
        width: gridWidth,
        height: 185,
        getCounts: () => getSession()?.bag ?? {},
        compact: true,
        emptyText: '背包为空',
        onTap: (itemId) => {
            const available = getSession()?.bag[itemId] ?? 0;
            if ((offer[itemId] ?? 0) >= available) {
                addCount(offer, itemId, -1);
            } else {
                addCount(offer, itemId, 1);
            }
            refresh();
        },
        onInspect: (itemId) => {
            const quantity = getSession()?.bag[itemId] ?? 0;
            openItemDetailDialog(ctx.scene, createReadOnlyItemDetailModel(itemId, quantity));
        },
    });

    const draftText = ctx.scene.add
        .text(ctx.width / 2, top + 625, '', {
            fontFamily: UI_FONT_FAMILY,
            resolution: UI_TEXT_RESOLUTION,
            fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
            color: '#e8e0d0',
            align: 'center',
            wordWrap: uiWordWrap(ctx.bgWidth - 40),
        })
        .setOrigin(0.5, 0);
    ctx.content.add(draftText);

    const giveButton = addAtlasButton(ctx.scene, bgLeft + ctx.bgWidth - 73, top + 127, {
        atlas: 'ui',
        frame: 'btn_common_black_normal.png',
        label: '交付',
        labelColor: '#f5f0e6',
        labelSizeTier: 'COMMON_3',
        onClick: () => {
            const res = giveNpcNeed(npcId);
            if (!res.ok) {
                ctx.showToast(failureMessage(res));
            }
            refresh();
        },
    });
    ctx.scene.children.remove(giveButton);
    ctx.content.add(giveButton);

    const clearButton = addAtlasButton(ctx.scene, ctx.width / 2 - 104, ctx.bgBottomY - 34, {
        atlas: 'ui',
        frame: 'btn_common_white_normal.png',
        label: '清空',
        labelSizeTier: 'COMMON_3',
        onClick: () => {
            for (const id of Object.keys(offer)) delete offer[Number(id)];
            for (const id of Object.keys(requested)) delete requested[Number(id)];
            refresh();
        },
    });
    ctx.scene.children.remove(clearButton);
    ctx.content.add(clearButton);

    const tradeButton = addAtlasButton(ctx.scene, ctx.width / 2 + 104, ctx.bgBottomY - 34, {
        atlas: 'ui',
        frame: 'btn_common_white_normal.png',
        label: '交换',
        labelSizeTier: 'COMMON_3',
        onClick: () => {
            const res = commitNpcTrade(npcId, offer, requested);
            if (!res.ok) {
                ctx.showToast(failureMessage(res));
                return;
            }
            for (const id of Object.keys(offer)) delete offer[Number(id)];
            for (const id of Object.keys(requested)) delete requested[Number(id)];
            refresh();
        },
    });
    ctx.scene.children.remove(tradeButton);
    ctx.content.add(tradeButton);

    const refresh = () => {
        const liveState = getNpcState(npcId);
        const live = getSession();
        if (!liveState || !live) {
            return;
        }
        for (const [id, num] of Object.entries(offer)) {
            if (num > (live.bag[Number(id)] ?? 0)) addCount(offer, Number(id), -num);
        }
        for (const [id, num] of Object.entries(requested)) {
            if (num > (liveState.storage[Number(id)] ?? 0)) addCount(requested, Number(id), -num);
        }
        const need = getNpcNeed(npcId);
        reputationText.setText(`好感度 ${liveState.reputation}/10`);
        needText.setText(
            need ? `需要：${getItemDef(need.itemId).name} x${need.num}` : '需要：暂无请求',
        );
        draftText.setText(
            `给出：${describeCounts(offer)}\n换取：${describeCounts(requested)}  交换比 ${getNpcTradeRate(npcId, offer, requested).toFixed(2)}`,
        );
        dialog.setText(npc.dialogs[liveState.tradingCount % npc.dialogs.length] ?? npc.des);
        npcGrid.refresh();
        bagGrid.refresh();
    };
    refresh();
    const onSession = () => refresh();
    gameBusOn('session_updated', onSession);

    return {
        onLeft: () => ctx.back(),
        destroy: () => {
            gameBusOff('session_updated', onSession);
            npcGrid.destroy();
            bagGrid.destroy();
        },
    };
}
