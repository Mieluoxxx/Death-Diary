/**
 * In-run session for Home + P0 main loop (nav / bag / map / site).
 * Time: `gameTime` (total game seconds) is the source of truth;
 * `day` / `hour` / `minute` / `season` are derived for UI.
 */

import { BULLET_ID, HAND_ITEM_ID } from '../data/itemConfig';
import { getSiteConfig, HOME_SITE_ID, STARTER_SITE_ID } from '../data/siteConfig';

export type RoleKey = 'STRANGER' | 'LUO' | 'YAZI';
export type TalentId = 0 | 101 | 102 | 103 | 104;

export type PlayerAttrs = {
    hp: number;
    hpMax: number;
    injury: number;
    infect: number;
    starve: number;
    vigour: number;
    spirit: number;
};

export type SessionLogEntry = {
    text: string;
    /** Display clock at log time, e.g. "第1天 08:00" */
    timeLabel: string;
};

export type ItemCounts = Record<number, number>;

/** EquipmentPos: 0 gun, 1 weapon, 2 equip, 3 tool. Weapon default HAND=1. */
export type EquipState = Record<0 | 1 | 2 | 3, number>;

export type NavEntry = {
    nodeName: string;
    userData?: unknown;
};

export type SiteRoom =
    | { type: 'battle'; difficulty: number; monsters: number[] }
    | {
        type: 'work';
        /** 0..2 → work_dig_N + string 3008 */
        workType: number;
        loot: Array<{ itemId: number; num: number }>;
    };

export type SiteState = {
    siteId: number;
    step: number;
    rooms: SiteRoom[];
    storage: ItemCounts;
    haveNewItems: boolean;
    closed: boolean;
    ended: boolean;
};

export type MapState = {
    pos: { x: number; y: number };
    unlocked: number[];
    /** NPC homes unlocked on the map (optional; older saves omit). */
    unlockedNpcs?: number[];
    sites: Record<number, SiteState>;
};

export type SessionState = {
    role: RoleKey;
    talent: TalentId;
    /** Total game seconds (source of truth for the clock). */
    gameTime: number;
    day: number;
    hour: number;
    minute: number;
    season: 0 | 1 | 2 | 3;
    weatherId: number;
    temperature: number;
    attrs: PlayerAttrs;
    /** Building id → level (-1 unbuilt, 0+ built). */
    buildLevels: Record<number, number>;
    /** Home warehouse itemId → count. */
    storage: ItemCounts;
    /** Carry bag (weight-limited). */
    bag: ItemCounts;
    /** Four equipment slots. */
    equip: EquipState;
    /** Navigation stack (BottomFrame). */
    navigation: NavEntry[];
    /** Map position + unlocked sites + site progress. */
    map: MapState;
    /** Work-room temp loot before flush to site/bag. */
    tempLoot: ItemCounts;
    isAtSite: boolean;
    nowSiteId: number | null;
    /** Latest log line (TopFrame strip). */
    lastLog: string;
    /** Recent log history (newest last). */
    logs: SessionLogEntry[];
    isAtHome: boolean;
    isInSleep: boolean;
    isDead: boolean;
    /**
     * Luo minefield charge (original player.isBombActive).
     * Consumed on successful night-raid auto-defend.
     */
    isBombActive: boolean;
    /**
     * Dog hunger (original Dog.starve). Active when > 0 → +10 home def.
     * Full after feed ≈ 50 (original encode of 0b110010).
     */
    dogStarve: number;
    dogStarveMax: number;
    /** Electric fence (bid 19) fuel/active flag for Yazi auto-defend. */
    electricFenceActive: boolean;
};

const STORAGE_KEY = 'buried_city_session_v3';
const MAX_LOG_ENTRIES = 40;

const DEFAULT_ATTRS: PlayerAttrs = {
    hp: 100,
    hpMax: 100,
    injury: 0,
    infect: 0,
    starve: 80,
    vigour: 80,
    spirit: 80,
};

const SECONDS_PER_DAY = 24 * 60 * 60;
const SECONDS_PER_HOUR = 60 * 60;
const SECONDS_PER_MINUTE = 60;

let activeSession: SessionState | null = null;

/**
 * Port of Room.initData(): most facilities start unbuilt (-1);
 * toolbox(1), storage(13), gate(14) start at 0; Luo minefield(17) at 0.
 */
