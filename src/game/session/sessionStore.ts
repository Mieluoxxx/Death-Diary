/**
 * Minimal in-run session for the Home vertical slice.
 * Not a full SaveService — just enough to show role/talent/day/attrs
 * and keep Continue enabled across menu restarts in the same browser tab.
 *
 * Time: `gameTime` (total game seconds) is the source of truth;
 * `day` / `hour` / `minute` / `season` are derived for UI and older code.
 */

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
    /** Building id → level (-1 unbuilt, 0+ built). Web slice: all at 0. */
    buildLevels: Record<number, number>;
    /** Latest log line (TopFrame strip). */
    lastLog: string;
    /** Recent log history (newest last). */
    logs: SessionLogEntry[];
    isAtHome: boolean;
    isInSleep: boolean;
    isDead: boolean;
};

const STORAGE_KEY = 'buried_city_session_v1';
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

/** Stranger starter buildings (level 0) — matches HomeNode infos + stranger branch. */
const STRANGER_BUILD_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const SECONDS_PER_DAY = 24 * 60 * 60;
const SECONDS_PER_HOUR = 60 * 60;
const SECONDS_PER_MINUTE = 60;

let activeSession: SessionState | null = null;

function defaultBuildLevels (role: RoleKey): Record<number, number>
{
    const levels: Record<number, number> = {};
    const ids =
        role === 'LUO'
            ? [1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 13, 14, 15, 16, 17]
            : role === 'YAZI'
                ? [1, 2, 3, 4, 6, 7, 8, 9, 10, 12, 13, 14, 15, 18, 19]
                : STRANGER_BUILD_IDS;

    ids.forEach((buildId) =>
    {
        levels[buildId] = 0;
    });
    return levels;
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

    const session: SessionState = {
        role: raw.role,
        talent: raw.talent,
        gameTime,
        day,
        hour,
        minute,
        season: raw.season ?? 0,
        weatherId: raw.weatherId ?? 0,
        temperature: raw.temperature ?? 18,
        attrs: { ...DEFAULT_ATTRS, ...(raw.attrs ?? {}) },
        buildLevels: raw.buildLevels ?? defaultBuildLevels(raw.role),
        lastLog: raw.lastLog ?? '',
        logs: Array.isArray(raw.logs) ? raw.logs.slice(-MAX_LOG_ENTRIES) : [],
        isAtHome: raw.isAtHome !== false,
        isInSleep: Boolean(raw.isInSleep),
        isDead: Boolean(raw.isDead),
    };
    applyGameTimeToSession(session, gameTime);
    return session;
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
