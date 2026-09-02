import { describe, expect, test } from 'bun:test';
import { SECRET_ROOMS } from '../data/secretRooms';
import { buildSecretRooms, shouldTriggerSecretRooms } from './secretRoomSystem';

describe('shouldTriggerSecretRooms (original testSecretRoomsBegin roll)', () => {
    const cfg = SECRET_ROOMS[1]; // maxCount 3, probability 0.1

    test('under cap and rand below probability → trigger', () => {
        expect(shouldTriggerSecretRooms(cfg, 0, false, false, 0.05)).toBe(true);
    });

    test('at cap without explorer → never trigger', () => {
        expect(shouldTriggerSecretRooms(cfg, 3, false, false, 0.01)).toBe(false);
    });

    test('explorer raises cap by 1', () => {
        expect(shouldTriggerSecretRooms(cfg, 3, true, false, 0.01)).toBe(true);
        expect(shouldTriggerSecretRooms(cfg, 4, true, false, 0.01)).toBe(false);
    });

    test('flashlight raises probability by 0.05', () => {
        expect(shouldTriggerSecretRooms(cfg, 0, false, false, 0.12)).toBe(false);
        expect(shouldTriggerSecretRooms(cfg, 0, false, true, 0.12)).toBe(true);
    });

    test('explorer beats flashlight (if/else-if, never stacked)', () => {
        expect(shouldTriggerSecretRooms(cfg, 0, true, true, 0.2)).toBe(true);
        expect(shouldTriggerSecretRooms(cfg, 0, true, true, 0.23)).toBe(false);
    });
});

describe('buildSecretRooms (original genSecretRooms)', () => {
    // Run enough rolls to cover the whole room-count range.
    const counts = new Set<number>();
    for (let i = 0; i < 60; i++) {
        const rooms = buildSecretRooms(SECRET_ROOMS[1], [2, 4]);
        counts.add(rooms.length);

        test(`roll ${i}: last room is work with loot`, () => {
            const last = rooms[rooms.length - 1]!;
            expect(last.type).toBe('work');
            if (last.type === 'work') {
                expect(last.loot.length).toBeGreaterThan(0);
                expect(last.workType).toBeGreaterThanOrEqual(0);
                expect(last.workType).toBeLessThanOrEqual(2);
            }
        });

        test(`roll ${i}: battle rooms stay within clamped difficulty 1..12`, () => {
            for (const room of rooms) {
                if (room.type === 'battle') {
                    expect(room.difficulty).toBeGreaterThanOrEqual(1);
                    expect(room.difficulty).toBeLessThanOrEqual(12);
                    expect(room.monsters.length).toBeGreaterThan(0);
                }
            }
        });
    }

    test('room count spans the configured min..max range', () => {
        for (let n = SECRET_ROOMS[1].minRooms; n <= SECRET_ROOMS[1].maxRooms; n++) {
            expect(counts.has(n)).toBe(true);
        }
    });

    test('difficulty offsets clamp at 12 (tier 3, offset +1)', () => {
        const rooms = buildSecretRooms(SECRET_ROOMS[3], [12, 12]);
        for (const room of rooms) {
            if (room.type === 'battle') {
                expect(room.difficulty).toBe(12);
            }
        }
    });
});