function defaultBuildLevels (role: RoleKey): Record<number, number>
{
    const levels: Record<number, number> = {
        1: 0,
        2: -1,
        3: -1,
        4: -1,
        6: -1,
        8: -1,
        9: -1,
        10: -1,
        12: -1,
        13: 0,
        14: 0,
        15: -1,
    };

    if (role === 'LUO')
    {
        levels[5] = -1;
        levels[16] = -1;
        levels[17] = 0;
    }
    else if (role === 'YAZI')
    {
        levels[7] = -1;
        levels[18] = -1;
        levels[19] = -1;
    }
    else
    {
        levels[5] = -1;
        levels[7] = -1;
        levels[11] = -1;
    }

    return levels;
}

/** Starter materials so first upgrades are playable without exploring. */
function defaultStorage (): ItemCounts
{
    return {
        1101011: 20, // wood
        1101021: 16, // metal
        1101031: 10, // soft
        1101041: 16, // parts
        1101051: 8,  // electric
        1101061: 6,  // water
        1103083: 4,  // canned food
        1302011: 1,  // crowbar
        1301011: 1,  // pistol
        1304012: 1,  // coat
        [BULLET_ID]: 40,
    };
}

function defaultBag (): ItemCounts
{
    // Dev convenience: start with one equipped chainsaw in bag.
    return {
        1302043: 1,
    };
}

function defaultEquip (): EquipState
{
    return {
        0: 0,
        1: HAND_ITEM_ID,
        2: 0,
        3: 0,
    };
}

function defaultMap (): MapState
{
    const home = getSiteConfig(HOME_SITE_ID);
    return {
        pos: home ? { ...home.coordinate } : { x: 45, y: 50 },
        unlocked: [HOME_SITE_ID, STARTER_SITE_ID],
        sites: {},
    };
}

/** Convert display day/hour/minute → total game seconds (day 1 00:00 = 0). */
export function gameTimeFromClock (day: number, hour: number, minute: number): number
{
    const dayIndex = Math.max(0, day - 1);
    return dayIndex * SECONDS_PER_DAY + hour * SECONDS_PER_HOUR + minute * SECONDS_PER_MINUTE;
}

export type ClockParts = {
    day: number;
    hour: number;
    minute: number;
    second: number;
    season: 0 | 1 | 2 | 3;
    stage: 'day' | 'night';
};

/** Original stageTime: day = [6, 20), else night. */
export function getStageFromHour (hour: number): 'day' | 'night'
{
    return hour >= 6 && hour < 20 ? 'day' : 'night';
}

export function clockPartsFromGameTime (gameTime: number): ClockParts
{
    const safeTime = Math.max(0, gameTime);
    const dayIndex = Math.floor(safeTime / SECONDS_PER_DAY);
    const dayRemainder = safeTime % SECONDS_PER_DAY;
    const hour = Math.floor(dayRemainder / SECONDS_PER_HOUR);
    const hourRemainder = dayRemainder % SECONDS_PER_HOUR;
    const minute = Math.floor(hourRemainder / SECONDS_PER_MINUTE);
    const second = Math.floor(hourRemainder % SECONDS_PER_MINUTE);
    const season = Math.floor((dayIndex % 120) / 30) as 0 | 1 | 2 | 3;

    return {
        day: dayIndex + 1,
        hour,
        minute,
        second,
        season,
        stage: getStageFromHour(hour),
    };
}

/** Write derived clock fields from `gameTime` onto a session object (mutates). */
export function applyGameTimeToSession (session: SessionState, gameTime: number): void
{
    const parts = clockPartsFromGameTime(gameTime);
    session.gameTime = gameTime;
    session.day = parts.day;
    session.hour = parts.hour;
    session.minute = parts.minute;
    session.season = parts.season;
}

function normalizeSession (raw: SessionState): SessionState
{
    const day = typeof raw.day === 'number' ? raw.day : 1;
    const hour = typeof raw.hour === 'number' ? raw.hour : 8;
    const minute = typeof raw.minute === 'number' ? raw.minute : 0;
    const gameTime =
        typeof raw.gameTime === 'number'
            ? raw.gameTime
            : gameTimeFromClock(day, hour, minute);

    const role = raw.role;
    let buildLevels = raw.buildLevels ?? defaultBuildLevels(role);
    // Old web-slice saves put every building at 0 — re-seed to Room.initData defaults.
    if (looksLikeLegacyAllZeroBuilds(buildLevels))
    {
        buildLevels = defaultBuildLevels(role);
    }

    const session: SessionState = {
        role,
        talent: raw.talent,
        gameTime,
        day,
        hour,
        minute,
        season: raw.season ?? 0,
        weatherId: raw.weatherId ?? 0,
        temperature: raw.temperature ?? 18,
        attrs: { ...DEFAULT_ATTRS, ...(raw.attrs ?? {}) },
        buildLevels,
        storage: raw.storage ?? defaultStorage(),
        bag: raw.bag ?? defaultBag(),
        equip: normalizeEquip(raw.equip),
        navigation: Array.isArray(raw.navigation) ? raw.navigation : [{ nodeName: 'HomeNode' }],
        map: normalizeMap(raw.map),
        tempLoot: raw.tempLoot ?? {},
        isAtSite: Boolean(raw.isAtSite),
        nowSiteId: typeof raw.nowSiteId === 'number' ? raw.nowSiteId : null,
        lastLog: raw.lastLog ?? '',
        logs: Array.isArray(raw.logs) ? raw.logs.slice(-MAX_LOG_ENTRIES) : [],
        isAtHome: raw.isAtHome !== false,
        isInSleep: Boolean(raw.isInSleep),
        isDead: Boolean(raw.isDead),
        isBombActive: Boolean(raw.isBombActive),
        dogStarve: typeof raw.dogStarve === 'number' ? raw.dogStarve : 0,
        dogStarveMax: typeof raw.dogStarveMax === 'number' ? raw.dogStarveMax : 50,
        electricFenceActive: Boolean(raw.electricFenceActive),
    };
    applyGameTimeToSession(session, gameTime);
    return session;
}

