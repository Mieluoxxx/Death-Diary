/**
 * Port of Buried-City player.start() survival hooks (A-slice).
 *
 * Registers:
 *  - every hour: updateByTime + temperature + band effects
 *  - day/night edges: stage logs (weather/NPC/medal deferred)
 *  - every midnight: season check + day log (night raid deferred)
 *
 * Call startSurvivalLoop() after startTimeClock() when entering Home.
 * Call stopSurvivalLoop() when leaving the in-game scene to MainMenu.
 */

import { CHANGE_BY_TIME, TEMPERATURE_BY_SEASON } from '../data/playerConfig';
import { findAttrBand } from '../data/playerAttrEffect';
import {
    appendSessionLog,
    clockPartsFromGameTime,
    formatClock,
    getSession,
    type SessionState,
} from '../session/sessionStore';
import { checkDay as medalCheckDay } from '../medal/medalStore';
import { gameBusEmit } from './gameBus';
import {
    changeAttr,
    changeStarve,
    changeVigour,
    changeHp,
    getAttrBand,
} from './playerAttrs';
import {
    STAGE_DAY_HOUR,
    STAGE_NIGHT_HOUR,
    addTimerCallback,
    alignIntervalStart,
    everyGameInterval,
    getCurrentStage,
    isTimeClockRunning,
    startTimeClock,
    stopTimeClock,
    REPEAT_FOREVER,
} from './timeClock';

const SECONDS_PER_HOUR = 60 * 60;
const SECONDS_PER_DAY = 24 * 60 * 60;

let survivalActive = false;

export function isSurvivalLoopActive (): boolean
{
    return survivalActive;
}

/**
 * Boot clock + survival timers for the current session.
 * Safe to call once per Home enter; no-ops if already running with same session.
 */
export function startSurvivalLoop (): void
{
    const session = getSession();
    if (!session || session.isDead)
    {
        return;
    }

    if (survivalActive && isTimeClockRunning())
    {
        return;
    }

    startTimeClock();
    survivalActive = true;

    const now = session.gameTime;

    // Whole hour — matches addTimerCallbackHourByHour.
    const hourStart = alignIntervalStart(now, SECONDS_PER_HOUR);
    everyGameInterval(SECONDS_PER_HOUR, () =>
    {
        runHourlySurvivalTick();
    }, { startTime: hourStart, priority: 10 });

    // Midnight (day boundary) — matches addTimerCallbackDayByDay.
    const dayStart = alignIntervalStart(now, SECONDS_PER_DAY);
    everyGameInterval(SECONDS_PER_DAY, () =>
    {
        runDailySurvivalTick();
    }, { startTime: dayStart, priority: 5 });

    // Dawn 06:00 and dusk 20:00 — matches addTimerCallbackDayAndNight.
    scheduleDailyHour(STAGE_DAY_HOUR, () => onStageEdge('day'));
    scheduleDailyHour(STAGE_NIGHT_HOUR, () => onStageEdge('night'));
}

export function stopSurvivalLoop (): void
{
    survivalActive = false;
    stopTimeClock();
}

function scheduleDailyHour (hour: number, onFire: () => void): void
{
    const session = getSession();
    if (!session)
    {
        return;
    }
    const now = session.gameTime;
    const parts = clockPartsFromGameTime(now);
    // Anchor: most recent occurrence of `hour:00` at or before now.
    let anchorDayIndex = parts.day - 1;
    let anchor = anchorDayIndex * SECONDS_PER_DAY + hour * SECONDS_PER_HOUR;
    if (anchor > now)
    {
        anchor -= SECONDS_PER_DAY;
    }
    addTimerCallback(SECONDS_PER_DAY, { end: onFire }, {
        startTime: anchor,
        repeat: REPEAT_FOREVER,
        priority: 8,
    });
}

/** Exposed for tests / debug: run one hour of survival rules immediately. */
export function runHourlySurvivalTick (): void
{
    const session = getSession();
    if (!session || session.isDead)
    {
        return;
    }

    updateByTime(session);
    updateTemperature(session);
    updateTemperatureEffect(session);
    updateBandEffects(session);

    // Persist + notify UI once per hour batch.
    try
    {
        localStorage.setItem('buried_city_session_v1', JSON.stringify(session));
    }
    catch
    {
        // ignore
    }
    gameBusEmit('session_updated');
}

function runDailySurvivalTick (): void
{
    const session = getSession();
    if (!session || session.isDead)
    {
        return;
    }

    // Night raid deferred (P1). Season check + log.
    const parts = clockPartsFromGameTime(session.gameTime);
    appendSessionLog(
        `新的一天开始了（第${parts.day}天）。`,
        `第${parts.day}天 ${formatClock(session)}`,
    );
    gameBusEmit('logChanged', {
        text: session.lastLog,
        timeLabel: session.logs[session.logs.length - 1]?.timeLabel ?? '',
    });
    gameBusEmit('session_updated');
}

