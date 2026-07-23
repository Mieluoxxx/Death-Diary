/**
 * Minimal auto-battle shell for P0 site rooms.
 * Ports Battle.js subset: line approach, melee/gun auto, ammo writeback.
 * Not full 6-line UI — pure domain resolution usable by Site UI.
 */

import {
    BULLET_ID,
    HAND_ITEM_ID,
    getItemDef,
} from '../data/itemConfig';
import { getMonsterDef } from '../data/monsterConfig';
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

export type BattleMonster = {
    id: number;
    name: string;
    hp: number;
    maxHp: number;
    attack: number;
    /** Distance line 0..5 (0 = melee range). */
    line: number;
    speed: number;
    attackSpeed: number;
    attackCooldown: number;
};

export type BattleSumRes = {
    win: boolean;
    monsterKilled: number;
    playerHarm: number;
    bulletsUsed: number;
    meleeHits: number;
    gunHits: number;
    log: string[];
};

export type BattleState = {
    monsters: BattleMonster[];
    bullets: number;
    gunId: number;
    weaponId: number;
    def: number;
    running: boolean;
    finished: boolean;
    sum: BattleSumRes;
    /** Accumulator for player attack CD. */
    playerCd: number;
    /** Accumulator for monster move tick (1s). */
    moveAcc: number;
};

let activeBattle: BattleState | null = null;

export function getActiveBattle (): BattleState | null
{
    return activeBattle;
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

    const monsters: BattleMonster[] = monsterIds.map((id, index) =>
    {
        const defM = getMonsterDef(id);
        return {
            id,
            name: defM.name,
            hp: defM.hp,
            maxHp: defM.hp,
            attack: defM.attack,
            line: Math.min(5, 3 + index),
            speed: defM.speed,
            attackSpeed: defM.attackSpeed,
            attackCooldown: 0,
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
        playerCd: 0,
        moveAcc: 0,
        sum: {
            win: false,
            monsterKilled: 0,
            playerHarm: 0,
            bulletsUsed: 0,
            meleeHits: 0,
            gunHits: 0,
            log: [],
        },
    };

    pauseTimeClock();
    gameBusEmit('battle_started');
    return activeBattle;
}

/**
 * Advance battle by real seconds (call from scene update while battle UI open).
 * Auto: gun if in range + ammo, else melee if line 0.
 */
export function tickBattle (realDelta: number): BattleSumRes | null
{
    const battle = activeBattle;
    const session = getSession();
    if (!battle || !battle.running || !session || realDelta <= 0)
    {
        return battle?.finished ? battle.sum : null;
    }

    // Monster movement ~1s ticks (scaled a bit faster for slice pacing).
    battle.moveAcc += realDelta;
    while (battle.moveAcc >= 0.6)
    {
        battle.moveAcc -= 0.6;
        for (const mon of battle.monsters)
        {
            if (mon.hp <= 0)
            {
                continue;
            }
            if (mon.line > 0)
            {
                mon.line = Math.max(0, mon.line - mon.speed);
            }
            else
            {
                mon.attackCooldown -= 0.6;
                if (mon.attackCooldown <= 0)
                {
                    const harm = Math.max(1, mon.attack - battle.def);
                    changeAttr('hp', -harm);
                    changeAttr('injury', 1);
                    battle.sum.playerHarm += harm;
                    mon.attackCooldown = mon.attackSpeed;
                    battle.sum.log.push(`${mon.name} 击中你，-${harm}HP`);
                    const live = getSession();
                    if (!live || live.attrs.hp <= 0 || live.isDead)
                    {
                        return endBattle(false);
                    }
                }
            }
        }
    }

    // Player auto attacks.
    battle.playerCd -= realDelta;
    if (battle.playerCd <= 0)
    {
        const target = battle.monsters.find((m) => m.hp > 0);
        if (!target)
        {
            return endBattle(true);
        }

        let acted = false;
        // Gun
        if (battle.gunId && battle.bullets > 0)
        {
            const gun = getItemDef(battle.gunId).effectWeapon;
            const bulletAtk = getItemDef(BULLET_ID).effectWeapon?.atk ?? 50;
            if (gun && target.line <= gun.range)
            {
                const precise = gun.precise;
                const hit = Math.random() < precise;
                battle.bullets -= 1;
                battle.sum.bulletsUsed += 1;
                if (hit)
                {
                    const dmg = bulletAtk;
                    target.hp -= dmg;
                    battle.sum.gunHits += 1;
                    battle.sum.log.push(`枪击中 ${target.name} -${dmg}`);
                    if (target.hp <= 0)
                    {
                        battle.sum.monsterKilled += 1;
                        battle.sum.log.push(`${target.name} 被击毙`);
                    }
                }
                else
                {
                    battle.sum.log.push('枪未命中');
                }
                battle.playerCd = gun.atkCD;
                acted = true;
            }
        }

        // Melee
        if (!acted)
        {
            const weaponId = battle.weaponId || HAND_ITEM_ID;
            const weapon =
                getItemDef(weaponId).effectWeapon
                ?? getItemDef(HAND_ITEM_ID).effectWeapon!;
            if (target.line <= (weapon.range || 0))
            {
                const dmg = weapon.atk;
                target.hp -= dmg;
                battle.sum.meleeHits += 1;
                battle.sum.log.push(`近战击中 ${target.name} -${dmg}`);
                if (target.hp <= 0)
                {
                    battle.sum.monsterKilled += 1;
                    battle.sum.log.push(`${target.name} 倒下`);
                }
                battle.playerCd = weapon.atkCD;
                acted = true;
            }
            else
            {
                // Wait for monsters to approach.
                battle.playerCd = 0.2;
            }
        }
    }

    // Prune dead (keep for UI until end — just check win).
    if (battle.monsters.every((m) => m.hp <= 0))
    {
        return endBattle(true);
    }

    gameBusEmit('battle_tick');
    return null;
}

function endBattle (win: boolean): BattleSumRes
{
    const battle = activeBattle;
    if (!battle)
    {
        return {
            win: false,
            monsterKilled: 0,
            playerHarm: 0,
            bulletsUsed: 0,
            meleeHits: 0,
            gunHits: 0,
            log: [],
        };
    }
    battle.running = false;
    battle.finished = true;
    battle.sum.win = win;

    // Write back bullets.
    mutateSession((live) =>
    {
        if (battle.bullets > 0)
        {
            live.bag[BULLET_ID] = battle.bullets;
        }
        else
        {
            delete live.bag[BULLET_ID];
        }
    });

    resumeTimeClock();
    appendSessionLog(
        win
            ? `战斗胜利，击杀${battle.sum.monsterKilled}，耗弹${battle.sum.bulletsUsed}`
            : '战斗失败……',
    );
    gameBusEmit('session_updated');
    gameBusEmit('battle_ended', battle.sum);
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
