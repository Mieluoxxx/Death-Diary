/**
 * BattleAndWorkNode — battle auto shell or work-room scavenge.
 * Visuals from original battleAndWorkNode: npc_dig_bg / monster_dig_* / pb_*.
 */

import { GameObjects } from 'phaser';
import { getSession } from '../../session/sessionStore';
import {
    currentRoom,
    fillTempLootFromRoom,
    roomEnd,
} from '../../systems/mapSystem';
import {
    clearBattle,
    forceEndBattle,
    getActiveBattle,
    startBattle,
    tickBattle,
} from '../../systems/battleSystem';
import type { NodeMountContext, NodeMountResult } from '../navigation';
import { NavNode } from '../navigation';
import {
    UI_FONT_FAMILY,
    UI_FONT_SIZE,
    UI_TEXT_RESOLUTION,
    uiWordWrap,
} from '../uiFont';
import { addAtlasButton } from '../atlasButton';

function hasFrame (ctx: NodeMountContext, atlas: string, frame: string): boolean
{
    return ctx.scene.textures.exists(atlas) && ctx.scene.textures.get(atlas).has(frame);
}

export function mountBattleNode (ctx: NodeMountContext): NodeMountResult
{
    const siteId = Number(ctx.userData);
    const room = currentRoom(siteId);

    if (!room)
    {
        ctx.setTitle('空房间');
        ctx.setLeftEnabled(true);
        ctx.setRightEnabled(false);
        ctx.content.add(
            ctx.scene.add
                .text(ctx.width / 2, ctx.height / 2, '没有可进入的房间', {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: '20px',
                    color: '#ccc',
                })
                .setOrigin(0.5),
        );
        return {
            onLeft: () => ctx.back(),
        };
    }

    if (room.type === 'work')
    {
        return mountWorkProcess(ctx, siteId);
    }

    return mountBattleProcess(ctx, siteId, room.monsters, room.difficulty);
}

function placeDigHeader (
    ctx: NodeMountContext,
    digFrame: string | null,
    digAtlas: string,
): number
{
    const contentTop = ctx.toScreenY(770);
    const digTop = contentTop - 12;
    let below = digTop + 40;

    // Base plate: npc_dig_bg when available (original battle begin).
    if (hasFrame(ctx, 'npc', 'npc_dig_bg.png'))
    {
        const plate = ctx.scene.add
            .image(ctx.width / 2, digTop, 'npc', 'npc_dig_bg.png')
            .setOrigin(0.5, 0);
        ctx.content.add(plate);
        below = plate.y + plate.displayHeight + 8;
    }

    if (hasFrame(ctx, 'dig_monster', 'monster_dig_mid_bg.png'))
    {
        const midY = hasFrame(ctx, 'npc', 'npc_dig_bg.png')
            ? digTop + 267 / 2
            : digTop + 115;
        const mid = ctx.scene.add
            .image(ctx.width / 2, midY, 'dig_monster', 'monster_dig_mid_bg.png')
            .setOrigin(0.5)
            .setScale(0.9);
        ctx.content.add(mid);
        below = Math.max(below, mid.y + mid.displayHeight / 2 + 12);
    }

    if (digFrame && hasFrame(ctx, digAtlas, digFrame))
    {
        const midY = hasFrame(ctx, 'npc', 'npc_dig_bg.png')
            ? digTop + 267 / 2
            : digTop + 115;
        const dig = ctx.scene.add
            .image(ctx.width / 2, midY, digAtlas, digFrame)
            .setOrigin(0.5)
            .setScale(0.9);
        ctx.content.add(dig);
        below = Math.max(below, dig.y + dig.displayHeight / 2 + 12);
    }

    return below;
}

