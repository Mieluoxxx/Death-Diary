/**
 * Auto-battle shell for site rooms.
 * Ports Battle.js subset: 6 distance lines, approach logs (1046),
 * original attack/damage/death strings, gun/melee auto.
 */

import {
    BULLET_ID,
    HAND_ITEM_ID,
    getItemDef,
} from '../data/itemConfig';
import { getMonsterDef, monsterTypeName } from '../data/monsterConfig';
import {
    getSession,
    mutateSession,
    appendSessionLog,
} from '../session/sessionStore';
import {
    EquipPosMap,
    getArmorDef,
    getBagCount,
} from './inventory';
import { gameBusEmit } from './gameBus';
import { pauseTimeClock, resumeTimeClock } from './timeClock';
import { changeAttr } from './playerAttrs';

export type BattleLogEntry = {
    text: string;
    /** '#rrggbb' or empty for white */
    color?: string;
};

export type BattleMonster = {
    id: number;
    /** prefix adjective, e.g. 朽坏的 */
    prefix: string;
    hp: number;
    maxHp: number;
    attack: number;
    /** Distance line 0..5 (0 = melee). */
    line: number;
    speed: number;
    attackSpeed: number;
    attackCooldown: number;
    dead: boolean;
};

export type BattleSumRes = {
    win: boolean;
    monsterKilled: number;
    playerHarm: number;
    bulletsUsed: number;
    meleeHits: number;
    gunHits: number;
    /** Structured logs (color). Also mirrored as plain strings in `log`. */
    entries: BattleLogEntry[];
    log: string[];
};

export type BattleState = {
    monsters: BattleMonster[];
    /** Alive queue order (target = first alive). */
    bullets: number;
    gunId: number;
    weaponId: number;
    def: number;
    running: boolean;
    finished: boolean;
    sum: BattleSumRes;
    playerCd: number;
    moveAcc: number;
};

let activeBattle: BattleState | null = null;

export function getActiveBattle (): BattleState | null
{
    return activeBattle;
}

function pushLog (battle: BattleState, text: string, color?: string): void
{
    battle.sum.entries.push({ text, color });
    battle.sum.log.push(text);
}

function targetMonster (battle: BattleState): BattleMonster | undefined
{
    return battle.monsters.find((m) => !m.dead && m.hp > 0);
}

export function startBattle (monsterIds: number[]): BattleState
{
    const session = getSession();
    if (!session)
    {
        throw new Error('startBattle: no session');
    }

    const gunId = session.equip[EquipPosMap.GUN] ?? 0;
    const weaponId = session.equip[EquipPosMap.WEAPON] ?? HAND_ITEM_ID;
    const bullets = getBagCount(BULLET_ID);
    const def = getArmorDef(session);

    // Original: first monster starts at last free line (5); others enter later.
    const monsters: BattleMonster[] = monsterIds.map((id, index) =>
    {
        const defM = getMonsterDef(id);
        return {
            id,
            prefix: monsterTypeName(defM.prefixType),
            hp: defM.hp,
            maxHp: defM.hp,
            attack: defM.attack,
            // Stagger spawn lines: first at 5, rest wait off-map as 5+index.
            line: Math.min(5, 5 - Math.min(index, 2)),
            speed: defM.speed,
            attackSpeed: defM.attackSpeed,
            attackCooldown: 0,
            dead: false,
        };
    });

    activeBattle = {
        monsters,
        bullets,
        gunId,
        weaponId,
        def,
        running: true,
        finished: false,
        playerCd: 0.1,
        moveAcc: 0,
        sum: {
            win: false,
            monsterKilled: 0,
            playerHarm: 0,
            bulletsUsed: 0,
            meleeHits: 0,
            gunHits: 0,
            entries: [],
            log: [],
        },
    };

    // 1045: "%s个僵尸发现了你！"
    pushLog(activeBattle, `${monsterIds.length}个僵尸发现了你！`);
    // Initial approach of the lead target.
    const lead = targetMonster(activeBattle);
    if (lead)
    {
        // 1046: "%s僵尸向你靠近！距离%s"
        pushLog(activeBattle, `${lead.prefix}僵尸向你靠近！距离${lead.line}`);
    }

    pauseTimeClock();
    gameBusEmit('battle_started');
    return activeBattle;
}

/**
 * Advance battle by real seconds.
 * Monster move tick ~1s (original scheduleCallback 1s).
 * Player action tick ~0.1s.
 */
