/**
 * SecretRoomSystem — port of Buried-City site.js secret rooms (密道):
 * testSecretRoomsBegin / genSecretRooms / enterSecretRooms / secretRoomBegin /
 * secretRoomEnd / secretRoomsEnd (abort). State lives on SiteState optional
 * fields; the trigger/build math is pure for testability.
 */

import { rollMonsterList } from '../data/monsterConfig';
import {
    ITEM_EXPLORER,
    ITEM_FLASHLIGHT,
    SECRET_ROOMS,
    type SecretRoomsConfig,
} from '../data/secretRooms';
import { AD_SITE_ID, getSiteConfig } from '../data/siteConfig';
import { getSession, mutateSession, type SiteRoom, type SiteState } from '../session/sessionStore';
import { rollValueBudgetLoot } from './lootRoll';

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Original cc.clampf(diff, 1, 12). */
function clampDifficulty(diff: number): number {
    return Math.max(1, Math.min(12, diff));
}

function getSite(siteId: number): SiteState | null {
    return getSession()?.map.sites[siteId] ?? null;
}

/**
 * Pure trigger decision (original testSecretRoomsBegin roll).
 * Explorer beats flashlight: original uses if/else-if, never both.
 */
export function shouldTriggerSecretRooms(
    cfg: SecretRoomsConfig,
    showedCount: number,
    hasExplorer: boolean,
    hasFlashlight: boolean,
    rand: number,
): boolean {
    const maxCount = cfg.maxCount + (hasExplorer ? 1 : 0);
    if (showedCount >= maxCount) {
        return false;
    }
    const probability = cfg.probability + (hasExplorer ? 0.12 : hasFlashlight ? 0.05 : 0);
    return rand < probability;
}

/** Pure room-chain builder (original genSecretRooms): battles then one work room. */
export function buildSecretRooms(
    cfg: SecretRoomsConfig,
    difficulty: [number, number] | [],
): SiteRoom[] {
    const length = randomInt(cfg.minRooms, cfg.maxRooms);
    const rooms: SiteRoom[] = [];
    for (let i = 0; i < length - 1; i++) {
        const min = clampDifficulty((difficulty[0] ?? 1) + cfg.minDifficultyOffset);
        const max = clampDifficulty((difficulty[1] ?? min) + cfg.maxDifficultyOffset);
        const diff = clampDifficulty(randomInt(min, max));
        rooms.push({ type: 'battle', difficulty: diff, monsters: rollMonsterList(diff) });
    }
    // Original IAPPackage.getDropEffect(produceValue) — IAP removed, budget passes through.
    rooms.push({
        type: 'work',
        workType: randomInt(0, 2),
        loot: rollValueBudgetLoot(cfg.produceValue, cfg.produceList),
    });
    return rooms;
}

/** Roll after a normal room win; on hit shows the entry and pre-builds rooms. */
export function testSecretRoomsBegin(siteId: number): boolean {
    const cfg = getSiteConfig(siteId);
    const secretCfg = cfg?.secretRoomsId ? SECRET_ROOMS[cfg.secretRoomsId] : undefined;
    const session = getSession();
    if (!session || !cfg || !secretCfg || cfg.difficulty.length === 0) {
        return false;
    }
    const site = session.map.sites[siteId];
    if (site && (site.isInSecretRooms || site.isSecretRoomsEntryShowed)) {
        return false;
    }

    const storageItemNum = (itemId: number) => session.storage[itemId] ?? 0;
    const hasExplorer = storageItemNum(ITEM_EXPLORER) > 0;
    const hasFlashlight = storageItemNum(ITEM_FLASHLIGHT) > 0;
    const rand = Math.random();
    const showedCount = site?.secretRoomsShowedCount ?? 0;
    // Site 202 is a 7-day reward dungeon: its secret room always triggers.
    const guaranteed = siteId === AD_SITE_ID;
    if (
        !guaranteed &&
        !shouldTriggerSecretRooms(secretCfg, showedCount, hasExplorer, hasFlashlight, rand)
    ) {
        return false;
    }

    const rooms = buildSecretRooms(secretCfg, cfg.difficulty);
    let applied = false;
    mutateSession((live) => {
        const liveSite = live.map.sites[siteId];
        if (!liveSite) {
            return;
        }
        liveSite.secretRoomsShowedCount = showedCount + 1;
        liveSite.isSecretRoomsEntryShowed = true;
        liveSite.secretRooms = rooms;
        liveSite.secretRoomsStep = 0;
        liveSite.secretRoomType = randomInt(0, 2);
        applied = true;
    });
    return applied;
}

export function enterSecretRooms(siteId: number): void {
    mutateSession((live) => {
        const site = live.map.sites[siteId];
        if (!site) {
            return;
        }
        site.isInSecretRooms = true;
        site.isSecretRoomsEntryShowed = false;
    });
}

/** Current secret room, or null when not inside / chain exhausted. */
export function secretRoomBegin(siteId: number): SiteRoom | null {
    const site = getSite(siteId);
    if (!site?.isInSecretRooms || !site.secretRooms) {
        return null;
    }
    return site.secretRooms[site.secretRoomsStep ?? 0] ?? null;
}

/** Advance the secret chain; leaves the secret state on the last room. */
export function secretRoomEnd(siteId: number): void {
    mutateSession((live) => {
        const site = live.map.sites[siteId];
        if (!site) {
            return;
        }
        const step = (site.secretRoomsStep ?? 0) + 1;
        if (!site.secretRooms || step >= site.secretRooms.length) {
            site.isInSecretRooms = false;
            site.secretRoomsStep = 0;
            return;
        }
        site.secretRoomsStep = step;
    });
}

/** Abandon entry/chain (original secretRoomsEnd via leave warning). */
export function abortSecretRooms(siteId: number): void {
    mutateSession((live) => {
        const site = live.map.sites[siteId];
        if (!site) {
            return;
        }
        site.isInSecretRooms = false;
        site.isSecretRoomsEntryShowed = false;
        site.secretRooms = [];
        site.secretRoomsStep = 0;
    });
}

export function isSecretRoomsEntryShowed(siteId: number): boolean {
    return Boolean(getSite(siteId)?.isSecretRoomsEntryShowed);
}

export function isInSecretRooms(siteId: number): boolean {
    return Boolean(getSite(siteId)?.isInSecretRooms);
}

/** Entry shown or inside — drives music and the leave-warning branch. */
export function isSecretRoomsActive(siteId: number): boolean {
    const site = getSite(siteId);
    return Boolean(site?.isSecretRoomsEntryShowed || site?.isInSecretRooms);
}
