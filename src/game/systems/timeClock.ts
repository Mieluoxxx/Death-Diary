/**
 * Port of Buried-City TimerManager (subset).
 * Advances gameTime from real dt, runs TimerCallbacks, exposes stage/season helpers.
 */

import {
    applyGameTimeToSession,
    clockPartsFromGameTime,
    getSession,
    mutateSession,
    type SessionState,
} from '../session/sessionStore';
import { gameBusEmit } from './gameBus';

/** Original: timeScaleOrigin = 10 * 60 / 6 → real 1s ≈ game 100s. */
export const TIME_SCALE_ORIGIN = (10 * 60) / 6;

export const STAGE_DAY_HOUR = 6;
export const STAGE_NIGHT_HOUR = 20;

export const REPEAT_FOREVER = Number.MAX_SAFE_INTEGER;

export type TimerDelegate = {
    process?: (deltaGameSeconds: number) => void;
    end?: () => void;
};

export type TimerCallbackHandle = {
    readonly id: number;
    internalTime: number;
    startTime: number;
    endTime: number;
    repeat: number;
    priority: number;
    delegate: TimerDelegate;
};

type ClockState = {
    running: boolean;
    pausedRef: number;
    timeScale: number;
    isAccelerated: boolean;
    accelerateEndTime: number;
    nextCallbackId: number;
    callbacks: TimerCallbackHandle[];
    lastEmittedHourKey: string;
    lastEmittedDayIndex: number;
    lastStage: 'day' | 'night' | null;
    lastSeason: 0 | 1 | 2 | 3 | null;
};

const clock: ClockState = {
    running: false,
    pausedRef: 0,
    timeScale: TIME_SCALE_ORIGIN,
    isAccelerated: false,
    accelerateEndTime: 0,
    nextCallbackId: 1,
    callbacks: [],
    lastEmittedHourKey: '',
    lastEmittedDayIndex: -1,
    lastStage: null,
    lastSeason: null,
};

function requireSession(): SessionState {
    const session = getSession();
    if (!session) {
        throw new Error('timeClock: no active session');
    }
    return session;
}

export function isTimeClockRunning(): boolean {
    return clock.running;
}

export function isTimeClockPaused(): boolean {
    return clock.pausedRef > 0;
}

export function pauseTimeClock(): void {
    clock.pausedRef += 1;
}

export function resumeTimeClock(): void {
    clock.pausedRef = Math.max(0, clock.pausedRef - 1);
}

export function getGameTimeScale(): number {
    return clock.timeScale;
}

/**
 * Temporarily speed up so `gameSeconds` elapse in `realSeconds` wall time.
 * Used later for craft/upgrade; A-slice only exposes the API.
 */
export function accelerateTime(gameSeconds: number, realSeconds: number): void {
    if (clock.isAccelerated || realSeconds <= 0) {
        return;
    }
    const session = getSession();
    if (!session) {
        return;
    }
    clock.timeScale = gameSeconds / realSeconds;
    clock.isAccelerated = true;
    clock.accelerateEndTime = session.gameTime + gameSeconds;
}

export function accelerateWorkTime(gameSeconds: number): void {
    const realCap = 3;
    if (gameSeconds / TIME_SCALE_ORIGIN > realCap) {
        accelerateTime(gameSeconds, realCap);
    }
}

export function addTimerCallback(
    internalTime: number,
    delegate: TimerDelegate,
    options?: {
        startTime?: number;
        repeat?: number;
        priority?: number;
    },
): TimerCallbackHandle {
    const session = requireSession();
    const startTime = options?.startTime ?? session.gameTime;
    const handle: TimerCallbackHandle = {
        id: clock.nextCallbackId++,
        internalTime,
        startTime,
        endTime: startTime + internalTime,
        repeat: options?.repeat ?? 1,
        priority: options?.priority ?? 0,
        delegate,
    };
    clock.callbacks.push(handle);
    clock.callbacks.sort((left, right) => right.priority - left.priority);
    return handle;
}

export function removeTimerCallback(handle: TimerCallbackHandle): void {
    const index = clock.callbacks.findIndex((item) => item.id === handle.id);
    if (index >= 0) {
        clock.callbacks.splice(index, 1);
    }
}

export function clearTimerCallbacks(): void {
    clock.callbacks = [];
}

