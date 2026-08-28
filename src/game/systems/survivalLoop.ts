/**
 * Port of Buried-City player.start() survival hooks.
 *
 * Registers:
 *  - every hour: updateByTime + temperature + band effects + cure/bind expiry
 *  - day/night edges: stage logs + weather check at dawn
 *  - every midnight: season check + day log + night raid
 *
 * Call startSurvivalLoop() after startTimeClock() when entering Home.
 * Call stopSurvivalLoop() when leaving the in-game scene to MainMenu.
 */

import { BED_RATES } from '../data/buildActionConfig';
import { findAttrBand } from '../data/playerAttrEffect';
import {
    CHANGE_BY_TIME,
    FIRE_TEMPERATURE_BONUS,
    TEMPERATURE_BY_SEASON,
} from '../data/playerConfig';
import { getWeatherEffects, getWeatherValue, rollWeatherForSeason } from '../data/weatherConfig';
import { checkDay as medalCheckDay } from '../medal/medalStore';
import {
    appendSessionLog,
    clockPartsFromGameTime,
    formatClock,
    getSession,
    mutateSession,
    type SessionState,
} from '../session/sessionStore';
import { clearCraftRuntime } from './craftSystem';
import { clearBattle } from './battleSystem';
import { gameBusEmit } from './gameBus';
import { runNightRaid } from './nightRaidSystem';
import { refreshNpcTrading, runNpcDailyVisit } from './npcSystem';
import {
    changeAttr,
    changeHp,
    changeSpirit,
    changeStarve,
    changeVigour,
    getAttrBand,
    isBuffActive,
    isInBind,
    isInCure,
    tickBuff,
} from './playerAttrs';
import {
    INFECT_IMMUNE_BUFF_ITEM_ID,
    STARVE_IMMUNE_BUFF_ITEM_ID,
    VIGOUR_IMMUNE_BUFF_ITEM_ID,
} from '../data/itemEffects';
import {
    addTimerCallback,
    alignIntervalStart,
    everyGameInterval,
    getCurrentStage,
    isTimeClockRunning,
    REPEAT_FOREVER,
    STAGE_DAY_HOUR,
    STAGE_NIGHT_HOUR,
    startTimeClock,
    stopTimeClock,
} from './timeClock';
import { clearAllTimedProgress } from './timedProgress';

const SECONDS_PER_HOUR = 60 * 60;
const SECONDS_PER_DAY = 24 * 60 * 60;
const CURE_BIND_DURATION = 24 * 60 * 60;

const WEATHER_LOG: Record<number, string> = {
    0: '天气转为多云。本地最常见的就是这种死气沉沉，一成不变的日子。',
    1: '一线曙光初现，预示着今天是个晴朗和干燥的日子。',
    2: '下雨了，淅淅沥沥的雨水浇灌着你的农作物，也把你的心情冲得七零八落。',
    3: '你所担忧的大雪终于来了，不仅带来了恐怖的寒潮，也堵塞了道路。',
    4: '大雾弥漫，能见度极差。',
};

let survivalActive = false;

export function isSurvivalLoopActive(): boolean {
    return survivalActive;
}

/**
 * Boot clock + survival timers for the current session.
 * Safe to call once per Home enter; no-ops if already running with same session.
 */
export function startSurvivalLoop(): void {
    const session = getSession();
    if (!session || session.isDead) {
        return;
    }

    if (survivalActive && isTimeClockRunning()) {
        return;
    }

    startTimeClock();
    survivalActive = true;

    const now = session.gameTime;

    const hourStart = alignIntervalStart(now, SECONDS_PER_HOUR);
    everyGameInterval(
        SECONDS_PER_HOUR,
        () => {
            runHourlySurvivalTick();
        },
        { startTime: hourStart, priority: 10 },
    );

    const dayStart = alignIntervalStart(now, SECONDS_PER_DAY);
    everyGameInterval(
        SECONDS_PER_DAY,
        () => {
            runDailySurvivalTick();
        },
        { startTime: dayStart, priority: 5 },
    );

    scheduleDailyHour(STAGE_DAY_HOUR, () => onStageEdge('day'));
    scheduleDailyHour(STAGE_NIGHT_HOUR, () => onStageEdge('night'));
}

