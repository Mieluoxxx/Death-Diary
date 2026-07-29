/**
 * Battle simulation ported from Buried-City Battle.js.
 * Equipment is composed from effect descriptors: gun, melee, blast and trap
 * run independently, rather than relying on an inheritance tree or a single
 * player-wide cooldown.
 */
import { BULLET_ID, getItemDef, HAND_ITEM_ID, type WeaponEffect } from '../data/itemConfig';
import { getMonsterDef, monsterTypeName } from '../data/monsterConfig';
import { getWeatherValue } from '../data/weatherConfig';
import {
    appendSessionLog,
    getSession,
    mutateSession,
    type SessionState,
} from '../session/sessionStore';
import { Music, Sound, insertMusic, playEffect, playWeaponAttack, resumeMusic } from './audioManager';
import { gameBusEmit } from './gameBus';
import { EquipPosMap, getArmorDef, testWeaponBroken } from './inventory';
import { VIGOUR_IMMUNE_BUFF_ITEM_ID } from '../data/itemEffects';
import { changeAttr, isBuffActive } from './playerAttrs';
import { pauseTimeClock, resumeTimeClock } from './timeClock';

const LAST_LINE = 5;
const DODGE_DURATION_SEC = 5;
const ELECTRIC_GUN_IDS = new Set([1301071, 1301082]);
const BLAST_TOOL_IDS = new Set([1303012, 1303033, 1303044]);
const TRAP_TOOL_ID = 1303022;

export type BattleLogEntry = {
    text: string;
    /** '#rrggbb' or empty for white */
    color?: string;
};

export type BattleMonster = {
    id: number;
    /** Prefix adjective, e.g. 朽坏的. */
    prefix: string;
    hp: number;
    maxHp: number;
    attack: number;
    /** Distance line 0..5; null means the monster has not entered yet. */
    line: number | null;
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
    isDodge?: boolean;
    escaped?: boolean;
    toolsUsed?: number;
    toolItemId?: number;
    brokenWeapons?: number[];
};

export type StartBattleOptions = {
    /** Roadside dodge: 5s progress, no player auto-attack, auto-win. */
    isDodge?: boolean;
};

type RangedEquipment = {
    kind: 'gun';
    itemId: number;
    name: string;
    attr: WeaponEffect;
    powerRequired: boolean;
};

type MeleeEquipment = {
    kind: 'melee';
    itemId: number;
    name: string;
    attr: WeaponEffect;
};

type BlastEquipment = {
    kind: 'blast';
    itemId: number;
    name: string;
    attr: WeaponEffect;
};

type TrapEquipment = {
    kind: 'trap';
    itemId: number;
    name: string;
    attr: WeaponEffect;
};

type ToolEquipment = BlastEquipment | TrapEquipment;

type BattleLoadout = {
    gun: RangedEquipment | null;
    melee: MeleeEquipment;
    tool: ToolEquipment | null;
};

export type BattleState = {
    monsters: BattleMonster[];
    /** Snapshot of all independently scheduled equipment effects. */
    loadout: BattleLoadout;
    bullets: number;
    tools: number;
    def: number;
    running: boolean;
    finished: boolean;
    sum: BattleSumRes;
    gunCooldown: number;
    meleeCooldown: number;
    toolCooldown: number;
    moveAcc: number;
    elapsed: number;
    monsterStopUntil: number;
    isDodge: boolean;
    dodgeTime: number;
    dodgePassTime: number;
    usedEquipment: Set<number>;
};

let activeBattle: BattleState | null = null;

export function getActiveBattle(): BattleState | null {
    return activeBattle;
}

function pushLog(battle: BattleState, text: string, color?: string): void {
    battle.sum.entries.push({ text, color });
    battle.sum.log.push(text);
}

function targetMonster(battle: BattleState): BattleMonster | undefined {
    return battle.monsters.find((monster) => !monster.dead && monster.hp > 0);
}

function asWeaponEffect(itemId: number): WeaponEffect {
    return getItemDef(itemId).effectWeapon ?? getItemDef(HAND_ITEM_ID).effectWeapon!;
}

