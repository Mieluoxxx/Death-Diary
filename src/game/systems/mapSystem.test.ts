import { describe, expect, test } from 'bun:test';
import { SCRAPYARD_COOLDOWN_DAYS } from '../data/siteConfig';
import { scrapyardCooldownRemaining } from './mapSystem';

describe('scrapyardCooldownRemaining (7 in-game day refresh)', () => {
    test('never claimed → claimable immediately', () => {
        expect(scrapyardCooldownRemaining(undefined, 1)).toBe(0);
        expect(scrapyardCooldownRemaining(undefined, 30)).toBe(0);
    });

    test('claimed today → full cooldown', () => {
        expect(scrapyardCooldownRemaining(5, 5)).toBe(SCRAPYARD_COOLDOWN_DAYS);
    });

    test('cooldown counts down one per in-game day', () => {
        expect(scrapyardCooldownRemaining(5, 5 + SCRAPYARD_COOLDOWN_DAYS - 1)).toBe(1);
    });

    test('full cooldown elapsed → refreshed', () => {
        expect(scrapyardCooldownRemaining(5, 5 + SCRAPYARD_COOLDOWN_DAYS)).toBe(0);
        expect(scrapyardCooldownRemaining(5, 20)).toBe(0);
    });
});