export function stopSurvivalLoop(): void {
    survivalActive = false;
    clearBattle();
    clearAllTimedProgress();
    clearCraftRuntime();
    stopTimeClock();
}

function scheduleDailyHour(hour: number, onFire: () => void): void {
    const session = getSession();
    if (!session) {
        return;
    }
    const now = session.gameTime;
    const parts = clockPartsFromGameTime(now);
    const anchorDayIndex = parts.day - 1;
    let anchor = anchorDayIndex * SECONDS_PER_DAY + hour * SECONDS_PER_HOUR;
    if (anchor > now) {
        anchor -= SECONDS_PER_DAY;
    }
    addTimerCallback(
        SECONDS_PER_DAY,
        { end: onFire },
        {
            startTime: anchor,
            repeat: REPEAT_FOREVER,
            priority: 8,
        },
    );
}

/** Exposed for tests / debug: run one hour of survival rules immediately. */
export function runHourlySurvivalTick(): void {
    const session = getSession();
    if (!session || session.isDead) {
        return;
    }

    tickBuff(SECONDS_PER_HOUR, session);
    expireCureBind(session);
    maybeBurnBonfireFuel(session);
    updateByTime(session);
    updateTemperature(session);
    updateTemperatureEffect(session);
    updateBandEffects(session);

    mutateSession(() => {});
    gameBusEmit('session_updated');
}

function expireCureBind(session: SessionState): void {
    const now = session.gameTime;
    if (session.binded && session.bindTime && now - session.bindTime >= CURE_BIND_DURATION) {
        session.binded = false;
    }
    if (session.cured && session.cureTime && now - session.cureTime >= CURE_BIND_DURATION) {
        session.cured = false;
    }
}

function runDailySurvivalTick(): void {
    const session = getSession();
    if (!session || session.isDead) {
        return;
    }

    runNightRaid();

    const live = getSession();
    if (!live || live.isDead) {
        return;
    }

    const parts = clockPartsFromGameTime(live.gameTime);
    appendSessionLog(
        `新的一天开始了（第${parts.day}天）。`,
        `第${parts.day}天 ${formatClock(live)}`,
    );
    gameBusEmit('logChanged', {
        text: live.lastLog,
        timeLabel: live.logs[live.logs.length - 1]?.timeLabel ?? '',
    });
    gameBusEmit('session_updated');
}