function buildLoadout(session: SessionState): BattleLoadout {
    const gunId = session.equip[EquipPosMap.GUN] ?? 0;
    const gunDef = gunId ? getItemDef(gunId) : null;
    const gun = gunDef?.effectWeapon
        ? {
              kind: 'gun' as const,
              itemId: gunId,
              name: gunDef.name,
              attr: gunDef.effectWeapon,
              powerRequired: ELECTRIC_GUN_IDS.has(gunId),
          }
        : null;

    const meleeId = session.equip[EquipPosMap.WEAPON] || HAND_ITEM_ID;
    const meleeDef = getItemDef(meleeId);
    const melee = {
        kind: 'melee' as const,
        itemId: meleeId,
        name: meleeDef.name,
        attr: asWeaponEffect(meleeId),
    };

    const toolId = session.equip[EquipPosMap.TOOL] ?? 0;
    const toolDef = toolId ? getItemDef(toolId) : null;
    const tool =
        toolDef?.effectWeapon && BLAST_TOOL_IDS.has(toolId)
            ? {
                  kind: 'blast' as const,
                  itemId: toolId,
                  name: toolDef.name,
                  attr: toolDef.effectWeapon,
              }
            : toolDef?.effectWeapon && toolId === TRAP_TOOL_ID
              ? {
                    kind: 'trap' as const,
                    itemId: toolId,
                    name: toolDef.name,
                    attr: toolDef.effectWeapon,
                }
              : null;

    return { gun, melee, tool };
}

function hasElectricPower(session: SessionState): boolean {
    return (
        session.role === 'YAZI' &&
        session.electricFenceActive &&
        (session.map.unlocked.includes(204) || session.map.sites[204] != null)
    );
}

/** Original player.vigourEffect(): only the lowest vigour band doubles cooldowns. */
function cooldownFor(session: SessionState, base: number): number {
    const lowVigour =
        session.attrs.vigour <= 25 && !isBuffActive(VIGOUR_IMMUNE_BUFF_ITEM_ID, session);
    return base * (lowVigour ? 2 : 1);
}

function initialMonsters(monsterIds: number[]): BattleMonster[] {
    return monsterIds.map((id, index) => {
        const def = getMonsterDef(id);
        return {
            id,
            prefix: monsterTypeName(def.prefixType),
            hp: def.hp,
            maxHp: def.hp,
            attack: def.attack,
            line: index === 0 ? LAST_LINE : null,
            speed: def.speed,
            attackSpeed: def.attackSpeed,
            attackCooldown: 0,
            dead: false,
        };
    });
}

export function startBattle(monsterIds: number[], options: StartBattleOptions = {}): BattleState {
    const session = getSession();
    if (!session) {
        throw new Error('startBattle: no session');
    }

    const loadout = buildLoadout(session);
    const monsters = initialMonsters(monsterIds);
    const toolId = loadout.tool?.itemId ?? 0;
    activeBattle = {
        monsters,
        loadout,
        bullets: session.bag[BULLET_ID] ?? 0,
        tools: toolId ? (session.bag[toolId] ?? 0) : 0,
        def: getArmorDef(session),
        running: true,
        finished: false,
        gunCooldown: 0.1,
        meleeCooldown: 0.1,
        // Grenades are combat consumables: throw the first one with the opening attack.
        // Their configured cooldown governs subsequent throws only.
        toolCooldown:
            loadout.tool?.kind === 'blast'
                ? 0.1
                : loadout.tool
                  ? cooldownFor(session, loadout.tool.attr.atkCD)
                  : Number.POSITIVE_INFINITY,
        moveAcc: 0,
        elapsed: 0,
        monsterStopUntil: 0,
        isDodge: options.isDodge === true,
        dodgeTime: DODGE_DURATION_SEC,
        dodgePassTime: 0,
        usedEquipment: new Set(),
        sum: {
            win: false,
            monsterKilled: 0,
            playerHarm: 0,
            bulletsUsed: 0,
            meleeHits: 0,
            gunHits: 0,
            entries: [],
            log: [],
            isDodge: options.isDodge === true,
            toolsUsed: 0,
            toolItemId: toolId,
            brokenWeapons: [],
        },
    };

    pushLog(activeBattle, `${monsterIds.length}个僵尸发现了你！`);
    const lead = targetMonster(activeBattle);
    if (lead?.line != null) {
        pushLog(activeBattle, `${lead.prefix}僵尸向你靠近！距离${lead.line}`);
    }

    pauseTimeClock();
    insertMusic(Music.BATTLE);
    gameBusEmit('battle_started');
    return activeBattle;
}