export function tickBattle (realDelta: number): BattleSumRes | null
{
    const battle = activeBattle;
    const session = getSession();
    if (!battle || !battle.running || !session || realDelta <= 0)
    {
        return battle?.finished ? battle.sum : null;
    }

    // --- Monster movement (1s) ---
    battle.moveAcc += realDelta;
    while (battle.moveAcc >= 1)
    {
        battle.moveAcc -= 1;
        for (const mon of battle.monsters)
        {
            if (mon.dead || mon.hp <= 0)
            {
                continue;
            }
            if (mon.line > 0)
            {
                const prev = mon.line;
                mon.line = Math.max(0, mon.line - mon.speed);
                // Log approach only for current target (original).
                const target = targetMonster(battle);
                if (target === mon && mon.line !== prev)
                {
                    pushLog(battle, `${mon.prefix}僵尸向你靠近！距离${mon.line}`);
                }
            }
            else
            {
                // At line 0: attack on attackSpeed cadence.
                mon.attackCooldown -= 1;
                if (mon.attackCooldown <= 0)
                {
                    const harm = Math.max(1, mon.attack - battle.def);
                    changeAttr('hp', -harm);
                    changeAttr('injury', 1);
                    battle.sum.playerHarm += harm;
                    mon.attackCooldown = mon.attackSpeed;
                    // 1047 red
                    pushLog(
                        battle,
                        `${mon.prefix}僵尸击中了你，生命值：-${harm}`,
                        '#ff3333',
                    );
                    const live = getSession();
                    if (!live || live.attrs.hp <= 0 || live.isDead)
                    {
                        // 1057
                        pushLog(battle, '流血过多，你不省人事');
                        return endBattle(false);
                    }
                }
            }
        }
    }

    // --- Player attacks ---
    battle.playerCd -= realDelta;
    if (battle.playerCd <= 0)
    {
        const target = targetMonster(battle);
        if (!target)
        {
            return endBattle(true);
        }

        let acted = false;

        // Gun first if in range + ammo
        if (battle.gunId && battle.bullets > 0)
        {
            const gunDef = getItemDef(battle.gunId);
            const gun = gunDef.effectWeapon;
            const bulletAtk = getItemDef(BULLET_ID).effectWeapon?.atk ?? 50;
            if (gun && target.line <= gun.range)
            {
                const hit = Math.random() < gun.precise;
                battle.bullets -= 1;
                battle.sum.bulletsUsed += 1;
                // 1048: 你使用%s向%s僵尸射击
                pushLog(battle, `你使用${gunDef.name}向${target.prefix}僵尸射击`);
                if (hit)
                {
                    const dmg = bulletAtk;
                    target.hp -= dmg;
                    battle.sum.gunHits += 1;
                    // 1052
                    pushLog(battle, `${target.prefix}僵尸受到${dmg}点伤害`);
                    if (target.hp <= 0)
                    {
                        killMonster(battle, target);
                    }
                }
                else
                {
                    // 1054
                    pushLog(battle, 'miss');
                }
                battle.playerCd = gun.atkCD;
                acted = true;
            }
        }

        // Melee at line 0
        if (!acted)
        {
            const weaponId = battle.weaponId || HAND_ITEM_ID;
            const weaponDef = getItemDef(weaponId);
            const weapon =
                weaponDef.effectWeapon
                ?? getItemDef(HAND_ITEM_ID).effectWeapon!;
            if (target.line <= (weapon.range || 0))
            {
                const dmg = weapon.atk;
                target.hp -= dmg;
                battle.sum.meleeHits += 1;
                if (weaponId === HAND_ITEM_ID)
                {
                    // 1165: 你狠狠的打了%s僵尸一拳
                    pushLog(battle, `你狠狠的打了${target.prefix}僵尸一拳`);
                }
                else
                {
                    // 1049: 你挥舞着%s砍向跟前的%s僵尸
                    pushLog(
                        battle,
                        `你挥舞着${weaponDef.name}砍向跟前的${target.prefix}僵尸`,
                    );
                }
                // 1052
                pushLog(battle, `${target.prefix}僵尸受到${dmg}点伤害`);
                if (target.hp <= 0)
                {
                    killMonster(battle, target);
                }
                battle.playerCd = weapon.atkCD;
                acted = true;
            }
            else
            {
                battle.playerCd = 0.2;
            }
        }
    }

    if (battle.monsters.every((m) => m.dead || m.hp <= 0))
    {
        return endBattle(true);
    }

    gameBusEmit('battle_tick');
    return null;
}

function killMonster (battle: BattleState, mon: BattleMonster): void
{
    if (mon.dead)
    {
        return;
    }
    mon.dead = true;
    mon.hp = 0;
    battle.sum.monsterKilled += 1;
    // 1056: "%s个%s僵尸倒下了"
    pushLog(battle, `1个${mon.prefix}僵尸倒下了`);
}

function endBattle (win: boolean): BattleSumRes
{
    const battle = activeBattle;
    if (!battle)
    {
        return {
            win,
            monsterKilled: 0,
            playerHarm: 0,
            bulletsUsed: 0,
            meleeHits: 0,
            gunHits: 0,
            entries: [],
            log: [],
        };
    }

    battle.running = false;
    battle.finished = true;
    battle.sum.win = win;

    // Write ammo back.
    mutateSession((live) =>
    {
        const used = battle.sum.bulletsUsed;
        if (used > 0)
        {
            const have = live.bag[BULLET_ID] ?? 0;
            const next = Math.max(0, have - used);
            if (next <= 0)
            {
                delete live.bag[BULLET_ID];
            }
            else
            {
                live.bag[BULLET_ID] = next;
            }
        }
    });

    if (win)
    {
        appendSessionLog('战斗胜利');
    }
    else
    {
        appendSessionLog('战斗失败');
    }

    resumeTimeClock();
    gameBusEmit('battle_ended', battle.sum);
    gameBusEmit('session_updated');
    return battle.sum;
}

export function forceEndBattle (win: boolean): BattleSumRes
{
    return endBattle(win);
}

export function clearBattle (): void
{
    activeBattle = null;
}
