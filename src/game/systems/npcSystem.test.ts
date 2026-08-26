import { afterEach, describe, expect, test } from 'bun:test';
import { createNewSession, getSession } from '../session/sessionStore';
import { gameBusClear } from './gameBus';
import { giveNpcNeed, runNpcDailyVisit, setNpcVisitChanceOverride } from './npcSystem';

afterEach(() => {
    gameBusClear();
});

describe('NPC daily visits', () => {
    test('first visit asks for an item instead of only marking the NPC met', () => {
        const session = createNewSession('STRANGER', 0);
        session.day = 2;

        const visit = runNpcDailyVisit(() => 0);

        expect(visit?.kind).toBe('help');
        expect(visit?.need).toEqual({ itemId: 1105022, num: 1 });
        expect(getSession()?.npcs[1].unlocked).toBe(true);
        expect(getSession()?.lastLog).toContain('托人询问');
    });

    test('accepting the request consumes the home storage item', () => {
        const session = createNewSession('STRANGER', 0);
        session.day = 2;
        session.storage[1105022] = 1;
        runNpcDailyVisit(() => 0);

        expect(giveNpcNeed(1).ok).toBe(true);
        expect(getSession()?.storage[1105022]).toBeUndefined();
        expect(getSession()?.npcs[1].reputation).toBe(1);
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