/** 0..1 progress for dodge encounters (original battleDodgePercentage / 100). */
export function getDodgeProgress(): number {
    const battle = activeBattle;
    if (!battle?.isDodge || battle.dodgeTime <= 0) {
        return 0;
    }
    return Math.min(1, battle.dodgePassTime / battle.dodgeTime);
}

function killMonster(battle: BattleState, monster: BattleMonster): void {
    if (monster.dead) {
        return;
    }
    monster.dead = true;
    monster.hp = 0;
    monster.line = null;
    battle.sum.monsterKilled++;
    playEffect(Sound.MONSTER_DIE);
    pushLog(battle, `1个${monster.prefix}僵尸倒下了`);
}

function damageMonster(battle: BattleState, monster: BattleMonster, harm: number): void {
    monster.hp = Math.max(0, monster.hp - harm);
    if (monster.hp <= 0) {
        killMonster(battle, monster);
    }
}

function advanceMonster(battle: BattleState, monster: BattleMonster): void {
    if (monster.dead || monster.hp <= 0) {
        return;
    }
    const occupied = new Set(
        battle.monsters
            .filter((other) => other !== monster && !other.dead && other.line != null)
            .map((other) => other.line!),
    );
    const priorLine = monster.line;
    if (priorLine == null) {
        if (!occupied.has(LAST_LINE)) {
            monster.line = LAST_LINE;
        }
    } else if (priorLine > 0) {
        let next = priorLine;
        for (let line = priorLine - 1; line >= Math.max(0, priorLine - monster.speed); line--) {
            if (occupied.has(line)) {
                break;
            }
            next = line;
        }
        monster.line = next;
    }

    if (monster.line === 0 && priorLine !== 0) {
        monster.attackCooldown = monster.attackSpeed;
    }
    if (targetMonster(battle) === monster && monster.line != null && monster.line !== priorLine) {
        pushLog(battle, `${monster.prefix}僵尸向你靠近！距离${monster.line}`);
    }
}

function tickMonsterAttacks(battle: BattleState, realDelta: number): BattleSumRes | null {
    if (battle.elapsed < battle.monsterStopUntil) {
        return null;
    }
    for (const monster of battle.monsters) {
        if (monster.dead || monster.line !== 0) {
            continue;
        }
        monster.attackCooldown -= realDelta;
        while (monster.attackCooldown <= 0) {
            const harm = Math.max(1, monster.attack - battle.def);
            playEffect(Sound.MONSTER_ATTACK);
            changeAttr('hp', -harm);
            changeAttr('injury', 1);
            battle.sum.playerHarm += harm;
            monster.attackCooldown += monster.attackSpeed;
            pushLog(battle, `${monster.prefix}僵尸击中了你，生命值：-${harm}`, '#ff3333');
            const session = getSession();
            if (!session || session.attrs.hp <= 0 || session.isDead) {
                pushLog(battle, '流血过多，你不省人事');
                return endBattle(false);
            }
        }
    }
    return null;
}

function gunHarm(session: SessionState, weapon: RangedEquipment, target: BattleMonster): number {
    const distance = LAST_LINE - (target.line ?? LAST_LINE);
    let precise = weapon.attr.precise + weapon.attr.dtPrecise * distance;
    let deathHit = weapon.attr.deathHit + weapon.attr.dtDeathHit * distance;
    if (session.talent === 101) {
        precise += (1 - precise) * 0.3;
    }
    precise += getWeatherValue(session.weatherId, 'gun_precise');
    if (session.role === 'LUO') {
        precise -= (100 - session.attrs.spirit) * 0.0035;
    }
    precise = Math.max(0, Math.min(1, precise));
    deathHit = Math.max(0, Math.min(1, deathHit));
    if (Math.random() <= deathHit) {
        return Number.MAX_SAFE_INTEGER;
    }
    if (Math.random() <= precise) {
        return weapon.powerRequired
            ? weapon.attr.atk
            : (getItemDef(BULLET_ID).effectWeapon?.atk ?? 50);
    }
    return 0;
}

