/**
 * Map / Site progression.
 * Ports map.js / site.js: unlock graph, genRooms, roomEnd, travel arrive.
 */

import { RANDOM_LOOT_EXCLUDED_SET } from '../data/blackList';
import { ITEM_CONFIG } from '../data/itemConfig';
import { rollMonsterList } from '../data/monsterConfig';
import { AD_REWARD_CONFIG, SCRAPYARD_CLAIMS_PER_DAY } from '../data/adConfig';
import {
    AD_SITE_ID,
    getSiteConfig,
    HOME_SITE_ID,
    mapDistance,
    type SiteLoot,
    STARTER_SITE_ID,
    travelTimeSeconds,
} from '../data/siteConfig';
import { getSiteProduceConfig, type WeightedSiteLoot } from '../data/siteProduceConfig';
import {
    appendSessionLog,
    applyGameTimeToSession,
    getSession,
    getStageFromHour,
    mutateSession,
    type SessionState,
    type SiteRoom,
    type SiteState,
} from '../session/sessionStore';
import { gameBusEmit } from './gameBus';
import { flushBagToStorage } from './inventory';
import { unlockNpc } from './npcSystem';

export function defaultMapState(): SessionState['map'] {
    const home = getSiteConfig(HOME_SITE_ID)!;
    const starter = createSiteState(STARTER_SITE_ID);
    return {
        pos: { ...home.coordinate },
        homePos: { ...home.coordinate },
        unlocked: [HOME_SITE_ID, STARTER_SITE_ID],
        sites: {
            [STARTER_SITE_ID]: starter,
        },
    };
}

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Original utils.getRoundRandom, including its inclusive 0..total roll. */
function rollWeightedLoot(entries: readonly WeightedSiteLoot[]): WeightedSiteLoot {
    const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
    if (total < 0 || entries.length === 0) {
        throw new Error('Site loot table must contain at least one non-negative entry.');
    }

    const roll = randomInt(0, total);
    let cumulative = 0;
    let selected = entries[entries.length - 1]!;
    for (const entry of entries) {
        cumulative += entry.weight;
        selected = entry;
        if (roll <= cumulative) {
            break;
        }
    }
    return selected;
}

/** Original utils.getRandomItemId wildcard matcher. */
function resolveLootItemId(pattern: string): number {
    if (!pattern.includes('*')) {
        return Number(pattern);
    }

    let candidates = Object.keys(ITEM_CONFIG)
        .map(Number)
        .filter((itemId) => !RANDOM_LOOT_EXCLUDED_SET.has(itemId));
    let offset = 0;
    for (let index = 0; index < pattern.length; index++, offset += 2) {
        if (pattern[index] === '*') {
            continue;
        }

        const length = offset === 6 ? 1 : 2;
        const segment = pattern.substr(index, length);
        candidates = candidates.filter(
            (itemId) => String(itemId).substr(offset, length) === segment,
        );
        index++;
    }

    if (candidates.length === 0) {
        throw new Error(`Site loot wildcard ${pattern} resolved to no items.`);
    }
    return candidates[randomInt(0, candidates.length - 1)]!;
}

function generateWorkLoot(siteId: number, workCount: number): SiteLoot[][] {
    const pools = Array.from({ length: workCount }, () => [] as number[]);
    if (pools.length === 0) {
        return [];
    }

    const config = getSiteConfig(siteId)!;
    const produce = getSiteProduceConfig(siteId);
    const itemIds: number[] = [];
    let remainingValue = (produce?.produceValue ?? 0) * (getSession()?.talent === 103 ? 1.1 : 1);
    while (remainingValue > 0) {
        if (!produce) {
            break;
        }
        const itemId = resolveLootItemId(rollWeightedLoot(produce.produceList).itemId);
        const item = ITEM_CONFIG[itemId];
        if (!item) {
            throw new Error(`Site loot item ${itemId} does not exist.`);
        }
        remainingValue -= item.value;
        itemIds.push(itemId);
    }

    for (const fixed of config.fixedProduceList) {
        for (let num = 0; num < fixed.num; num++) {
            itemIds.push(fixed.itemId);
        }
    }

    for (const itemId of itemIds) {
        pools[randomInt(0, pools.length - 1)]!.push(itemId);
    }

    return pools.map((pool) => {
        const counts = new Map<number, number>();
        for (const itemId of pool) {
            counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
        }
        return [...counts].map(([itemId, num]) => ({ itemId, num }));
    });
}

