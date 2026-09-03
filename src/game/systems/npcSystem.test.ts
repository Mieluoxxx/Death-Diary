import { afterEach, describe, expect, test } from 'bun:test';
import { BULLET_ID, HAND_ITEM_ID } from '../data/itemConfig';
import { getNpcDef } from '../data/npcConfig';
import { createNewSession, getSession } from '../session/sessionStore';
import { gameBusClear } from './gameBus';
import {
    commitNpcTrade,
    declineNpcHelp,
    getNpcDialog,
    getNpcTradeRate,
    giveNpcHelpItems,
    giveNpcNeed,
    runNpcDailyVisit,
    setNpcVisitChanceOverride,
    unlockNpc,
} from './npcSystem';

const LUO_ID = 1;
const WINE_ID = 1105022;

function createUnlockedLuo() {
    const session = createNewSession('STRANGER', 0);
    expect(unlockNpc(LUO_ID).ok).toBe(true);
    return session;
}

afterEach(() => {
    gameBusClear();
});

describe('NPC daily visits', () => {
    test('first visit asks for rolled common items instead of only marking the NPC met', () => {
        const session = createNewSession('STRANGER', 0);
        session.day = 2;

        const visit = runNpcDailyVisit(() => 0);

        expect(visit?.kind).toBe('help');
        // Random roll from npcGiftConfig: always non-empty, budget 4 total value.
        expect(Array.isArray(visit?.need)).toBe(true);
        expect(visit?.need?.length ?? 0).toBeGreaterThan(0);
        expect(getSession()?.npcs[1].unlocked).toBe(true);
        expect(getSession()?.lastLog).toContain('托人询问');
    });

    test('accepting the request consumes the rolled items from home storage', () => {
        const session = createNewSession('STRANGER', 0);
        session.day = 2;
        session.bag[WINE_ID] = 2;
        const visit = runNpcDailyVisit(() => 0);

        const needs = visit?.need ?? [];
        for (const item of needs) {
            session.storage[item.itemId] = (session.storage[item.itemId] ?? 0) + item.num;
        }

        expect(giveNpcHelpItems(LUO_ID, 'storage', needs).ok).toBe(true);
        for (const item of needs) {
            expect(getSession()?.storage[item.itemId]).toBeUndefined();
        }
        expect(getSession()?.bag[WINE_ID]).toBe(2);
        expect(getSession()?.npcs[LUO_ID].reputation).toBe(1);
    });

    test('declining the request costs one reputation with a floor at zero', () => {
        const session = createNewSession('STRANGER', 0);
        session.day = 2;
        runNpcDailyVisit(() => 0);
        session.npcs[LUO_ID].reputation = 2;

        expect(declineNpcHelp(LUO_ID).ok).toBe(true);
        expect(session.npcs[LUO_ID].reputation).toBe(1);
        session.npcs[LUO_ID].reputation = 0;
        expect(declineNpcHelp(LUO_ID).ok).toBe(true);
        expect(session.npcs[LUO_ID].reputation).toBe(0);
        expect(getSession()?.lastLog).toContain('拒绝');
    });

    test('supports forcing the visit chance for E2E setup', () => {
        const session = createNewSession('STRANGER', 0);
        session.day = 2;
        setNpcVisitChanceOverride(1);
        try {
            expect(runNpcDailyVisit(() => 0.99)).not.toBeNull();
        } finally {
            setNpcVisitChanceOverride(null);
        }
    });
});

describe('NPC meetings', () => {
    test('an active visit consumes the need from the bag only', () => {
        const session = createUnlockedLuo();
        session.bag[WINE_ID] = 1;
        session.storage[WINE_ID] = 2;

        expect(giveNpcNeed(LUO_ID, 'bag').ok).toBe(true);
        expect(session.bag[WINE_ID]).toBeUndefined();
        expect(session.storage[WINE_ID]).toBe(2);
        expect(session.npcs[LUO_ID].reputation).toBe(1);
    });

    test('selects dialogue from the supplied random value, not the trade count', () => {
        const session = createUnlockedLuo();
        const dialogs = getNpcDef(LUO_ID)!.dialogs;
        session.npcs[LUO_ID].tradingCount = dialogs.length - 1;

        expect(getNpcDialog(LUO_ID, () => 0)).toBe(dialogs[0]);
        expect(getNpcDialog(LUO_ID, () => 0.999)).toBe(dialogs[dialogs.length - 1]!);
    });
});

describe('NPC trades', () => {
    test('prices one wine for three old-Luo bullets as an original fair trade', () => {
        createUnlockedLuo();

        expect(getNpcTradeRate(LUO_ID, { [WINE_ID]: 1 }, { [BULLET_ID]: 3 })).toBe(1);
    });

    test('commits inventory and count without adding a trade log', () => {
        const session = createUnlockedLuo();
        session.bag[WINE_ID] = 1;
        const logsBefore = [...session.logs];
        const lastLogBefore = session.lastLog;

        expect(commitNpcTrade(LUO_ID, { [WINE_ID]: 1 }, { [BULLET_ID]: 3 }).ok).toBe(true);
        expect(session.bag[WINE_ID]).toBeUndefined();
        expect(session.bag[BULLET_ID]).toBe(3);
        expect(session.npcs[LUO_ID].storage).toEqual({
            [WINE_ID]: 1,
            [BULLET_ID]: 5,
        });
        expect(session.npcs[LUO_ID].tradingCount).toBe(1);
        expect(session.logs).toEqual(logsBefore);
        expect(session.lastLog).toBe(lastLogBefore);
    });

    test('unequips the last offered copy', () => {
        const session = createUnlockedLuo();
        session.bag[1301011] = 1;
        session.bag[1302011] = 1;
        session.equip[0] = 1301011;
        session.equip[1] = 1302011;

        expect(commitNpcTrade(LUO_ID, { 1301011: 1, 1302011: 1 }, { [BULLET_ID]: 8 }).ok).toBe(
            true,
        );
        expect(session.equip[0]).toBe(0);
        expect(session.equip[1]).toBe(HAND_ITEM_ID);
    });
});