function fireGun(battle: BattleState, session: SessionState): void {
    const gun = battle.loadout.gun;
    const target = targetMonster(battle);
    if (!gun || !target || target.line == null || target.line > gun.attr.range) {
        return;
    }
    if (gun.powerRequired && !hasElectricPower(session)) {
        return;
    }
    for (let shot = 0; shot < gun.attr.bulletMax; shot++) {
        const current = targetMonster(battle);
        if (!current || current.line == null || current.line > gun.attr.range) {
            break;
        }
        if (!gun.powerRequired && battle.bullets <= 0) {
            pushLog(battle, '没有子弹了');
            break;
        }
        if (!gun.powerRequired) {
            battle.bullets--;
            battle.sum.bulletsUsed++;
        }
        battle.usedEquipment.add(gun.itemId);
        playWeaponAttack(gun.itemId, 'gun');
        pushLog(battle, `你使用${gun.name}向${current.prefix}僵尸射击`);
        const harm = gunHarm(session, gun, current);
        if (harm === Number.MAX_SAFE_INTEGER) {
            battle.sum.gunHits++;
            pushLog(battle, `${current.prefix}僵尸被一击毙命`);
            damageMonster(battle, current, current.hp);
        } else if (harm > 0) {
            battle.sum.gunHits++;
            pushLog(battle, `${current.prefix}僵尸受到${harm}点伤害`);
            damageMonster(battle, current, harm);
        } else {
            pushLog(battle, 'miss');
        }
    }
}

function strikeMelee(battle: BattleState): void {
    const target = targetMonster(battle);
    const weapon = battle.loadout.melee;
    if (!target || target.line == null || target.line > weapon.attr.range) {
        return;
    }
    battle.usedEquipment.add(weapon.itemId);
    battle.sum.meleeHits++;
    playWeaponAttack(weapon.itemId, 'melee');
    if (weapon.itemId === HAND_ITEM_ID) {
        pushLog(battle, `你狠狠的打了${target.prefix}僵尸一拳`);
    } else {
        pushLog(battle, `你挥舞着${weapon.name}砍向跟前的${target.prefix}僵尸`);
    }
    pushLog(battle, `${target.prefix}僵尸受到${weapon.attr.atk}点伤害`);
    damageMonster(battle, target, weapon.attr.atk);
}

function useTool(battle: BattleState): void {
    const tool = battle.loadout.tool;
    if (!tool || battle.tools <= 0) {
        return;
    }
    battle.tools--;
    battle.sum.toolsUsed = (battle.sum.toolsUsed ?? 0) + 1;
    if (tool.kind === 'trap') {
        battle.monsterStopUntil = battle.elapsed + tool.attr.atkCD;
        playEffect(Sound.TRAP);
        pushLog(battle, `你使用${tool.name}`, '#ff8000');
        pushLog(battle, '僵尸停止移动', '#ff8000');
        return;
    }

    playEffect(Sound.BOMB);
    pushLog(battle, `你使用${tool.name}`, '#ff8000');
    pushLog(battle, `所有僵尸受到${tool.attr.atk}点伤害`, '#ff8000');
    for (const monster of battle.monsters) {
        if (!monster.dead) {
            damageMonster(battle, monster, tool.attr.atk);
        }
    }
}

function tickPlayerEquipment(battle: BattleState, session: SessionState, realDelta: number): void {
    battle.gunCooldown -= realDelta;
    if (battle.gunCooldown <= 0) {
        const gun = battle.loadout.gun;
        if (gun) {
            fireGun(battle, session);
            battle.gunCooldown += cooldownFor(session, gun.attr.atkCD);
        }
    }

    battle.meleeCooldown -= realDelta;
    if (battle.meleeCooldown <= 0) {
        strikeMelee(battle);
        battle.meleeCooldown += cooldownFor(session, battle.loadout.melee.attr.atkCD);
    }

    battle.toolCooldown -= realDelta;
    if (battle.toolCooldown <= 0) {
        const tool = battle.loadout.tool;
        if (tool) {
            useTool(battle);
            battle.toolCooldown += cooldownFor(session, tool.attr.atkCD);
        }
    }
}