function normalizeEquip (raw: EquipState | undefined): EquipState
{
    const base = defaultEquip();
    if (!raw || typeof raw !== 'object')
    {
        return base;
    }
    return {
        0: typeof raw[0] === 'number' ? raw[0] : 0,
        1: typeof raw[1] === 'number' ? raw[1] : HAND_ITEM_ID,
        2: typeof raw[2] === 'number' ? raw[2] : 0,
        3: typeof raw[3] === 'number' ? raw[3] : 0,
    };
}

function normalizeMap (raw: MapState | undefined): MapState
{
    const base = defaultMap();
    if (!raw || typeof raw !== 'object')
    {
        return base;
    }
    return {
        pos: raw.pos && typeof raw.pos.x === 'number'
            ? { x: raw.pos.x, y: raw.pos.y }
            : base.pos,
        unlocked: Array.isArray(raw.unlocked) && raw.unlocked.length > 0
            ? raw.unlocked
            : base.unlocked,
        sites: raw.sites && typeof raw.sites === 'object' ? raw.sites : {},
    };
}

/** True if every known building is level 0 (pre-facility-migration save). */
function looksLikeLegacyAllZeroBuilds (levels: Record<number, number>): boolean
{
    const values = Object.values(levels);
    if (values.length < 8)
    {
        return false;
    }
    return values.every((level) => level === 0);
}

export function createNewSession (role: RoleKey, talent: TalentId): SessionState
{
    // Original starts ~06:00 day 0 (display day 1). Slice uses 08:00 for a lived-in feel.
    const gameTime = gameTimeFromClock(1, 8, 0);
    const session: SessionState = normalizeSession({
        role,
        talent,
        gameTime,
        day: 1,
        hour: 8,
        minute: 0,
        season: 0,
        weatherId: 0,
        temperature: 18,
        attrs: { ...DEFAULT_ATTRS },
        buildLevels: defaultBuildLevels(role),
        storage: defaultStorage(),
        bag: defaultBag(),
        equip: defaultEquip(),
        navigation: [{ nodeName: 'HomeNode' }],
        map: defaultMap(),
        tempLoot: {},
        isAtSite: false,
        nowSiteId: null,
        lastLog: '你回到了避难所。',
        logs: [
            {
                text: '你回到了避难所。',
                timeLabel: '第1天 08:00',
            },
        ],
        isAtHome: true,
        isInSleep: false,
        isDead: false,
        isBombActive: false,
        dogStarve: 0,
        dogStarveMax: 50,
        electricFenceActive: false,
    });
    activeSession = session;
    persistSession(session);
    return session;
}

export function getSession (): SessionState | null
{
    if (activeSession)
    {
        return activeSession;
    }
    return loadSession();
}

export function hasSession (): boolean
{
    return getSession() !== null;
}

export function setSession (session: SessionState): void
{
    activeSession = normalizeSession(session);
    persistSession(activeSession);
}

