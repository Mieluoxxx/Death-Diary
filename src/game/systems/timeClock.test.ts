import { afterEach, describe, expect, test } from 'bun:test';
import { createNewSession, gameTimeFromClock, getSession } from '../session/sessionStore';
import { clickFacilityAction } from './facilityAction';
import { gameBusClear, gameBusOn } from './gameBus';
import { startSurvivalLoop, stopSurvivalLoop } from './survivalLoop';
import {
    addTimerCallback,
    removeTimerCallback,
    startTimeClock,
    stopTimeClock,
    tickTimeClock,
} from './timeClock';
import { clearTimedProgress } from './timedProgress';

afterEach(() => {
    stopSurvivalLoop();
    stopTimeClock();
    for (const actionId of [0, 1, 2]) {
        clearTimedProgress({ kind: 'facility', id: 9, actionId });
    }
    gameBusClear();
});

function createClockSession() {
    const session = createNewSession('STRANGER', 0);
    session.gameTime = gameTimeFromClock(1, 8, 30);
    session.day = 1;
    session.hour = 8;
    session.minute = 30;
    return session;
}

describe('time clock callback scheduling', () => {
    test('catches up every repeated boundary during one large time step', () => {
        createClockSession();
        startTimeClock();
        const firedAt: number[] = [];

        addTimerCallback(
            3600,
            {
                end: () => {
                    firedAt.push(getSession()!.gameTime);
                },
            },
            { repeat: 4 },
        );

        tickTimeClock(4 * 36);

        expect(firedAt).toEqual([
            gameTimeFromClock(1, 9, 30),
            gameTimeFromClock(1, 10, 30),
            gameTimeFromClock(1, 11, 30),
            gameTimeFromClock(1, 12, 30),
        ]);
    });

    test('ends a non-repeating task only once during one large time step', () => {
        createClockSession();
        startTimeClock();
        let endCount = 0;

        addTimerCallback(3600, {
            end: () => {
                endCount += 1;
            },
        });

        tickTimeClock(4 * 36);
        tickTimeClock(36);

        expect(endCount).toBe(1);
    });

    test('preserves process time and priority order while crossing callback boundaries', () => {
        createClockSession();
        startTimeClock();
        const endOrder: string[] = [];
        let processedSeconds = 0;

        addTimerCallback(2 * 3600, {
            process: (delta) => {
                processedSeconds += delta;
            },
            end: () => {
                endOrder.push('low');
            },
        });
        addTimerCallback(
            2 * 3600,
            {
                end: () => {
                    endOrder.push('high');
                },
            },
            { priority: 10 },
        );

        tickTimeClock(4 * 36);

        expect(processedSeconds).toBe(2 * 3600);
        expect(endOrder).toEqual(['high', 'low']);
    });

    test('keeps night and midnight callbacks in chronological order', () => {
        const session = createClockSession();
        session.gameTime = gameTimeFromClock(1, 19, 30);
        session.hour = 19;
        startTimeClock();
        const fired: Array<{ name: string; gameTime: number }> = [];

        addTimerCallback(
            24 * 3600,
            {
                end: () => {
                    fired.push({ name: 'night', gameTime: getSession()!.gameTime });
                },
            },
            { startTime: -4 * 3600, repeat: 2, priority: 8 },
        );
        addTimerCallback(
            24 * 3600,
            {
                end: () => {
                    fired.push({ name: 'midnight', gameTime: getSession()!.gameTime });
                },
            },
            { startTime: 0, repeat: 2, priority: 5 },
        );

        tickTimeClock(5 * 36);

        expect(fired).toEqual([
            { name: 'night', gameTime: gameTimeFromClock(1, 20, 0) },
            { name: 'midnight', gameTime: gameTimeFromClock(2, 0, 0) },
        ]);
    });

    test('honors callbacks removed and added during process', () => {
        createClockSession();
        startTimeClock();
        const events: string[] = [];
        let spawned = false;
        const removed = addTimerCallback(3600, {
            process: () => events.push('removed-process'),
            end: () => events.push('removed-end'),
        });

        addTimerCallback(
            3600,
            {
                process: () => {
                    events.push('owner-process');
                    if (!spawned) {
                        spawned = true;
                        addTimerCallback(3600, {
                            process: (delta) => events.push(`spawned-process:${delta}`),
                            end: () => events.push('spawned-end'),
                        });
                    }
                    removeTimerCallback(removed);
                },
                end: () => events.push('owner-end'),
            },
            { priority: 10 },
        );

        tickTimeClock(3 * 36);

        expect(events).toEqual([
            'owner-process',
            'owner-end',
            'spawned-process:3600',
            'spawned-end',
        ]);
    });

    test('honors callbacks removed and added during end', () => {
        createClockSession();
        startTimeClock();
        const events: string[] = [];
        const removed = addTimerCallback(3600, {
            end: () => events.push('removed-end'),
        });

        addTimerCallback(
            3600,
            {
                end: () => {
                    events.push('owner-end');
                    removeTimerCallback(removed);
                    addTimerCallback(3600, {
                        process: (delta) => events.push(`spawned-process:${delta}`),
                        end: () => events.push('spawned-end'),
                    });
                },
            },
            { priority: 10 },
        );

        tickTimeClock(3 * 36);

        expect(events).toEqual(['owner-end', 'spawned-process:3600', 'spawned-end']);
    });

    test('does not publish process updates for zero-length catch-up segments', () => {
        const session = createClockSession();
        startTimeClock();
        const processDeltas: number[] = [];

        addTimerCallback(3600, { end: () => {} }, { startTime: session.gameTime - 3600 });
        addTimerCallback(3600, {
            process: (delta) => processDeltas.push(delta),
        });

        tickTimeClock(36);

        expect(processDeltas).toEqual([3600]);
    });

    test('rejects timer intervals that cannot advance the clock', () => {
        createClockSession();
        startTimeClock();

        expect(() => addTimerCallback(0, {})).toThrow(RangeError);
        expect(() => addTimerCallback(Number.POSITIVE_INFINITY, {})).toThrow(RangeError);
    });
});

