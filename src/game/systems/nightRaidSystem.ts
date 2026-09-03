/**
 * Full port of Buried-City player.underAttackInNight + _getAttackResult.
 * Called once per day boundary; always returns a DayLayer payload
 * (happened true/false). Emits `night_raid` for UI.
 */

import { STORAGE_LOST_SET } from '../data/blackList';
import { itemValue } from '../data/itemConfig';
import { MOONLIGHTING_CONFIG, WORK_SITE_ID } from '../data/moonlightingConfig';
import { getSiteConfig } from '../data/siteConfig';
import {
    appendSessionLog,
    getSession,
    type ItemCounts,
    mutateSession,
    type SessionState,
} from '../session/sessionStore';
import { gameBusEmit } from './gameBus';
import { pauseTimeClock } from './timeClock';

export type NightRaidLostItem = {
    itemId: number;
    num: number;
};

export type NightRaidResult = {
    /** Whether a raid rolled this night (false → peace DayLayer). */
    happened: boolean;
    /** Bomb / electric fence auto-defend (no items lost). */
    defend?: boolean;
    /** true when homeDef >= attackStrength (or auto-defend). */
    win?: boolean;
    /** Which special defend path fired (for DayLayer art). */
    defendKind?: 'bomb' | 'electric';
    homeDef?: number;
    attackStrength?: number;
    items?: NightRaidLostItem[];
    /** Sites that were also raided (storage may have been reduced). */
    sitesRaided?: number[];
};

function rollStrength(day: number): number {
    for (const band of MOONLIGHTING_CONFIG.strength) {
        if (day >= band.dayMin && day <= band.dayMax) {
            const span = band.strengthMax - band.strengthMin;
            return band.strengthMin + Math.floor(Math.random() * (span + 1));
        }
    }
    return 5;
}

function isDogActive(session: SessionState): boolean {
    return (session.dogStarve ?? 0) > 0;
}

/** Fence bid=11: (level+1)*10 + dog +10. Luo/Yazi only dog (special buildings handled earlier). */
function homeDefense(session: SessionState): number {
    let homeDef = 0;
    if (session.role !== 'LUO' && session.role !== 'YAZI') {
        const fenceLevel = session.buildLevels[11] ?? -1;
        if (fenceLevel >= 0) {
            homeDef += (fenceLevel + 1) * 10;
        }
    }
    if (isDogActive(session)) {
        homeDef += 10;
    }
    return homeDef;
}

function isElectricFenceActive(session: SessionState): boolean {
    const level = session.buildLevels[19] ?? -1;
    if (level < 0) {
        return false;
    }
    // Original: ElectricFenceBuild.isActive → power plant WorkSite.isActive.
    return Boolean(session.map.sites[WORK_SITE_ID]?.powerPlantActive);
}

/**
 * Steal items until produceValue is spent.
 * Original: produceValue = attackStrength/5 - 1 + 3; each item costs item.value.
 * Honors blackList.storageLost; max ~5 per type; max ~6 distinct types.
 */
function stealFromStorage(storage: ItemCounts, attackStrength: number): NightRaidLostItem[] {
    let produceValue = attackStrength / 5 - 1 + 3;
    const lost = new Map<number, number>();
    const dynamicBlack = new Set<number>(STORAGE_LOST_SET);

    while (produceValue > 0) {
        let ids = Object.keys(storage)
            .map(Number)
            .filter((id) => (storage[id] ?? 0) > 0 && !dynamicBlack.has(id));

        if (ids.length === 0) {
            break;
        }

        // Once 6 distinct types taken, only continue on those types.
        if (lost.size >= 6) {
            const haveIds = new Set(lost.keys());
            ids = ids.filter((id) => haveIds.has(id));
            if (ids.length === 0) {
                break;
            }
        }

        const itemId = ids[Math.floor(Math.random() * ids.length)]!;
        if ((storage[itemId] ?? 0) <= 0) {
            break;
        }

        storage[itemId] = (storage[itemId] ?? 0) - 1;
        if (storage[itemId]! <= 0) {
            delete storage[itemId];
        }

        const nextCount = (lost.get(itemId) ?? 0) + 1;
        lost.set(itemId, nextCount);
        if (nextCount >= 5) {
            dynamicBlack.add(itemId);
        }

        produceValue -= itemValue(itemId);
    }

    return [...lost.entries()].map(([itemId, num]) => ({ itemId, num }));
}

function attackResult(
    storage: ItemCounts,
    attackStrength: number,
    def: number,
): { win: boolean; items: NightRaidLostItem[] } {
    if (attackStrength > def) {
        return {
            win: false,
            items: stealFromStorage(storage, attackStrength),
        };
    }
    return { win: true, items: [] };
}

/**
 * Run one midnight raid check (original underAttackInNight).
 * Always returns a result for DayLayer (peace when not happened).
 * Pauses the time clock when a raid UI should show — caller dismisses + resume.
 */
export function runNightRaid(): NightRaidResult {
    const session = getSession();
    if (!session || session.isDead) {
        return { happened: false };
    }

    // Original: day < 2 forces no raid (display day 0–1).
    let rand = Math.random();
    if (session.day < 2) {
        rand = 1;
    }

    let result: NightRaidResult;

    if (rand > MOONLIGHTING_CONFIG.probability) {
        result = { happened: false };
    } else {
        // Log: 一些僵尸正试图进入你的房子！
        appendSessionLog('一些僵尸正试图进入你的房子！');

        // 1) Minefield (Luo bomb charge)
        if (session.isBombActive) {
            mutateSession((live) => {
                live.isBombActive = false;
            });
            result = {
                happened: true,
                defend: true,
                win: true,
                defendKind: 'bomb',
                items: [],
            };
        }
        // 2) Electric fence (Yazi) when plant active
        else if (isElectricFenceActive(session)) {
            result = {
                happened: true,
                defend: true,
                win: true,
                defendKind: 'electric',
                items: [],
            };
        } else {
            const attackStrength = rollStrength(session.day);
            const homeDef = homeDefense(session);
            let items: NightRaidLostItem[] = [];
            let win = true;
            const sitesRaided: number[] = [];

            mutateSession((live) => {
                const home = attackResult(live.storage, attackStrength, homeDef);
                win = home.win;
                items = home.items;

                // Also raid open site storages (original site.config.def).
                for (const [idText, site] of Object.entries(live.map.sites)) {
                    if (site.closed) {
                        continue;
                    }
                    const hasItems = Object.values(site.storage).some((n) => n > 0);
                    if (!hasItems) {
                        continue;
                    }
                    const siteId = Number(idText);
                    const cfg = getSiteConfig(siteId);
                    const siteDef = cfg?.def ?? 0;
                    attackResult(site.storage, attackStrength, siteDef);
                    sitesRaided.push(siteId);
                }
            });

            result = {
                happened: true,
                defend: false,
                win,
                homeDef,
                attackStrength,
                items,
                sitesRaided,
            };
        }
    }

    // Original always pauses and shows DayLayer (peace or raid).
    pauseTimeClock();
    gameBusEmit('night_raid', result);
    gameBusEmit('session_updated');
    return result;
}