export function updateSession (partial: Partial<SessionState>): SessionState
{
    const current = getSession();
    if (!current)
    {
        throw new Error('No active session');
    }
    const next: SessionState = {
        ...current,
        ...partial,
        attrs: partial.attrs
            ? { ...current.attrs, ...partial.attrs }
            : current.attrs,
        logs: partial.logs ?? current.logs,
        buildLevels: partial.buildLevels
            ? { ...current.buildLevels, ...partial.buildLevels }
            : current.buildLevels,
        storage: partial.storage
            ? { ...current.storage, ...partial.storage }
            : current.storage,
        bag: partial.bag ? { ...current.bag, ...partial.bag } : current.bag,
        equip: partial.equip ? { ...current.equip, ...partial.equip } : current.equip,
        navigation: partial.navigation ?? current.navigation,
        map: partial.map
            ? {
                pos: partial.map.pos ?? current.map.pos,
                unlocked: partial.map.unlocked ?? current.map.unlocked,
                sites: partial.map.sites
                    ? { ...current.map.sites, ...partial.map.sites }
                    : current.map.sites,
            }
            : current.map,
        tempLoot: partial.tempLoot ?? current.tempLoot,
    };
    if (typeof partial.gameTime === 'number')
    {
        applyGameTimeToSession(next, partial.gameTime);
    }
    activeSession = next;
    persistSession(next);
    return next;
}

/**
 * Mutate the live session in place, persist, return it.
 * Prefer this for high-frequency ticks so we do not reallocate every hour.
 */
export function mutateSession (mutator: (session: SessionState) => void): SessionState
{
    const current = getSession();
    if (!current)
    {
        throw new Error('No active session');
    }
    mutator(current);
    activeSession = current;
    persistSession(current);
    return current;
}

export function appendSessionLog (text: string, timeLabel?: string): SessionState
{
    return mutateSession((session) =>
    {
        const label =
            timeLabel
            ?? `第${session.day}天 ${formatClock(session)}`;
        const entry: SessionLogEntry = { text, timeLabel: label };
        session.logs = [...session.logs, entry].slice(-MAX_LOG_ENTRIES);
        session.lastLog = text;
    });
}

function persistSession (session: SessionState): void
{
    try
    {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }
    catch
    {
        // ignore quota / private mode
    }
}

function loadSession (): SessionState | null
{
    try
    {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
        {
            return null;
        }
        const parsed = JSON.parse(raw) as SessionState;
        if (!parsed || typeof parsed.day !== 'number' || !parsed.role)
        {
            return null;
        }
        activeSession = normalizeSession(parsed);
        return activeSession;
    }
    catch
    {
        return null;
    }
}

export function formatClock (session: SessionState): string
{
    const hourText = String(session.hour).padStart(2, '0');
    const minuteText = String(session.minute).padStart(2, '0');
    return `${hourText}:${minuteText}`;
}

/** Map attr fill ratio to icon tier 0/1/2 (visual only for web slice). */
export function attrIconTier (ratio: number, reverse = false): 0 | 1 | 2
{
    const value = reverse ? 1 - ratio : ratio;
    if (value >= 0.66)
    {
        return 0;
    }
    if (value >= 0.33)
    {
        return 1;
    }
    return 2;
}

export function attrRatio (session: SessionState, attr: keyof PlayerAttrs): number
{
    if (attr === 'hp')
    {
        return session.attrs.hp / Math.max(1, session.attrs.hpMax);
    }
    if (attr === 'hpMax')
    {
        return 1;
    }
    // injury/infect: higher is worse; others are "fullness" style 0–100
    if (attr === 'injury' || attr === 'infect')
    {
        return Math.min(1, Math.max(0, session.attrs[attr] / 100));
    }
    return Math.min(1, Math.max(0, session.attrs[attr] / 100));
}


export function getStorageCount (itemId: number): number
{
    const session = getSession();
    if (!session)
    {
        return 0;
    }
    return session.storage[itemId] ?? 0;
}

export function validateStorageItems (
    costs: Array<{ itemId: number; num: number }>,
): boolean
{
    const session = getSession();
    if (!session)
    {
        return false;
    }
    return costs.every((cost) => (session.storage[cost.itemId] ?? 0) >= cost.num);
}

export function costStorageItems (
    costs: Array<{ itemId: number; num: number }>,
): boolean
{
    if (!validateStorageItems(costs))
    {
        return false;
    }
    mutateSession((session) =>
    {
        costs.forEach((cost) =>
        {
            const have = session.storage[cost.itemId] ?? 0;
            const next = have - cost.num;
            if (next <= 0)
            {
                delete session.storage[cost.itemId];
            }
            else
            {
                session.storage[cost.itemId] = next;
            }
        });
    });
    return true;
}

export function gainStorageItems (
    items: Array<{ itemId: number; num: number }>,
): void
{
    mutateSession((session) =>
    {
        items.forEach((item) =>
        {
            session.storage[item.itemId] = (session.storage[item.itemId] ?? 0) + item.num;
        });
    });
}

export function getBuildLevel (bid: number): number
{
    const session = getSession();
    if (!session)
    {
        return -1;
    }
    return session.buildLevels[bid] ?? -1;
}

export function setBuildLevel (bid: number, level: number): void
{
    mutateSession((session) =>
    {
        session.buildLevels[bid] = level;
    });
}