/**
 * Start the clock for the current session. Does not register survival hooks —
 * call startSurvivalLoop() after this.
 */
export function startTimeClock(): void {
    const session = requireSession();
    clock.running = true;
    clock.pausedRef = 0;
    clock.timeScale = TIME_SCALE_ORIGIN;
    clock.isAccelerated = false;
    clock.accelerateEndTime = 0;
    clearTimerCallbacks();

    const parts = clockPartsFromGameTime(session.gameTime);
    clock.lastEmittedHourKey = `${parts.day}:${parts.hour}`;
    clock.lastEmittedDayIndex = parts.day - 1;
    clock.lastStage = parts.stage;
    clock.lastSeason = parts.season;
}

export function stopTimeClock(): void {
    clock.running = false;
    clock.pausedRef = 0;
    clearTimerCallbacks();
    clock.isAccelerated = false;
    clock.timeScale = TIME_SCALE_ORIGIN;
}

/**
 * Advance simulation by real-frame delta seconds.
 * Call from the active in-game scene's update().
 */
export function tickTimeClock(realDeltaSeconds: number): void {
    if (!clock.running || clock.pausedRef > 0 || realDeltaSeconds <= 0) {
        return;
    }
    const session = getSession();
    if (!session || session.isDead) {
        return;
    }

    const deltaGameSeconds = realDeltaSeconds * clock.timeScale;
    advanceGameTime(session, deltaGameSeconds);
}

function advanceGameTime(session: SessionState, deltaGameSeconds: number): void {
    const previousParts = clockPartsFromGameTime(session.gameTime);
    const nextTime = session.gameTime + deltaGameSeconds;
    applyGameTimeToSession(session, nextTime);

    // Process callbacks against the new time.
    const finished: TimerCallbackHandle[] = [];
    for (const callback of clock.callbacks) {
        callback.delegate.process?.(deltaGameSeconds);
        if (nextTime >= callback.endTime) {
            callback.delegate.end?.();
            callback.repeat -= 1;
            finished.push(callback);
        }
    }

    for (const callback of finished) {
        if (callback.repeat > 0) {
            callback.startTime = nextTime;
            callback.endTime = nextTime + callback.internalTime;
        } else {
            removeTimerCallback(callback);
        }
    }

    if (clock.isAccelerated && nextTime >= clock.accelerateEndTime) {
        clock.isAccelerated = false;
        clock.timeScale = TIME_SCALE_ORIGIN;
    }

    const parts = clockPartsFromGameTime(nextTime);
    const minuteChanged =
        previousParts.day !== parts.day ||
        previousParts.hour !== parts.hour ||
        previousParts.minute !== parts.minute;

    if (minuteChanged) {
        gameBusEmit('time_tick', {
            gameTime: nextTime,
            day: parts.day,
            hour: parts.hour,
            minute: parts.minute,
        });
        // Persist through the session store at the same game-minute cadence.
        mutateSession(() => {});
        gameBusEmit('session_updated');
    }

    if (clock.lastStage !== parts.stage) {
        clock.lastStage = parts.stage;
        gameBusEmit('stage_change', parts.stage);
    }

    if (clock.lastSeason !== parts.season) {
        clock.lastSeason = parts.season;
        gameBusEmit('season_change', parts.season);
    }
}

/** Register a forever callback every `intervalSeconds` of game time. */
export function everyGameInterval(
    intervalSeconds: number,
    onEnd: () => void,
    options?: { startTime?: number; priority?: number },
): TimerCallbackHandle {
    return addTimerCallback(
        intervalSeconds,
        { end: onEnd },
        {
            startTime: options?.startTime,
            repeat: REPEAT_FOREVER,
            priority: options?.priority,
        },
    );
}

/**
 * Align a repeating interval so the first fire is at the next boundary
 * after `fromTime` (e.g. next whole hour).
 */
export function alignIntervalStart(fromTime: number, intervalSeconds: number): number {
    const remainder = fromTime % intervalSeconds;
    if (remainder === 0) {
        // Already on boundary — schedule from previous boundary so end fires at now+interval.
        return fromTime;
    }
    return fromTime - remainder;
}

export function getCurrentStage(): 'day' | 'night' {
    const session = getSession();
    if (!session) {
        return 'day';
    }
    return clockPartsFromGameTime(session.gameTime).stage;
}