describe('sleep survival updates', () => {
    test.each([
        { actionId: 0, hours: 1 },
        { actionId: 1, hours: 4 },
        { actionId: 2, hours: 8 },
    ])(
        'applies survival changes at each hourly boundary during $hours-hour sleep',
        ({ actionId, hours }) => {
            const session = createClockSession();
            session.buildLevels[9] = 0;
            session.attrs.starve = 100;
            session.attrs.vigour = 20;
            session.attrs.hp = 100;
            startSurvivalLoop();

            const starveValues: number[] = [];
            const hourlySnapshots: Array<{ starve: number; vigour: number; hp: number }> = [];
            const refreshedStarveValues: number[] = [];
            let waitingForStarveRefresh = false;
            let progressDoneCount = 0;
            gameBusOn('attr_change', ({ key, value }) => {
                if (key === 'starve') {
                    starveValues.push(value);
                    waitingForStarveRefresh = true;
                } else if (key === 'hp') {
                    const live = getSession()!;
                    hourlySnapshots.push({
                        starve: live.attrs.starve,
                        vigour: live.attrs.vigour,
                        hp: live.attrs.hp,
                    });
                }
            });
            gameBusOn('session_updated', () => {
                if (waitingForStarveRefresh) {
                    refreshedStarveValues.push(getSession()!.attrs.starve);
                    waitingForStarveRefresh = false;
                }
            });
            gameBusOn('progress_done', ({ channel }) => {
                if (channel.kind === 'facility' && channel.id === 9) {
                    progressDoneCount += 1;
                }
            });

            expect(clickFacilityAction(9, actionId).ok).toBe(true);
            tickTimeClock(3);

            expect(starveValues).toEqual(
                Array.from({ length: hours }, (_, index) => 100 - (index + 1) * 4),
            );
            expect(refreshedStarveValues).toEqual(starveValues);
            expect(hourlySnapshots).toEqual(
                [
                    { starve: 96, vigour: 32, hp: 117 },
                    { starve: 92, vigour: 44, hp: 134 },
                    { starve: 88, vigour: 56, hp: 151 },
                    { starve: 84, vigour: 68, hp: 168 },
                    { starve: 80, vigour: 80, hp: 185 },
                    { starve: 76, vigour: 91, hp: 201 },
                    { starve: 72, vigour: 100, hp: 217 },
                    { starve: 68, vigour: 100, hp: 233 },
                ].slice(0, hours),
            );
            expect(getSession()?.isInSleep).toBe(false);
            expect(progressDoneCount).toBe(1);
        },
    );

    test('publishes the first hourly change before four-hour sleep finishes', () => {
        const session = createClockSession();
        session.buildLevels[9] = 0;
        session.attrs.starve = 100;
        startSurvivalLoop();
        const starveValues: number[] = [];
        gameBusOn('attr_change', ({ key, value }) => {
            if (key === 'starve') {
                starveValues.push(value);
            }
        });

        expect(clickFacilityAction(9, 1).ok).toBe(true);
        tickTimeClock(0.4);

        expect(starveValues).toEqual([96]);
        expect(getSession()?.isInSleep).toBe(true);
    });
});