function placeProgressBar (
    ctx: NodeMountContext,
    centerY: number,
): { setPct: (pct: number) => void; root: GameObjects.GameObject[] }
{
    const root: GameObjects.GameObject[] = [];
    let fill: GameObjects.Image | GameObjects.Rectangle | null = null;
    let fillMax = 264;

    if (hasFrame(ctx, 'ui', 'pb_bg.png'))
    {
        const bg = ctx.scene.add.image(ctx.width / 2, centerY, 'ui', 'pb_bg.png').setOrigin(0.5);
        ctx.content.add(bg);
        root.push(bg);
        fillMax = hasFrame(ctx, 'ui', 'pb.png')
            ? ctx.scene.textures.get('ui').get('pb.png').width
            : bg.width - 4;
        if (hasFrame(ctx, 'ui', 'pb.png'))
        {
            fill = ctx.scene.add
                .image(bg.x - fillMax / 2, centerY, 'ui', 'pb.png')
                .setOrigin(0, 0.5);
            fill.setCrop(0, 0, 1, fill.height);
            ctx.content.add(fill);
            root.push(fill);
        }
    }
    else
    {
        const bg = ctx.scene.add.rectangle(ctx.width / 2, centerY, 268, 17, 0x333333);
        ctx.content.add(bg);
        root.push(bg);
        fill = ctx.scene.add
            .rectangle(ctx.width / 2 - 132, centerY, 1, 13, 0xc4a35a)
            .setOrigin(0, 0.5);
        ctx.content.add(fill);
        root.push(fill);
        fillMax = 264;
    }

    return {
        root,
        setPct: (pct: number) =>
        {
            const p = Math.max(0, Math.min(1, pct));
            if (!fill)
            {
                return;
            }
            if ('setCrop' in fill && typeof fill.setCrop === 'function' && hasFrame(ctx, 'ui', 'pb.png'))
            {
                const img = fill as GameObjects.Image;
                const w = Math.max(1, Math.round(fillMax * p));
                img.setCrop(0, 0, w, img.height);
                img.setVisible(p > 0);
            }
            else
            {
                (fill as GameObjects.Rectangle).width = Math.max(1, fillMax * p);
            }
        },
    };
}

function mountWorkProcess (ctx: NodeMountContext, siteId: number): NodeMountResult
{
    ctx.setTitle('搜刮');
    ctx.setLeftEnabled(false);
    ctx.setRightEnabled(false);

    // Original work dig: work_dig_0/1/2 cycle-ish; use work_dig_1 as process art.
    const digFrame = hasFrame(ctx, 'dig_work', 'work_dig_1.png')
        ? 'work_dig_1.png'
        : hasFrame(ctx, 'dig_work', 'work_dig_0.png')
            ? 'work_dig_0.png'
            : null;
    const below = digFrame
        ? (() =>
        {
            const contentTop = ctx.toScreenY(770);
            const dig = ctx.scene.add
                .image(ctx.width / 2, contentTop - 12, 'dig_work', digFrame)
                .setOrigin(0.5, 0)
                .setScale(0.9);
            ctx.content.add(dig);
            return dig.y + dig.displayHeight + 16;
        })()
        : placeDigHeader(ctx, null, 'dig_work');

    ctx.content.add(
        ctx.scene.add
            .text(ctx.width / 2, below, '搜刮中…', {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
                color: '#f0e6d2',
            })
            .setOrigin(0.5, 0),
    );

    const barY = Math.min(below + 80, ctx.bgBottomY - 100);
    const bar = placeProgressBar(ctx, barY);
    bar.setPct(0);

    let progress = 0;
    let done = false;
    return {
        update: (deltaMs: number) =>
        {
            if (done)
            {
                return;
            }
            progress += deltaMs / 1800;
            if (progress >= 1)
            {
                progress = 1;
                done = true;
                bar.setPct(1);
                fillTempLootFromRoom(siteId);
                roomEnd(siteId, true);
                ctx.replace(NavNode.WORK_ROOM_STORAGE, siteId);
                return;
            }
            bar.setPct(progress);
        },
        destroy: () =>
        {
            // no-op
        },
    };
}