export function createSiteState(siteId: number): SiteState {
    const config = getSiteConfig(siteId);
    if (!config) {
        return {
            siteId,
            step: 0,
            rooms: [],
            storage: {},
            haveNewItems: false,
            closed: false,
            ended: false,
        };
    }

    const battleRooms: SiteRoom[] = [];
    for (let index = 0; index < config.battleRoom; index++) {
        const low = config.difficulty[0] ?? 1;
        const high = config.difficulty[1] ?? low;
        const difficulty = randomInt(low, high);
        battleRooms.push({
            type: 'battle',
            difficulty,
            monsters: rollMonsterList(difficulty),
        });
    }

    const workRooms: SiteRoom[] = generateWorkLoot(siteId, config.workRoom).map((loot) => ({
        type: 'work' as const,
        workType: randomInt(0, 2),
        loot,
    }));

    // Original Site.genRooms: guarantee one randomly selected work room is last,
    // then randomly interleave every remaining battle/work room.
    const rooms: SiteRoom[] = [];
    let roomCount = battleRooms.length + workRooms.length;
    if (workRooms.length > 0) {
        rooms.unshift(workRooms.splice(randomInt(0, workRooms.length - 1), 1)[0]!);
        roomCount--;
    }
    while (roomCount-- > 0) {
        const index = randomInt(0, roomCount);
        if (index > battleRooms.length - 1) {
            rooms.unshift(workRooms.splice(index - battleRooms.length, 1)[0]!);
        } else {
            rooms.unshift(battleRooms.splice(index, 1)[0]!);
        }
    }

    return {
        siteId,
        step: 0,
        rooms,
        storage: {},
        haveNewItems: false,
        closed: false,
        ended: false,
    };
}

export function ensureSite(siteId: number): SiteState | null {
    const session = getSession();
    if (!session) {
        return null;
    }
    const existing = session.map.sites[siteId];
    if (existing) {
        return existing;
    }
    if (!session.map.unlocked.includes(siteId)) {
        return null;
    }
    const created = createSiteState(siteId);
    mutateSession((live) => {
        live.map.sites[siteId] = created;
    });
    return created;
}

export function getSite(siteId: number): SiteState | null {
    const session = getSession();
    if (!session) {
        return null;
    }
    return session.map.sites[siteId] ?? null;
}

export function currentRoom(siteId: number): SiteRoom | null {
    const site = getSite(siteId);
    if (!site || site.step >= site.rooms.length) {
        return null;
    }
    return site.rooms[site.step] ?? null;
}

export function roomEnd(siteId: number, won: boolean): { advanced: boolean; siteEnded: boolean } {
    let advanced = false;
    let siteEnded = false;
    let doneWorkType: number | null = null;
    let siteName = '';
    const unlockedNames: string[] = [];
    const unlockedNpcIds: number[] = [];

    mutateSession((live) => {
        const site = live.map.sites[siteId];
        if (!site || !won) {
            return;
        }
        const doneRoom = site.rooms[site.step];
        if (doneRoom?.type === 'work') {
            doneWorkType = doneRoom.workType ?? 0;
        }
        site.step += 1;
        advanced = true;
        if (site.step >= site.rooms.length) {
            site.ended = true;
            siteEnded = true;
            const cfg = getSiteConfig(siteId);
            siteName = cfg?.name ?? '';
            // siteEnd → unlockValue.site
            for (const unlockId of cfg?.unlockSites ?? []) {
                if (!live.map.unlocked.includes(unlockId)) {
                    live.map.unlocked.push(unlockId);
                    const name = getSiteConfig(unlockId)?.name;
                    if (name) {
                        unlockedNames.push(name);
                    }
                }
            }
            // Site completion reveals NPCs through their own persistent state.
            for (const npcId of cfg?.unlockNpcs ?? []) {
                unlockedNpcIds.push(npcId);
            }
        }
    });

    if (advanced) {
        // 1117 你打开了箱子/桌子/柜子 (after work room)
        if (doneWorkType !== null) {
            const labels = ['箱子', '桌子', '柜子'];
            appendSessionLog(`你打开了${labels[doneWorkType] ?? '箱子'}`);
        }
        if (siteEnded) {
            // 1119 你彻底清除了%s里的全部威胁！
            if (siteName) {
                appendSessionLog(`你彻底清除了${siteName}里的全部威胁！`);
            }
            // 1104 新地点 %s 解锁！
            for (const name of unlockedNames) {
                appendSessionLog(`新地点 ${name} 解锁！`);
            }
            for (const npcId of unlockedNpcIds) {
                unlockNpc(npcId);
            }
        }
        gameBusEmit('session_updated');
    }
    return { advanced, siteEnded };
}

