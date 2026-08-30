import { afterEach, describe, expect, test } from 'bun:test';
import { createNewSession, getSession } from '../session/sessionStore';
import { gameBusClear } from './gameBus';
import {
    BONFIRE_FUEL_MAX,
    BONFIRE_SECONDS_PER_FUEL,
    addBonfireFuel,
    bonfireDerived,
    maybeBurnBonfireFuel,
} from './survivalLoop';

const WOOD_ID = 1101011;

function setupBurningSession(fuel: number, anchorSecAgo: number) {
    const session = createNewSession('LUO', 0);
    session.buildLevels[5] = 0;
    session.gameTime = 10 * 86400; // day 10, away from t=0 edge
    session.bonfireFuel = fuel;
    session.bonfireRoundAnchorSec = session.gameTime - anchorSecAgo;
    return session;
}

afterEach(() => {
    gameBusClear();
});

describe('bonfire derived state', () => {
    test('fresh round: full bar and hint fuel intact', () => {
        const session = setupBurningSession(1, 0);
        const d = bonfireDerived(session);
        expect(d.burning).toBe(true);
        expect(d.fuelLeft).toBe(1);
        expect(d.pct).toBe(100);
        expect(d.burnedOut).toBe(false);
    });

    test('continuous countdown within one fuel unit', () => {
        const session = setupBurningSession(1, 60 * 60); // 1h into a 4h unit
        const d = bonfireDerived(session);
        expect(d.fuelLeft).toBe(1);
        // (240min − 60min) / 240min = 75%
        expect(d.pct).toBeCloseTo(75, 5);
    });

    test('each 240 minutes burns exactly one fuel unit', () => {
        const session = setupBurningSession(2, 241 * 60);
        const d = bonfireDerived(session);
        expect(d.fuelLeft).toBe(1);
    });

    test('original progress quirk: bar clamps to 0 after a unit is consumed', () => {
        // Original recomputes totalTime from the decremented fuel while pastTime
        // keeps accumulating, so the bar drops back — replicate faithfully.
        const session = setupBurningSession(2, 241 * 60);
        expect(bonfireDerived(session).pct).toBe(0);
    });

    test('burnedOut when elapsed exceeds stored fuel', () => {
        const session = setupBurningSession(1, (240 + 1) * 60);
        expect(bonfireDerived(session).burnedOut).toBe(true);
        maybeBurnBonfireFuel(session);
        expect(session.bonfireFuel).toBe(0);
        expect(session.bonfireRoundAnchorSec).toBe(0);
    });
});

describe('addBonfireFuel', () => {
    test('first fuel registers the round anchor', () => {
        const session = createNewSession('LUO', 0);
        session.buildLevels[5] = 0;
        session.gameTime = 5 * 86400;
        session.storage[WOOD_ID] = 2;

        const res = addBonfireFuel();

        expect(res.ok).toBe(true);
        const live = getSession()!;
        expect(live.bonfireFuel).toBe(1);
        expect(live.bonfireRoundAnchorSec).toBe(5 * 86400);
        expect(bonfireDerived(live).pct).toBe(100);
    });

    test('topping up mid-round keeps the anchor', () => {
        const session = setupBurningSession(1, 60 * 60);
        const anchorBefore = session.bonfireRoundAnchorSec;
        session.storage[WOOD_ID] = 1;

        const res = addBonfireFuel();

        expect(res.ok).toBe(true);
        const live = getSession()!;
        expect(live.bonfireFuel).toBe(2);
        expect(live.bonfireRoundAnchorSec).toBe(anchorBefore);
    });

    test('full fire rejects with original copy (string 1134)', () => {
        const session = setupBurningSession(BONFIRE_FUEL_MAX, 0);
        session.storage[WOOD_ID] = 1;

        const res = addBonfireFuel();

        expect(res.ok).toBe(false);
        expect(res.msg).toBe('火炉已经塞满了！');
    });

    test('no wood rejects with original copy (string 1146)', () => {
        const session = createNewSession('LUO', 0);
        session.buildLevels[5] = 0;
        session.gameTime = 86400;

        const res = addBonfireFuel();

        expect(res.ok).toBe(false);
        expect(res.msg).toBe('没有足够的木材');
    });

    test('fuel from a burned-out round is reusable right after burn-down', () => {
        // Storage holds fuel=2 with elapsed past both units: derived fuelLeft is 0,
        // so the next add starts a NEW round at fuel=1 (original fuel==0 branch).
        const session = setupBurningSession(2, (2 * 240 + 30) * 60);
        expect(bonfireDerived(session).fuelLeft).toBe(0);
        session.storage[WOOD_ID] = 1;

        const res = addBonfireFuel();

        expect(res.ok).toBe(true);
        const live = getSession()!;
        expect(live.bonfireFuel).toBe(1);
        expect(live.bonfireRoundAnchorSec).toBe(live.gameTime);
    });

    test('constants match original buildActionConfig["5"]', () => {
        expect(BONFIRE_SECONDS_PER_FUEL).toBe(240 * 60);
        expect(BONFIRE_FUEL_MAX).toBe(6);
    });
});