function mountBattleProcess (
    ctx: NodeMountContext,
    siteId: number,
    monsters: number[],
    difficulty: number,
): NodeMountResult
{
    ctx.setTitle('战斗');
    ctx.setLeftEnabled(false);
    ctx.setRightEnabled(false);

    clearBattle();
    startBattle(monsters);

    const digName = `monster_dig_${Math.max(1, Math.min(12, difficulty))}.png`;
    const below = placeDigHeader(ctx, digName, 'dig_monster');

    const logText = ctx.scene.add
        .text(ctx.width / 2, below, '', {
            fontFamily: UI_FONT_FAMILY,
            resolution: UI_TEXT_RESOLUTION,
            fontSize: '14px',
            color: '#dddddd',
            align: 'left',
            wordWrap: uiWordWrap(520),
        })
        .setOrigin(0.5, 0);
    ctx.content.add(logText);

    const monLines = ctx.scene.add
        .text(ctx.width / 2, below + 110, '', {
            fontFamily: UI_FONT_FAMILY,
            resolution: UI_TEXT_RESOLUTION,
            fontSize: '16px',
            color: '#ffffff',
            align: 'center',
        })
        .setOrigin(0.5, 0);
    ctx.content.add(monLines);

    const status = ctx.scene.add
        .text(ctx.width / 2, ctx.bgBottomY - 140, '自动战斗中…', {
            fontFamily: UI_FONT_FAMILY,
            resolution: UI_TEXT_RESOLUTION,
            fontSize: '18px',
            color: '#f0e6d2',
        })
        .setOrigin(0.5);
    ctx.content.add(status);

    const totalMon = monsters.length;
    const bar = placeProgressBar(ctx, ctx.bgBottomY - 90);
    bar.setPct(0);

    let finished = false;
    let resultShown = false;

    const showResult = (win: boolean) =>
    {
        if (resultShown)
        {
            return;
        }
        resultShown = true;
        finished = true;
        const sum = getActiveBattle()?.sum;
        status.setText(win ? '胜利！' : '失败…');
        if (win)
        {
            roomEnd(siteId, true);
        }
        const btn = addAtlasButton(ctx.scene, ctx.width / 2, ctx.bgBottomY - 50, {
            atlas: 'ui',
            frame: 'btn_common_white_normal.png',
            label: win ? '继续' : '撤退',
            onClick: () =>
            {
                clearBattle();
                ctx.back();
            },
        });
        ctx.scene.children.remove(btn);
        ctx.content.add(btn);
        if (sum)
        {
            logText.setText(
                sum.log.slice(-8).join('\n')
                + `\n击杀${sum.monsterKilled} 伤害${sum.playerHarm} 耗弹${sum.bulletsUsed}`,
            );
        }
    };

    return {
        update: (deltaMs: number) =>
        {
            if (finished)
            {
                return;
            }
            const battle = getActiveBattle();
            if (battle)
            {
                const alive = battle.monsters.filter((m) => m.hp > 0);
                monLines.setText(
                    alive
                        .map((m) => `${m.name} HP${Math.max(0, Math.ceil(m.hp))} 线${m.line}`)
                        .join('\n') || '……',
                );
                logText.setText(battle.sum.log.slice(-6).join('\n'));
                const session = getSession();
                status.setText(
                    `自动战斗中… HP ${session?.attrs.hp ?? 0}  弹 ${battle.bullets}`,
                );
                const killed = totalMon - alive.length;
                bar.setPct(totalMon > 0 ? killed / totalMon : 0);
            }
            const result = tickBattle(deltaMs / 1000);
            if (result)
            {
                bar.setPct(1);
                showResult(result.win);
            }
        },
        destroy: () =>
        {
            if (!finished && getActiveBattle()?.running)
            {
                forceEndBattle(false);
            }
            clearBattle();
        },
    };
}