function onStageEdge(stage: 'day' | 'night'): void {
    const session = getSession();
    if (!session || session.isDead) {
        return;
    }

    if (stage === 'day') {
        appendSessionLog('天亮了。', `第${session.day}天 ${formatClock(session)}`);
        // Original: weather check + NPC + Medal.checkDay(1) at dawn path.
        checkWeather(session);
        medalCheckDay(1);
        refreshNpcTrading();
        runNpcDailyVisit();
    } else {
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
 * Original WeatherSystem.checkWeather:
 * cloudy → weighted roll; else lastDays++ until lastDays >= config.lastDays → cloudy.
 */
function checkWeather(session: SessionState): void {
    if (session.weatherId === 0) {
        const next = rollWeatherForSeason(session.season);
        if (next !== session.weatherId) {
            session.weatherId = next;
            session.weatherLastDays = 0;
            appendSessionLog(WEATHER_LOG[next] ?? WEATHER_LOG[0]!);
            gameBusEmit('weather_change', next);
        }
        return;
    }

    session.weatherLastDays = (session.weatherLastDays ?? 0) + 1;
    const maxDays = getWeatherEffects(session.weatherId).lastDays ?? 2;
    if (session.weatherLastDays >= maxDays) {
        session.weatherId = 0;
        session.weatherLastDays = 0;
        appendSessionLog(WEATHER_LOG[0]!);
        gameBusEmit('weather_change', 0);
    }
}

/**
 * Port of player.updateByTime (dog starve + weather + sleep).
 */
function updateByTime(session: SessionState): void {
    const c = CHANGE_BY_TIME;

    // starve band update is separate; immunity also blocks time decay.
    if (!isBuffActive(STARVE_IMMUNE_BUFF_ITEM_ID, session)) {
        changeStarve(c[0][0]);
    }

    if (typeof session.dogStarve === 'number') {
        const next = Math.max(0, Math.min(session.dogStarveMax ?? 50, session.dogStarve + c[1][0]));
        if (next !== session.dogStarve) {
            session.dogStarve = next;
        }
    }

    if (!isBuffActive(VIGOUR_IMMUNE_BUFF_ITEM_ID, session)) {
        const stage = getCurrentStage();
        if (stage === 'day') {
            changeVigour(session.isAtHome ? c[2][0] : c[3][0]);
        } else {
            changeVigour(session.isAtHome ? c[4][0] : c[5][0]);
        }
    }

    if (session.isInSleep) {
        const bedLevel = session.buildLevels[9] ?? -1;
        const bedRateBase = bedLevel >= 1 ? BED_RATES[1] : bedLevel >= 0 ? BED_RATES[0] : 0.5;
        const starveRatio = session.attrs.starve / 100;
        const spiritRatio = session.attrs.spirit / 100;
        // Original: bedRate = bed.rate*0.5 + starve/max*0.2 + spirit/max*0.3
        const bedRate = bedRateBase * 0.5 + starveRatio * 0.2 + spiritRatio * 0.3;
        changeVigour(Math.ceil(bedRate * 15));
        changeHp(Math.ceil(bedRate * 20));
    }

    // Weather hourly attr effects.
    const weatherVigour = getWeatherValue(session.weatherId, 'vigour');
    const weatherSpirit = getWeatherValue(session.weatherId, 'spirit');
    if (weatherVigour !== 0 && !isBuffActive(VIGOUR_IMMUNE_BUFF_ITEM_ID, session)) {
        changeVigour(weatherVigour);
    }
    if (weatherSpirit !== 0) {
        changeSpirit(weatherSpirit);
    }
}

function isFireActive(session: SessionState): boolean {
    if (session.role === 'YAZI') {
        // Electric stove (18) uses power plant active flag in original.
        // Slice: treat electricFenceActive-adjacent plant unlock as proxy when stove built.
        const stoveLevel = session.buildLevels[18] ?? -1;
        return stoveLevel >= 0 && session.electricFenceActive;
    }
    // Bonfire (5): fuel > 0.
    return (session.bonfireFuel ?? 0) > 0 && (session.buildLevels[5] ?? -1) >= 0;
}

function updateTemperature(session: SessionState): void {
    const seasonRow = TEMPERATURE_BY_SEASON[session.season] ?? TEMPERATURE_BY_SEASON[0];
    const stage = getCurrentStage();
    let target = seasonRow[0];
    target += stage === 'day' ? seasonRow[1] : seasonRow[2];

    if (isFireActive(session)) {
        target += FIRE_TEMPERATURE_BONUS;
    }

    target += getWeatherValue(session.weatherId, 'temperature');

    const delta = target - session.temperature;
    if (delta !== 0) {
        changeAttr('temperature', delta);
    }
}

function updateTemperatureEffect(session: SessionState): void {
    const band = getAttrBand('temperature', session.temperature);
    if (!band) {
        return;
    }
    for (const [attrKey, raw] of Object.entries(band.effect)) {
        if (raw === undefined || raw === 0) {
            continue;
        }
        if (
            attrKey === 'hp' ||
            attrKey === 'spirit' ||
            attrKey === 'starve' ||
            attrKey === 'vigour' ||
            attrKey === 'injury' ||
            attrKey === 'infect' ||
            attrKey === 'temperature'
        ) {
            changeAttr(attrKey, raw);
        }
    }
}

/**
 * Port of updateStarve / updateInjure / updateInfect / updateVigour band effects.
 */
function updateBandEffects(session: SessionState): void {
    applyStarveBand(session);
    applyVigourBand(session);
    applyInjuryBand(session);
    applyInfectBand(session);
}

function applyStarveBand(session: SessionState): void {
    if (isBuffActive(STARVE_IMMUNE_BUFF_ITEM_ID, session)) {
        return;
    }
    applyBandSimple('starve', session.attrs.starve);
}

function applyVigourBand(session: SessionState): void {
    if (isBuffActive(VIGOUR_IMMUNE_BUFF_ITEM_ID, session)) {
        return;
    }
    applyBandSimple('vigour', session.attrs.vigour);
}

function applyBandSimple(attrKey: string, value: number): void {
    const band = findAttrBand(attrKey, value);
    if (!band) {
        return;
    }
    for (const [effectKey, raw] of Object.entries(band.effect)) {
        if (raw === undefined || raw === 0) {
            continue;
        }
        if (
            effectKey === 'hp' ||
            effectKey === 'spirit' ||
            effectKey === 'starve' ||
            effectKey === 'vigour' ||
            effectKey === 'injury' ||
            effectKey === 'infect' ||
            effectKey === 'temperature'
        ) {
            changeAttr(effectKey, raw);
        }
    }
}

function applyInjuryBand(session: SessionState): void {
    const band = findAttrBand('injury', session.attrs.injury);
    if (!band) {
        return;
    }
    const gated = isInBind(session);
    for (const [effectKey, raw] of Object.entries(band.effect)) {
        if (raw === undefined || raw === 0) {
            continue;
        }
        // Original: infect/spirit skipped while bandaged.
        if (gated && (effectKey === 'infect' || effectKey === 'spirit')) {
            continue;
        }
        if (
            effectKey === 'hp' ||
            effectKey === 'spirit' ||
            effectKey === 'starve' ||
            effectKey === 'vigour' ||
            effectKey === 'injury' ||
            effectKey === 'infect' ||
            effectKey === 'temperature'
        ) {
            changeAttr(effectKey, raw);
        }
    }
}

function applyInfectBand(session: SessionState): void {
    if (isBuffActive(INFECT_IMMUNE_BUFF_ITEM_ID, session)) {
        return;
    }
    const band = findAttrBand('infect', session.attrs.infect);
    if (!band) {
        return;
    }
    const gated = isInCure(session);
    for (const [effectKey, raw] of Object.entries(band.effect)) {
        if (raw === undefined || raw === 0) {
            continue;
        }
        let value = raw;
        // Original: infect→hp scaled by infect/100.
        if (effectKey === 'hp') {
            value = Math.ceil(raw * (session.attrs.infect / 100));
        }
        // Original: infect/spirit skipped while cured (hp still applies).
        if (gated && (effectKey === 'infect' || effectKey === 'spirit')) {
            continue;
        }
        if (
            effectKey === 'hp' ||
            effectKey === 'spirit' ||
            effectKey === 'starve' ||
            effectKey === 'vigour' ||
            effectKey === 'injury' ||
            effectKey === 'infect' ||
            effectKey === 'temperature'
        ) {
            changeAttr(effectKey, value);
        }
    }
}

/** Debug helper: jump forward N game hours without waiting. */
export function debugSkipGameHours(hours: number): void {
    const session = getSession();
    if (!session || !survivalActive) {
        return;
    }
    const n = Math.max(0, Math.floor(hours));
    for (let i = 0; i < n; i++) {
        runHourlySurvivalTick();
        if (getSession()?.isDead) {
            break;
        }
    }
}

/** Add bonfire fuel unit (wood). Max 6 like original. */
export function addBonfireFuel(): { ok: boolean; msg: string } {
    const session = getSession();
    if (!session) {
        return { ok: false, msg: '无存档' };
    }
    if ((session.buildLevels[5] ?? -1) < 0) {
        return { ok: false, msg: '你没有火炉' };
    }
    if ((session.bonfireFuel ?? 0) >= 6) {
        return { ok: false, msg: '燃料已满' };
    }
    if ((session.storage[1101011] ?? 0) < 1) {
        return { ok: false, msg: '木材不足' };
    }
    mutateSession((live) => {
        const wood = live.storage[1101011] ?? 0;
        if (wood <= 1) {
            delete live.storage[1101011];
        } else {
            live.storage[1101011] = wood - 1;
        }
        live.bonfireFuel = (live.bonfireFuel ?? 0) + 1;
    });
    // One fuel lasts 240 min = 4 hours of heat (original makeTime 240 minutes).
    gameBusEmit('session_updated');
    return { ok: true, msg: `添柴成功（燃料${getSession()!.bonfireFuel}/6）` };
}

/**
 * Consume 1 fuel every 4 game hours while burning.
 * Original: each fuel unit lasts makeTime 240 minutes.
 */
export function maybeBurnBonfireFuel(session: SessionState): void {
    if ((session.bonfireFuel ?? 0) <= 0) {
        return;
    }
    if (session.hour % 4 === 0) {
        session.bonfireFuel = Math.max(0, session.bonfireFuel - 1);
    }
}
