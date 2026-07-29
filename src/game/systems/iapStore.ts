/**
 * IAP unlock store for the web slice.
 * Original: IAPPackage + localStorage "IAPRecord".
 * Web: free unlock in shop pay dialog only (no payment bridge); permanent packs 101–109.
 *
 * Dog house (107) is shop-only: Home must not free-unlock. Buying 107 grants the
 * permanent flag and creates build 12 (level 0) on the live session when present.
 */

import {
    getPurchaseConfig,
    isPermanentIapId,
    type PermanentIapId,
    PURCHASE_LIST,
} from '../data/purchaseList';
import { getSession, setBuildLevel } from '../session/sessionStore';
import { gameBusEmit } from './gameBus';

const STORAGE_KEY = 'buried_city_iap_v1';
export const DOG_HOUSE_IAP_ID = 107;
const ROLE_LUO_IAP_ID = 108;
const ROLE_YAZI_IAP_ID = 109;
const DOG_HOUSE_BUILD_ID = 12;

type IapRecord = Record<string, number>;

function readRecord(): IapRecord {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw) as IapRecord;
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function writeRecord(record: IapRecord): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch {
        // ignore quota / private mode
    }
}

function purchaseCount(iapId: number): number {
    return readRecord()[String(iapId)] ?? 0;
}

/** Original IAPPackage.isIAPUnlocked — permanent packs: count > 0. */
export function isIapUnlocked(iapId: number): boolean {
    if (iapId === 0) {
        return true;
    }
    if (!isPermanentIapId(iapId)) {
        return purchaseCount(iapId) > 0;
    }
    const info = PURCHASE_LIST[iapId];
    if (info.multiPrice) {
        return purchaseCount(iapId) >= 3;
    }
    return purchaseCount(iapId) > 0;
}

/** Web slice: free unlock (mirrors paid success path onIAPPaied). */
export function unlockIap(iapId: number): void {
    const record = readRecord();
    const key = String(iapId);
    record[key] = Math.max(1, record[key] ?? 0);
    writeRecord(record);
    // Original player.restore / home lock callback: IAP 107 → createBuild(12, 0).
    if (iapId === DOG_HOUSE_IAP_ID) {
        ensureDogHouseBuilt();
    }
}

export function getIapPriceStr(iapId: PermanentIapId): string {
    return getPurchaseConfig(iapId).productPriceStr;
}

/** If IAP 107 is owned and dog house is still unbuilt, place level 0. */
export function ensureDogHouseBuilt(): boolean {
    if (!isDogHouseUnlocked()) {
        return false;
    }
    const session = getSession();
    if (!session) {
        return false;
    }
    const level = session.buildLevels[DOG_HOUSE_BUILD_ID] ?? -1;
    if (level >= 0) {
        return false;
    }
    setBuildLevel(DOG_HOUSE_BUILD_ID, 0);
    gameBusEmit('facility_changed', { bid: DOG_HOUSE_BUILD_ID });
    gameBusEmit('session_updated');
    return true;
}

/** IAP 107 — dog house. */
export function isDogHouseUnlocked(): boolean {
    return isIapUnlocked(DOG_HOUSE_IAP_ID);
}

export function isRoleLuoUnlocked(): boolean {
    return isIapUnlocked(ROLE_LUO_IAP_ID);
}

export function isRoleYaziUnlocked(): boolean {
    return isIapUnlocked(ROLE_YAZI_IAP_ID);
}

export function isTalentIapUnlocked(talentId: number): boolean {
    return talentId === 0 || isIapUnlocked(talentId);
}

export function isBigBagUnlocked(): boolean {
    return isIapUnlocked(105);
}

export function isBootUnlocked(): boolean {
    return isIapUnlocked(106);
}