export function playerOut(): void {
    mutateSession((live) => {
        live.isAtHome = false;
        live.isAtSite = false;
        live.nowSiteId = null;
    });
    appendSessionLog('你离开了家。');
    gameBusEmit('session_updated');
}

export function playerGoHome(): void {
    const session = getSession();
    if (!session) {
        return;
    }
    const wasOutside = !session.isAtHome;
    mutateSession((live) => {
        live.isAtHome = true;
        live.isAtSite = false;
        live.nowSiteId = null;
        live.map.pos = { ...live.map.homePos };
    });
    if (wasOutside) {
        flushBagToStorage();
        appendSessionLog('你回到了家。');
    }
    gameBusEmit('session_updated');
}

/** Finish an already-timed journey by placing the player at its destination. */
export function arriveAt(siteId: number): boolean {
    const session = getSession();
    const cfg = getSiteConfig(siteId);
    if (!session || !cfg) {
        return false;
    }
    if (!session.map.unlocked.includes(siteId) && siteId !== HOME_SITE_ID) {
        return false;
    }

    if (siteId === HOME_SITE_ID) {
        playerGoHome();
    } else {
        enterSite(siteId);
    }
    return true;
}

export function enterSite(siteId: number): void {
    ensureSite(siteId);
    mutateSession((live) => {
        live.isAtHome = false;
        live.isAtSite = true;
        live.nowSiteId = siteId;
        const cfg = getSiteConfig(siteId);
        if (cfg) {
            live.map.pos = { ...cfg.coordinate };
        }
    });
    const name = getSiteConfig(siteId)?.name ?? `地点${siteId}`;
    appendSessionLog(`你到达了${name}。`);
    gameBusEmit('session_updated');
}

export function leaveSite(): void {
    mutateSession((live) => {
        live.isAtSite = false;
        live.nowSiteId = null;
    });
    gameBusEmit('session_updated');
}

export type TravelPlan = {
    siteId: number;
    distance: number;
    gameSeconds: number;
    /** Wall-clock seconds for actor tween (original Actor.move duration). */
    realSeconds: number;
    name: string;
};

/** Original RandomBattleConfig.distance — check interval in map units. */
const RANDOM_BATTLE_DISTANCE = 100;
const RANDOM_BATTLE_BY_STAGE = {
    day: { probability: 0.1, difficulty: [1, 3] as const },
    night: { probability: 0.3, difficulty: [2, 4] as const },
} as const;

export type TravelEncounter = {
    difficulty: number;
    monsters: number[];
};

/**
 * Roll roadside encounters over a travel distance.
 * Original: every RandomBattleConfig.distance units, stage-weighted probability.
 * Returns the first hit (P0: single overlay), or null.
 */
export function rollTravelEncounter(distance: number): TravelEncounter | null {
    const session = getSession();
    if (!session || distance < RANDOM_BATTLE_DISTANCE) {
        return null;
    }

    const stage = getStageFromHour(session.hour);
    const config = RANDOM_BATTLE_BY_STAGE[stage];
    const checks = Math.floor(distance / RANDOM_BATTLE_DISTANCE);
    for (let i = 0; i < checks; i++) {
        if (Math.random() > config.probability) {
            continue;
        }
        const [minDiff, maxDiff] = config.difficulty;
        const difficulty = minDiff + Math.floor(Math.random() * (maxDiff - minDiff + 1));
        const monsters = rollMonsterList(difficulty);
        appendSessionLog('遭遇僵尸！');
        return { difficulty, monsters };
    }
    return null;
}

export function planTravel(siteId: number): TravelPlan | null {
    const session = getSession();
    const cfg = getSiteConfig(siteId);
    if (!session || !cfg) {
        return null;
    }
    if (!session.map.unlocked.includes(siteId) && siteId !== HOME_SITE_ID) {
        return null;
    }
    const target = siteId === HOME_SITE_ID ? session.map.homePos : cfg.coordinate;
    const distance = mapDistance(session.map.pos, target);
    const gameSeconds = Math.max(1, Math.round(travelTimeSeconds(distance)));
    // Keep actor tween short; original scales real duration with velocity.
    const realSeconds = Math.min(8, Math.max(1.5, gameSeconds / 1800));
    return {
        siteId,
        distance,
        gameSeconds,
        realSeconds,
        name: cfg.name,
    };
}

/**
 * Instant travel with game-time jump (P0: skip random roadside battles).
 */
