import { describe, expect, test } from 'bun:test';
import { BOSS_SITE_ID, BOSS_SUB_SITE_IDS, getSiteConfig } from '../../data/siteConfig';
import { bossSubSiteStatus } from './bossNode';

describe('bossSubSiteStatus (original updateBtn parity)', () => {
    const site = { step: 0, rooms: [1, 2, 3] };

    test('not unlocked → locked even if state exists', () => {
        expect(bossSubSiteStatus(301, [], site)).toBe('locked');
        expect(bossSubSiteStatus(301, [302, 303], site)).toBe('locked');
    });

    test('unlocked with remaining rooms → active (pulsing badge)', () => {
        expect(bossSubSiteStatus(301, [301], { step: 0, rooms: [1] })).toBe('active');
        expect(bossSubSiteStatus(301, [301], { step: 2, rooms: [1, 2, 3] })).toBe('active');
    });

    test('unlocked and fully cleared → cleared (no badge)', () => {
        expect(bossSubSiteStatus(301, [301], { step: 3, rooms: [1, 2, 3] })).toBe('cleared');
    });

    test('unlocked but never entered (no site state) → plain tappable', () => {
        expect(bossSubSiteStatus(301, [301], null)).toBe('cleared');
    });

    test('boss hub 61 is a map site, sub-sites are config-complete', () => {
        expect(BOSS_SITE_ID).toBe(61);
        expect(BOSS_SUB_SITE_IDS).toHaveLength(12);
        for (const id of BOSS_SUB_SITE_IDS) {
            expect(getSiteConfig(id)?.name).toBeTruthy();
        }
    });
});