function onStageEdge (stage: 'day' | 'night'): void
{
    const session = getSession();
    if (!session || session.isDead)
    {
        return;
    }

    if (stage === 'day')
    {
        appendSessionLog('天亮了。', `第${session.day}天 ${formatClock(session)}`);
        // Original: weather / NPC / Medal.checkDay(1)
        medalCheckDay(1);
    }
    else
    {
        appendSessionLog('夜幕降临。', `第${session.day}天 ${formatClock(session)}`);
    }

    gameBusEmit('logChanged', {
        text: session.lastLog,
        timeLabel: session.logs[session.logs.length - 1]?.timeLabel ?? '',
    });
    gameBusEmit('stage_change', stage);
    gameBusEmit('session_updated');
}

/**
 * Port of player.updateByTime (without dog / weather / sleep recovery for A).
 * Sleep recovery is included if isInSleep (bed not wired yet — flag only).
 */
function updateByTime (session: SessionState): void
{
    const c = CHANGE_BY_TIME;
    changeStarve(c[0][0]);

    const stage = getCurrentStage();
    if (stage === 'day')
    {
        changeVigour(session.isAtHome ? c[2][0] : c[3][0]);
    }
    else
    {
        changeVigour(session.isAtHome ? c[4][0] : c[5][0]);
    }

    // Sleep recovery (bed rate deferred — use flat modest heal if sleeping).
    if (session.isInSleep)
    {
        const starveRatio = session.attrs.starve / 100;
        const spiritRatio = session.attrs.spirit / 100;
        // bedRate ≈ 0.5*0.5 + starve*0.2 + spirit*0.3 when bed level 0 rate~0.5
        const bedRate = 0.25 + starveRatio * 0.2 + spiritRatio * 0.3;
        changeVigour(Math.ceil(bedRate * 15));
        changeHp(Math.ceil(bedRate * 20));
    }
}

function updateTemperature (session: SessionState): void
{
    const seasonRow = TEMPERATURE_BY_SEASON[session.season] ?? TEMPERATURE_BY_SEASON[0];
    const stage = getCurrentStage();
    let target = seasonRow[0];
    target += stage === 'day' ? seasonRow[1] : seasonRow[2];
    // Fire / electric stove deferred.
    const delta = target - session.temperature;
    if (delta !== 0)
    {
        changeAttr('temperature', delta);
    }
}

function updateTemperatureEffect (session: SessionState): void
{
    const band = getAttrBand('temperature', session.temperature);
    if (!band)
    {
        return;
    }
    for (const [attrKey, raw] of Object.entries(band.effect))
    {
        if (raw === undefined || raw === 0)
        {
            continue;
        }
        if (
            attrKey === 'hp'
            || attrKey === 'spirit'
            || attrKey === 'starve'
            || attrKey === 'vigour'
            || attrKey === 'injury'
            || attrKey === 'infect'
            || attrKey === 'temperature'
        )
        {
            changeAttr(attrKey, raw);
        }
    }
}

/**
 * Port of updateStarve / updateInjure / updateInfect / updateVigour band effects.
 */
function updateBandEffects (session: SessionState): void
{
    applyBand('starve', session.attrs.starve, false);
    applyBand('vigour', session.attrs.vigour, false);
    applyBand('injury', session.attrs.injury, false);
    applyInfectBand(session);
}

function applyBand (attrKey: string, value: number, _unused: boolean): void
{
    const band = findAttrBand(attrKey, value);
    if (!band)
    {
        return;
    }
    for (const [effectKey, raw] of Object.entries(band.effect))
    {
        if (raw === undefined || raw === 0)
        {
            continue;
        }
        if (
            effectKey === 'hp'
            || effectKey === 'spirit'
            || effectKey === 'starve'
            || effectKey === 'vigour'
            || effectKey === 'injury'
            || effectKey === 'infect'
            || effectKey === 'temperature'
        )
        {
            changeAttr(effectKey, raw);
        }
    }
}

function applyInfectBand (session: SessionState): void
{
    const band = findAttrBand('infect', session.attrs.infect);
    if (!band)
    {
        return;
    }
    for (const [effectKey, raw] of Object.entries(band.effect))
    {
        if (raw === undefined || raw === 0)
        {
            continue;
        }
        let value = raw;
        // Original: infect→hp scaled by infect/100.
        if (effectKey === 'hp')
        {
            value = Math.ceil(raw * (session.attrs.infect / 100));
        }
        if (
            effectKey === 'hp'
            || effectKey === 'spirit'
            || effectKey === 'starve'
            || effectKey === 'vigour'
            || effectKey === 'injury'
            || effectKey === 'infect'
            || effectKey === 'temperature'
        )
        {
            changeAttr(effectKey, value);
        }
    }
}

/** Debug helper: jump forward N game hours without waiting. */
export function debugSkipGameHours (hours: number): void
{
    const session = getSession();
    if (!session || !survivalActive)
    {
        return;
    }
    // Manually fire hourly ticks for predictability in debug.
    const steps = Math.max(0, Math.floor(hours));
    for (let index = 0; index < steps; index++)
    {
        session.gameTime += SECONDS_PER_HOUR;
        const parts = clockPartsFromGameTime(session.gameTime);
        session.day = parts.day;
        session.hour = parts.hour;
        session.minute = parts.minute;
        session.season = parts.season;
        runHourlySurvivalTick();
        if (session.isDead)
        {
            break;
        }
    }
}