export function travelTo(siteId: number, onArrived?: () => void): boolean {
    const plan = planTravel(siteId);
    if (!plan) {
        return false;
    }

    const jump = Math.min(plan.gameSeconds, 6 * 3600);
    mutateSession((live) => {
        applyGameTimeToSession(live, live.gameTime + jump);
    });

    const arrived = arriveAt(plan.siteId);
    if (arrived) {
        onArrived?.();
    }
    return arrived;
}

export function fillTempLootFromRoom(siteId: number): SiteLoot[] {
    const room = currentRoom(siteId);
    if (room?.type !== 'work') {
        return [];
    }
    const loot = (room.loot ?? []).map((row) => ({ ...row }));
    mutateSession((live) => {
        live.tempLoot = {};
        for (const row of loot) {
            live.tempLoot[row.itemId] = (live.tempLoot[row.itemId] ?? 0) + row.num;
        }
    });
    gameBusEmit('session_updated');
    return loot;
}

/** Flush remaining temp loot into site storage (work room leave). */
export function flushTempToSite(siteId: number): void {
    mutateSession((live) => {
        const site = live.map.sites[siteId];
        if (!site) {
            live.tempLoot = {};
            return;
        }
        for (const [idText, num] of Object.entries(live.tempLoot)) {
            const itemId = Number(idText);
            if (!Number.isFinite(itemId) || num <= 0) {
                continue;
            }
            site.storage[itemId] = (site.storage[itemId] ?? 0) + num;
            site.haveNewItems = true;
        }
        live.tempLoot = {};
    });
    gameBusEmit('session_updated');
}

/** Daily scrapyard claim progress: 0 = ready, 1 = claimed today. */
export function scrapyardClaimStep(siteId: number = AD_SITE_ID): number {
    if (siteId !== AD_SITE_ID) {
        return SCRAPYARD_CLAIMS_PER_DAY;
    }
    const session = getSession();
    if (!session) {
        return SCRAPYARD_CLAIMS_PER_DAY;
    }
    const site = session.map.sites[siteId] ?? ensureSite(siteId);
    if (!site) {
        return SCRAPYARD_CLAIMS_PER_DAY;
    }
    return (site.lastGiftDay ?? 0) === session.day ? SCRAPYARD_CLAIMS_PER_DAY : 0;
}

/** Progress caption for AdSite chrome — room-style 进度:cur/total. */
export function scrapyardProgressStr(siteId: number = AD_SITE_ID): string {
    return `进度:${scrapyardClaimStep(siteId)}/${SCRAPYARD_CLAIMS_PER_DAY}`;
}

/** Whether scrapyard free gift is available today (no ads). */
export function canClaimScrapyardGift(siteId: number = AD_SITE_ID): boolean {
    return scrapyardClaimStep(siteId) < SCRAPYARD_CLAIMS_PER_DAY;
}

/**
 * Claim free scrapyard gift into site storage.
 * Port of AdSiteNode ad dismiss reward — ads removed; once per day.
 */
export function claimScrapyardGift(siteId: number = AD_SITE_ID): SiteLoot[] {
    if (siteId !== AD_SITE_ID) {
        return [];
    }
    const session = getSession();
    if (!session) {
        return [];
    }
    ensureSite(siteId);
    const liveSite = getSite(siteId);
    if (!liveSite || (liveSite.lastGiftDay ?? 0) === session.day) {
        return [];
    }

    const itemIds: number[] = [];
    let remainingValue = AD_REWARD_CONFIG.produceValue;
    while (remainingValue > 0) {
        const itemId = resolveLootItemId(rollWeightedLoot(AD_REWARD_CONFIG.produceList).itemId);
        const item = ITEM_CONFIG[itemId];
        if (!item) {
            throw new Error(`Scrapyard gift item ${itemId} does not exist.`);
        }
        remainingValue -= item.value;
        itemIds.push(itemId);
    }

    const counts = new Map<number, number>();
    for (const itemId of itemIds) {
        counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
    }
    const loot: SiteLoot[] = [...counts].map(([itemId, num]) => ({ itemId, num }));

    mutateSession((live) => {
        const site = live.map.sites[siteId];
        if (!site) {
            return;
        }
        for (const row of loot) {
            site.storage[row.itemId] = (site.storage[row.itemId] ?? 0) + row.num;
        }
        site.haveNewItems = true;
        site.lastGiftDay = live.day;
    });
    appendSessionLog('你从可疑设备里拿到了补给。');
    gameBusEmit('session_updated');
    return loot;
}

export function siteStorageCount(siteId: number): number {
    const site = getSite(siteId);
    if (!site) {
        return 0;
    }
    return Object.values(site.storage).reduce((sum, n) => sum + n, 0);
}
