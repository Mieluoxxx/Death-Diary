/**
 * Secret rooms (密道) tier configs.
 * Port of Buried-City secretRooms.js — weight-0 entries kept on purpose
 * to preserve the original roll behaviour (same precedent as siteProduceConfig).
 */

import type { SiteProduceConfig } from './siteProduceConfig';

export type SecretRoomsId = 1 | 2 | 3 | 4 | 5;

export type SecretRoomsConfig = {
    id: SecretRoomsId;
    /** Per-site trigger cap per run (raised by 高能探测器 1305064). */
    maxCount: number;
    /** Base trigger chance per cleared room (raised by flashlight/explorer). */
    probability: number;
    minRooms: number;
    maxRooms: number;
    minDifficultyOffset: number;
    maxDifficultyOffset: number;
    /** Last room is a work room fed by this budget. */
    produceValue: number;
} & SiteProduceConfig;

export const SECRET_ROOMS: Record<SecretRoomsId, SecretRoomsConfig> = {
    1: {
        id: 1,
        maxCount: 3,
        probability: 0.1,
        minRooms: 2,
        maxRooms: 3,
        minDifficultyOffset: -1,
        maxDifficultyOffset: 1,
        produceValue: 11,
        produceList: [
            { itemId: '1101**', weight: 1 },
            { itemId: '1103083', weight: 1 },
            { itemId: '1105011', weight: 1 },
            { itemId: '1105022', weight: 1 },
            { itemId: '1305011', weight: 10 },
            { itemId: '1301041', weight: 10 },
            { itemId: '1301052', weight: 0 },
            { itemId: '1301063', weight: 0 },
            { itemId: '1104011', weight: 0 },
            { itemId: '1104021', weight: 0 },
            { itemId: '1104043', weight: 0 },
        ],
    },
    2: {
        id: 2,
        maxCount: 3,
        probability: 0.1,
        minRooms: 2,
        maxRooms: 4,
        minDifficultyOffset: 0,
        maxDifficultyOffset: 1,
        produceValue: 11,
        produceList: [
            { itemId: '1101**', weight: 1 },
            { itemId: '1103083', weight: 1 },
            { itemId: '1105011', weight: 1 },
            { itemId: '1105022', weight: 1 },
            { itemId: '1305011', weight: 10 },
            { itemId: '1301041', weight: 10 },
            { itemId: '1301052', weight: 0 },
            { itemId: '1301063', weight: 0 },
            { itemId: '1104011', weight: 0 },
            { itemId: '1104021', weight: 0 },
            { itemId: '1104043', weight: 0 },
            { itemId: '1101073', weight: 0 },
        ],
    },
    3: {
        id: 3,
        maxCount: 3,
        probability: 0.1,
        minRooms: 2,
        maxRooms: 5,
        minDifficultyOffset: 1,
        maxDifficultyOffset: 1,
        produceValue: 20,
        produceList: [
            { itemId: '1101**', weight: 0 },
            { itemId: '1103083', weight: 0 },
            { itemId: '1105011', weight: 0 },
            { itemId: '1105022', weight: 0 },
            { itemId: '1305011', weight: 10 },
            { itemId: '1301041', weight: 10 },
            { itemId: '1301052', weight: 10 },
            { itemId: '1301063', weight: 0 },
            { itemId: '1104011', weight: 0 },
            { itemId: '1104021', weight: 0 },
            { itemId: '1104043', weight: 0 },
            { itemId: '1101073', weight: 0 },
        ],
    },
    4: {
        id: 4,
        maxCount: 5,
        probability: 0.05,
        minRooms: 2,
        maxRooms: 6,
        minDifficultyOffset: 1,
        maxDifficultyOffset: 1,
        produceValue: 54,
        produceList: [
            { itemId: '1101**', weight: 0 },
            { itemId: '1103083', weight: 0 },
            { itemId: '1105011', weight: 0 },
            { itemId: '1105022', weight: 0 },
            { itemId: '1305011', weight: 20 },
            { itemId: '1301041', weight: 5 },
            { itemId: '1301052', weight: 5 },
            { itemId: '1301063', weight: 10 },
            { itemId: '1104011', weight: 0 },
            { itemId: '1104021', weight: 0 },
            { itemId: '1104043', weight: 0 },
            { itemId: '1101073', weight: 0 },
        ],
    },
    5: {
        id: 5,
        maxCount: 3,
        probability: 0.1,
        minRooms: 2,
        maxRooms: 5,
        minDifficultyOffset: 1,
        maxDifficultyOffset: 1,
        produceValue: 86,
        produceList: [
            { itemId: '1101073', weight: 0 },
            { itemId: '1103083', weight: 0 },
            { itemId: '1104011', weight: 10 },
            { itemId: '1305011', weight: 0 },
        ],
    },
};

/** 高能探测器 / 强光手电 — original specialItemConfig bonuses. */
export const ITEM_EXPLORER = 1305064;
export const ITEM_FLASHLIGHT = 1305053;

/** UI copy (original strings 3012/3013/1229; the 3 type variants share text). */
export const SECRET_ENTRY = {
    title: '密道',
    progress: '???',
    des: '你发现破损的墙壁后面，似乎另有洞天。直觉告诉你，黑暗中隐藏着未知的风险和秘密。',
    leaveConfirm: '密室一旦离开就不可以重新进入，确定要离开吗？',
    leaveBtn: '离开',
    stayBtn: '再想想',
    enterBtn: '进入',
} as const;