/** Advance battle by real seconds. Monster movement follows the original 1s schedule. */
export function tickBattle(realDelta: number): BattleSumRes | null {
    const battle = activeBattle;
    const session = getSession();
    if (!battle?.running || !session || realDelta <= 0) {
        return battle?.finished ? battle.sum : null;
    }
    battle.elapsed += realDelta;

    if (battle.isDodge) {
        battle.dodgePassTime += realDelta;
        if (battle.dodgePassTime >= battle.dodgeTime) {
            return endBattle(true);
        }
    }

    // Attack timers advance before this tick's movement, so a monster arriving
    // at line zero cannot spend the entire elapsed delta attacking immediately.
    const monsterResult = tickMonsterAttacks(battle, realDelta);
    if (monsterResult) {
        return monsterResult;
    }
    if (battle.elapsed >= battle.monsterStopUntil) {
        battle.moveAcc += realDelta;
        while (battle.moveAcc >= 1) {
            battle.moveAcc -= 1;
            for (const monster of battle.monsters) {
                advanceMonster(battle, monster);
            }
        }
    }
    if (battle.isDodge) {
        return null;
    }

    tickPlayerEquipment(battle, session, realDelta);
    if (battle.monsters.every((monster) => monster.dead || monster.hp <= 0)) {
        return endBattle(true);
    }
    gameBusEmit('battle_tick');
    return null;
}

function consumeBattleSupplies(battle: BattleState): void {
    mutateSession((session) => {
        const consume = (itemId: number, used: number): void => {
            if (used <= 0) {
                return;
            }
            const next = Math.max(0, (session.bag[itemId] ?? 0) - used);
            if (next === 0) {
                delete session.bag[itemId];
            } else {
                session.bag[itemId] = next;
            }
        };
        consume(BULLET_ID, battle.sum.bulletsUsed);
        const toolId = battle.loadout.tool?.itemId ?? 0;
        consume(toolId, battle.sum.toolsUsed ?? 0);
        if (
            toolId &&
            (session.bag[toolId] ?? 0) === 0 &&
            session.equip[EquipPosMap.TOOL] === toolId
        ) {
            session.equip[EquipPosMap.TOOL] = 0;
        }

        // Original tests each used gun/melee once after a winning battle.
        if (battle.sum.win) {
            for (const itemId of battle.usedEquipment) {
                if (itemId === HAND_ITEM_ID) {
                    continue;
                }
                if (testWeaponBroken(itemId)) {
                    battle.sum.brokenWeapons?.push(itemId);
                }
            }
        }
    });
}

function emptySummary(win: boolean): BattleSumRes {
    return {
        win,
        monsterKilled: 0,
        playerHarm: 0,
        bulletsUsed: 0,
        meleeHits: 0,
        gunHits: 0,
        entries: [],
        log: [],
        isDodge: false,
        toolsUsed: 0,
        toolItemId: 0,
        brokenWeapons: [],
    };
}

function endBattle(win: boolean): BattleSumRes {
    const battle = activeBattle;
    if (!battle) {
        return emptySummary(win);
    }
    battle.running = false;
    battle.finished = true;
    battle.sum.win = win;
    consumeBattleSupplies(battle);
    if (win && !battle.isDodge) {
        appendSessionLog('战斗胜利');
    } else if (!win) {
        appendSessionLog('战斗失败');
    }
    resumeTimeClock();
    resumeMusic();
    gameBusEmit('battle_ended', battle.sum);
    gameBusEmit('session_updated');
    return battle.sum;
}

export function forceEndBattle(win: boolean): BattleSumRes {
    return endBattle(win);
}

export function clearBattle(): void {
    activeBattle = null;
}
