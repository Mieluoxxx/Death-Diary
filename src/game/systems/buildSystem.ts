/**
 * Port of Buried-City Build.canUpgrade / upgrade (facility slice).
 * Crafting formulas deferred — upgrade + timer only for this pass.
 */

import {
    BUILD_CONFIG,
    type BuildCostItem,
    type BuildLevelCondition,
    type BuildLevelConfig,
} from '../data/buildConfig';
import { buildLevelName } from '../data/buildStrings';
import {
    appendSessionLog,
    costStorageItems,
    formatClock,
    getBuildLevel,
    getSession,
    setBuildLevel,
    validateStorageItems,
} from '../session/sessionStore';
import { playEffect, Sound } from './audioManager';
import { gameBusEmit } from './gameBus';
import { isLowVigour } from './playerAttrs';
import { accelerateWorkTime, addTimerCallback, type TimerCallbackHandle } from './timeClock';
import { advanceGuide, GuideStep } from './userGuide';

export enum BuildUpgradeType {
    UPGRADABLE = 1,
    MAX_LEVEL = 2,
    CONDITION = 3,
    COST = 4,
}

export type UpgradeCheckResult = {
    type: BuildUpgradeType;
    nextLevel?: number;
    nextConfig?: BuildLevelConfig;
    condition?: BuildLevelCondition;
    cost?: BuildCostItem[];
};

/** Active upgrade jobs keyed by bid (one facility at a time per original activeBtnIndex). */
const activeUpgrades = new Map<
    number,
    {
        handle: TimerCallbackHandle;
        pastTime: number;
        totalTime: number;
        onProgress?: (percentage: number) => void;
    }
>();

function getConfigs(bid: number): BuildLevelConfig[] | null {
    return BUILD_CONFIG[bid] ?? null;
}

function normalizeCondition(condition: BuildLevelConfig['condition']): BuildLevelCondition | null {
    if (!condition) {
        return null;
    }
    if (Array.isArray(condition)) {
        return condition[0] ?? null;
    }
    return condition;
}

export function isBuildMaxLevel(bid: number): boolean {
    const session = getSession();
    const configs = getConfigs(bid);
    if (!session || !configs) {
        return true;
    }
    const level = getBuildLevel(bid);
    // Luo still: distiller id 6 max at level 0.
    if (session.role === 'LUO' && bid === 6) {
        return level >= 0;
    }
    return level >= configs.length - 1;
}

export function canUpgradeBuild(bid: number): UpgradeCheckResult {
    const session = getSession();
    const configs = getConfigs(bid);
    if (!session || !configs) {
        return { type: BuildUpgradeType.MAX_LEVEL };
    }

    if (isBuildMaxLevel(bid)) {
        return { type: BuildUpgradeType.MAX_LEVEL };
    }

    const level = getBuildLevel(bid);
    const nextLevel = level + 1;
    const nextConfig = configs[nextLevel];
    if (!nextConfig) {
        return { type: BuildUpgradeType.MAX_LEVEL };
    }

    const condition = normalizeCondition(nextConfig.condition);
    if (condition) {
        const have = getBuildLevel(condition.bid);
        if (have < condition.level) {
            return {
                type: BuildUpgradeType.CONDITION,
                nextLevel,
                nextConfig,
                condition,
            };
        }
    }

    const cost = nextConfig.cost ?? [];
    if (cost.length > 0 && !validateStorageItems(cost)) {
        return {
            type: BuildUpgradeType.COST,
            nextLevel,
            nextConfig,
            cost,
        };
    }

    return {
        type: BuildUpgradeType.UPGRADABLE,
        nextLevel,
        nextConfig,
        cost,
    };
}

export function isBuildUpgrading(bid: number): boolean {
    return activeUpgrades.has(bid);
}

export function getUpgradeProgress(bid: number): number {
    const job = activeUpgrades.get(bid);
    if (!job || job.totalTime <= 0) {
        return 0;
    }
    return Math.min(100, (job.pastTime / job.totalTime) * 100);
}

export function hasAnyActiveUpgrade(): boolean {
    return activeUpgrades.size > 0;
}

export function checkVigourOk(): boolean {
    // Original uiUtil.checkVigour → !player.isLowVigour() (≤25 band + buff 1107032).
    return !isLowVigour();
}

/**
 * Start facility upgrade. Returns false if not allowed.
 * Deducts materials immediately; level rises when timer ends.
 */
export function startBuildUpgrade(
    bid: number,
    hooks?: {
        onProgress?: (percentage: number) => void;
        onComplete?: () => void;
        onFail?: (reason: string) => void;
    },
): boolean {
    if (isBuildUpgrading(bid) || hasAnyActiveUpgrade()) {
        hooks?.onFail?.('busy');
        return false;
    }

    if (!checkVigourOk()) {
        hooks?.onFail?.('vigour');
        return false;
    }

    const check = canUpgradeBuild(bid);
    if (check.type !== BuildUpgradeType.UPGRADABLE || !check.nextConfig) {
        hooks?.onFail?.(BuildUpgradeType[check.type] ?? 'blocked');
        return false;
    }

    const cost = check.nextConfig.cost ?? [];
    if (cost.length > 0 && !costStorageItems(cost)) {
        hooks?.onFail?.('cost');
        return false;
    }

    const createMinutes = check.nextConfig.createTime ?? 0;
    const createTime = Math.max(1, createMinutes * 60);
    const nextLevel = check.nextLevel ?? getBuildLevel(bid) + 1;

    let pastTime = 0;
    const handle = addTimerCallback(createTime, {
        process: (deltaGameSeconds) => {
            pastTime += deltaGameSeconds;
            const job = activeUpgrades.get(bid);
            if (job) {
                job.pastTime = pastTime;
            }
            const percentage = Math.min(100, (pastTime / createTime) * 100);
            hooks?.onProgress?.(percentage);
            gameBusEmit('progress', {
                channel: { kind: 'build_upgrade', id: bid },
                percentage,
            });
        },
        end: () => {
            activeUpgrades.delete(bid);
            setBuildLevel(bid, nextLevel);
            if (bid === 9 && nextLevel === 0) {
                advanceGuide(GuideStep.MAKE_BED);
            }
            playEffect(Sound.BUILD_UPGRADE);
            const session = getSession();
            const name = buildLevelName(bid, nextLevel);
            if (session) {
                appendSessionLog(`${name} 升级完成`, `第${session.day}天 ${formatClock(session)}`);
                gameBusEmit('logChanged', {
                    text: session.lastLog,
                    timeLabel: session.logs[session.logs.length - 1]?.timeLabel ?? '',
                });
            }
            gameBusEmit('build_upgraded', { bid, level: nextLevel });
            gameBusEmit('session_updated');
            hooks?.onComplete?.();
        },
    });

    activeUpgrades.set(bid, {
        handle,
        pastTime: 0,
        totalTime: createTime,
        onProgress: hooks?.onProgress,
    });

    accelerateWorkTime(createTime);
    gameBusEmit('build_upgrade_started', { bid, nextLevel, createTime });
    gameBusEmit('session_updated');
    return true;
}

export function homeBuildFrame(bid: number, level: number): string {
    const safeLevel = Math.max(0, level);
    return `icon_start_build_${bid}_${safeLevel}.png`;
}

export function clearActiveUpgrades(): void {
    activeUpgrades.clear();
}
