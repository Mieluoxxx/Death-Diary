/**
 * Map / Site progression for P0 (HOME + starter site 201).
 * Ports map.js / site.js subset: unlock, genRooms, roomEnd, travel arrive.
 */

import { rollMonsterList } from '../data/monsterConfig';
import {
    getSiteConfig,
    HOME_SITE_ID,
    mapDistance,
    type SiteLoot,
    STARTER_SITE_ID,
    travelTimeSeconds,
} from '../data/siteConfig';
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

export function defaultMapState (): SessionState['map']
{
    const home = getSiteConfig(HOME_SITE_ID)!;
    const starter = createSiteState(STARTER_SITE_ID);
    return {
        pos: { ...home.coordinate },
        unlocked: [HOME_SITE_ID, STARTER_SITE_ID],
        sites: {
            [STARTER_SITE_ID]: starter,
        },
    };
}

export function createSiteState (siteId: number): SiteState
{
    const config = getSiteConfig(siteId);
    if (!config)
    {
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
    const battleCount = config.battleRoom;
    const workCount = config.workRoom;
    const diffRange = config.difficulty;

    for (let i = 0; i < battleCount; i++)
    {
        const lo = diffRange[0] ?? 1;
        const hi = diffRange[1] ?? lo;
        const difficulty = lo + Math.floor(Math.random() * (hi - lo + 1));
        battleRooms.push({
            type: 'battle',
            difficulty,
            monsters: rollMonsterList(difficulty),
        });
    }

    const lootPools: SiteLoot[][] = [];
    if (workCount > 0)
    {
        for (let i = 0; i < workCount; i++)
        {
            lootPools.push([]);
        }
        lootPools[workCount - 1] = config.fixedProduceList.map((row) => ({
            itemId: row.itemId,
            num: row.num,
        }));
    }

    const workRooms: SiteRoom[] = lootPools.map((list) => ({
        type: 'work' as const,
        workType: Math.floor(Math.random() * 3),
        loot: list,
    }));

    const ordered: SiteRoom[] = [];
    if (workRooms.length > 0)
    {
        const endWork = workRooms.pop()!;
        ordered.push(...battleRooms, ...workRooms, endWork);
    }
    else
    {
        ordered.push(...battleRooms);
    }

    return {
        siteId,
        step: 0,
        rooms: ordered,
        storage: {},
        haveNewItems: false,
        closed: false,
        ended: false,
    };
}

export function ensureSite (siteId: number): SiteState | null
{
    const session = getSession();
    if (!session)
    {
        return null;
    }
    if (session.map.sites[siteId])
    {
        return session.map.sites[siteId];
    }
    if (!session.map.unlocked.includes(siteId))
    {
        return null;
    }
    const created = createSiteState(siteId);
    mutateSession((live) =>
    {
        live.map.sites[siteId] = created;
    });
    return created;
}

export function getSite (siteId: number): SiteState | null
{
    const session = getSession();
    if (!session)
    {
        return null;
    }
    return session.map.sites[siteId] ?? null;
}

export function currentRoom (siteId: number): SiteRoom | null
{
    const site = getSite(siteId);
    if (!site || site.step >= site.rooms.length)
    {
        return null;
    }
    return site.rooms[site.step] ?? null;
}

export function roomEnd (siteId: number, won: boolean): { advanced: boolean; siteEnded: boolean }
{
    let advanced = false;
    let siteEnded = false;
    let doneWorkType: number | null = null;
    let siteName = '';
    const unlockedNames: string[] = [];

    mutateSession((live) =>
    {
        const site = live.map.sites[siteId];
        if (!site || !won)
        {
            return;
        }
        const doneRoom = site.rooms[site.step];
        if (doneRoom?.type === 'work')
        {
            doneWorkType = doneRoom.workType ?? 0;
        }
        site.step += 1;
        advanced = true;
        if (site.step >= site.rooms.length)
        {
            site.ended = true;
            siteEnded = true;
            const cfg = getSiteConfig(siteId);
            siteName = cfg?.name ?? '';
            // siteEnd unlocks
            for (const unlockId of cfg?.unlockSites ?? [])
            {
                if (!live.map.unlocked.includes(unlockId))
                {
                    live.map.unlocked.push(unlockId);
                    const name = getSiteConfig(unlockId)?.name;
                    if (name)
                    {
                        unlockedNames.push(name);
                    }
                }
            }
        }
    });

    if (advanced)
    {
        // 1117 你打开了箱子/桌子/柜子 (after work room)
        if (doneWorkType !== null)
        {
            const labels = ['箱子', '桌子', '柜子'];
            appendSessionLog(`你打开了${labels[doneWorkType] ?? '箱子'}`);
        }
        if (siteEnded)
        {
            // 1119 你彻底清除了%s里的全部威胁！
            if (siteName)
            {
                appendSessionLog(`你彻底清除了${siteName}里的全部威胁！`);
            }
            // 1104 新地点 %s 解锁！
            for (const name of unlockedNames)
            {
                appendSessionLog(`新地点 ${name} 解锁！`);
            }
        }
        gameBusEmit('session_updated');
    }
    return { advanced, siteEnded };
}

export function playerOut (): void
{
    mutateSession((live) =>
    {
        live.isAtHome = false;
        live.isAtSite = false;
        live.nowSiteId = null;
    });
    appendSessionLog('你离开了家。');
    gameBusEmit('session_updated');
}

export function playerGoHome (): void
{
    const session = getSession();
    if (!session)
    {
        return;
    }
    const wasOutside = !session.isAtHome;
    mutateSession((live) =>
    {
        live.isAtHome = true;
        live.isAtSite = false;
        live.nowSiteId = null;
        const home = getSiteConfig(HOME_SITE_ID);
        if (home)
        {
            live.map.pos = { ...home.coordinate };
        }
    });
    if (wasOutside)
    {
        flushBagToStorage();
        appendSessionLog('你回到了家。');
    }
    gameBusEmit('session_updated');
}

export function enterSite (siteId: number): void
{
    ensureSite(siteId);
    mutateSession((live) =>
    {
        live.isAtHome = false;
        live.isAtSite = true;
        live.nowSiteId = siteId;
        const cfg = getSiteConfig(siteId);
        if (cfg)
        {
            live.map.pos = { ...cfg.coordinate };
        }
    });
    const name = getSiteConfig(siteId)?.name ?? `地点${siteId}`;
    appendSessionLog(`你到达了${name}。`);
    gameBusEmit('session_updated');
}

export function leaveSite (): void
{
    mutateSession((live) =>
    {
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
export function rollTravelEncounter (distance: number): TravelEncounter | null
{
    const session = getSession();
    if (!session || distance < RANDOM_BATTLE_DISTANCE)
    {
        return null;
    }

    const stage = getStageFromHour(session.hour);
    const config = RANDOM_BATTLE_BY_STAGE[stage];
    const checks = Math.floor(distance / RANDOM_BATTLE_DISTANCE);
    for (let i = 0; i < checks; i++)
    {
        if (Math.random() > config.probability)
        {
            continue;
        }
        const [minDiff, maxDiff] = config.difficulty;
        const difficulty =
            minDiff + Math.floor(Math.random() * (maxDiff - minDiff + 1));
        // P0 monster packs only cover difficulty 1; clamp for pack lookup.
        const monsters = rollMonsterList(Math.min(difficulty, 1));
        appendSessionLog('遭遇僵尸！');
        return { difficulty, monsters };
    }
    return null;
}

export function planTravel (siteId: number): TravelPlan | null
{
    const session = getSession();
    const cfg = getSiteConfig(siteId);
    if (!session || !cfg)
    {
        return null;
    }
    if (!session.map.unlocked.includes(siteId) && siteId !== HOME_SITE_ID)
    {
        return null;
    }
    const distance = mapDistance(session.map.pos, cfg.coordinate);
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
export function travelTo (siteId: number, onArrived?: () => void): boolean
{
    const plan = planTravel(siteId);
    if (!plan)
    {
        return false;
    }

    const jump = Math.min(plan.gameSeconds, 6 * 3600);
    mutateSession((live) =>
    {
        applyGameTimeToSession(live, live.gameTime + jump);
    });

    if (siteId === HOME_SITE_ID)
    {
        playerGoHome();
    }
    else
    {
        enterSite(siteId);
    }
    onArrived?.();
    return true;
}

export function fillTempLootFromRoom (siteId: number): SiteLoot[]
{
    const room = currentRoom(siteId);
    if (room?.type !== 'work')
    {
        return [];
    }
    const loot = (room.loot ?? []).map((row) => ({ ...row }));
    mutateSession((live) =>
    {
        live.tempLoot = {};
        for (const row of loot)
        {
            live.tempLoot[row.itemId] = (live.tempLoot[row.itemId] ?? 0) + row.num;
        }
    });
    gameBusEmit('session_updated');
    return loot;
}

/** Flush remaining temp loot into site storage (work room leave). */
export function flushTempToSite (siteId: number): void
{
    mutateSession((live) =>
    {
        const site = live.map.sites[siteId];
        if (!site)
        {
            live.tempLoot = {};
            return;
        }
        for (const [idText, num] of Object.entries(live.tempLoot))
        {
            const itemId = Number(idText);
            if (!Number.isFinite(itemId) || num <= 0)
            {
                continue;
            }
            site.storage[itemId] = (site.storage[itemId] ?? 0) + num;
            site.haveNewItems = true;
        }
        live.tempLoot = {};
    });
    gameBusEmit('session_updated');
}

export function siteStorageCount (siteId: number): number
{
    const site = getSite(siteId);
    if (!site)
    {
        return 0;
    }
    return Object.values(site.storage).reduce((sum, n) => sum + n, 0);
}
