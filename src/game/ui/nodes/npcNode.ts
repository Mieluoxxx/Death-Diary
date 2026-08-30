/** NpcNode — original meeting page; trading lives in NpcStorageNode. */

import { getItemDef } from '../../data/itemConfig';
import { getNpcDef, isNpcId, type NpcId } from '../../data/npcConfig';
import { getSession } from '../../session/sessionStore';
import { gameBusOff, gameBusOn } from '../../systems/gameBus';
import {
    getNpcDialog,
    getNpcNeed,
    getNpcState,
    giveNpcNeed,
    type NpcActionResult,
} from '../../systems/npcSystem';
import { addAtlasButton } from '../atlasButton';
import type { NodeMountContext, NodeMountResult } from '../navigation';
import { NavNode } from '../navigation';
import { addNpcHearts } from '../npcHearts';
import { uiTextStyle, uiWordWrap } from '../uiFont';

const ACTION_BAR_Y = 803;
const CONTENT_TOP_Y = 770;

function failureMessage(result: NpcActionResult): string {
    if (result.ok) {
        return '';
    }
    switch (result.reason) {
        case 'no_session':
            return '存档未加载';
        case 'unknown_npc':
            return 'NPC不存在';
        case 'locked':
            return '尚未认识此人';
        case 'not_enough':
            return '物品数量不足';
        case 'max_reputation':
            return '好感度已满';
        case 'overweight':
            return '背包负重不足';
        case 'unfair_trade':
            return '对方不接受这笔交换';
    }
}

function itemTypeCount(counts: Record<number, number>): number {
    return Object.values(counts).filter((count) => count > 0).length;
}

function hasFrame(ctx: NodeMountContext, atlas: string, frame: string): boolean {
    return ctx.scene.textures.exists(atlas) && ctx.scene.textures.get(atlas).has(frame);
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
    ctx.setTitle(npc.name);
    ctx.setLeftEnabled(true);
    ctx.setRightEnabled(false);
    if (!state?.unlocked) {
        ctx.showToast('尚未认识此人');
        return { onLeft: () => ctx.back() };
    }

    const bgLeft = ctx.width / 2 - ctx.bgWidth / 2;
    const root = ctx.scene.add.container(0, 0).setName('npcMeetingPage');
    ctx.content.add(root);

    const hearts = addNpcHearts(
        ctx.scene,
        root,
        bgLeft + ctx.bgWidth - 40,
        ctx.bgBottomY - ACTION_BAR_Y,
        state.reputation,
        'npcHearts',
    );

    const portraitTop = ctx.bgBottomY - (CONTENT_TOP_Y - 20);
    const portrait = ctx.scene.add.container(ctx.width / 2, portraitTop).setName('npcPortrait');
    root.add(portrait);
    if (hasFrame(ctx, 'npc', 'npc_dig_bg.png')) {
        portrait.add(
            ctx.scene.add
                .image(0, 0, 'npc', 'npc_dig_bg.png')
                .setOrigin(0.5, 0)
                .setName('npcPortraitBackground'),
        );
    }
    const portraitFrame = `npc_dig_${npcId}.png`;
    if (hasFrame(ctx, 'npc', portraitFrame)) {
        portrait.add(
            ctx.scene.add
                .image(0, 267 / 2, 'npc', portraitFrame)
                .setOrigin(0.5)
                .setName('npcPortraitImage'),
        );
    }

    root.add(
        ctx.scene.add
            .text(ctx.width / 2, portraitTop + 267 + 20, getNpcDialog(npcId) ?? npc.des, {
                ...uiTextStyle('COMMON_3'),
                color: '#ffffff',
                align: 'center',
                wordWrap: uiWordWrap(ctx.bgWidth - 80),
            })
            .setOrigin(0.5, 0)
            .setName('npcDialog'),
    );

    const needText = ctx.scene.add
        .text(bgLeft + ctx.bgWidth / 4, ctx.bgBottomY - 130, '', {
            ...uiTextStyle('COMMON_3'),
            color: '#00ff00',
            align: 'center',
            wordWrap: uiWordWrap(260),
        })
        .setOrigin(0.5, 1)
        .setName('npcNeedText');
    root.add(needText);

    const tradeText = ctx.scene.add
        .text(bgLeft + (ctx.bgWidth / 4) * 3, ctx.bgBottomY - 130, '', {
            ...uiTextStyle('COMMON_3'),
            color: '#00ff00',
        })
        .setOrigin(0.5, 1)
        .setName('npcTradeText');
    root.add(tradeText);

    let refresh = () => {};
    const giveButton = addAtlasButton(ctx.scene, bgLeft + ctx.bgWidth / 4, ctx.bgBottomY - 100, {
        atlas: 'ui',
        frame: 'btn_common_white_normal.png',
        label: '给他',
        labelSizeTier: 'COMMON_2',
        enabled: state.reputation < 10,
        onClick: () => {
            const result = giveNpcNeed(npcId, 'bag');
            if (!result.ok) {
                ctx.showToast(failureMessage(result));
            }
            refresh();
        },
    }).setName('npcGiveButton');
    root.add(giveButton);

    const tradeButton = addAtlasButton(
        ctx.scene,
        bgLeft + (ctx.bgWidth / 4) * 3,
        ctx.bgBottomY - 100,
        {
            atlas: 'ui',
            frame: 'btn_common_white_normal.png',
            label: '交易',
            labelSizeTier: 'COMMON_2',
            onClick: () => ctx.forward(NavNode.NPC_STORAGE, npcId),
        },
    ).setName('npcTradeButton');
    root.add(tradeButton);

    refresh = () => {
        const live = getSession();
        const liveState = getNpcState(npcId);
        if (!live || !liveState) {
            return;
        }
        const need = getNpcNeed(npcId);
        needText.setText(
            need
                ? `给他${getItemDef(need.itemId).name}x${need.num}, 你有${live.bag[need.itemId] ?? 0}`
                : '暂无需求',
        );
        tradeText.setText(`交易物品: ${itemTypeCount(liveState.storage)}`);
        hearts.setReputation(liveState.reputation);
        if (liveState.reputation >= 10) {
            giveButton.hitTarget.disableInteractive();
            giveButton.hitTarget.setAlpha(0.45);
        }
    };
    refresh();
    const onSession = () => refresh();
    gameBusOn('session_updated', onSession);

    return {
        onLeft: () => ctx.back(),
        destroy: () => gameBusOff('session_updated', onSession),
    };
}
