/**
 * Port of Buried-City Formula + Build.getBuildActions (craft recipes).
 * buildConfig[bid][level].produceList → formulaConfig[fid].
 */

import { buildLevelName } from '../data/buildStrings';
import { BUILD_CONFIG } from '../data/buildConfig';
import { FORMULA_CONFIG, type FormulaDef, getFormulaDef } from '../data/formulaConfig';
import { getItemDef } from '../data/itemConfig';
import { isBigBagUnlocked, isBootUnlocked } from './iapStore';
import {
    appendSessionLog,
    costStorageItems,
    formatClock,
    gainStorageItems,
    getBuildLevel,
    getSession,
    type ItemCounts,
    type RoleKey,
    validateStorageItems,
} from '../session/sessionStore';
import { gameBusEmit } from './gameBus';
import {
    accelerateWorkTime,
    addTimerCallback,
    removeTimerCallback,
    type TimerCallbackHandle,
} from './timeClock';
import { checkVigourOk } from './buildSystem';

export type CraftCostRow = {
    itemId: number;
    num: number;
    ok: boolean;
};

export type CraftActionView = {
    bid: number;
    formulaId: number;
    produceItemId: number;
    kind: 'formula' | 'stove' | 'trap';
    step: number;
    isActioning: boolean;
    percentage: number;
    hint?: string;
    hintColor?: 'red' | 'white' | 'gray';
    costRows: CraftCostRow[];
    actionLabel: string;
    actionDisabled: boolean;
};

export type CraftClickResult = { ok: true } | { ok: false; msg: string };

type CraftRuntime = {
    bid: number;
    formulaId: number;
    /** 0 idle/make-ready, 1 placing, 2 harvest-ready (or mid-make uses isActioning+step0). */
    step: number;
    isActioning: boolean;
    pastTime: number;
    totalTime: number;
    phase: 'make' | 'place' | 'idle';
    handle: TimerCallbackHandle | null;
    needLevel: number;
};

/** Live craft jobs: one key `${bid}:${formulaId}`. */
const runtime = new Map<string, CraftRuntime>();

/** Which formula index is active on a building (-2 = none), mirrors activeBtnIndex. */
const activeFormulaByBid = new Map<number, number>();

function runtimeKey(bid: number, formulaId: number): string {
    return `${bid}:${formulaId}`;
}

function getOrCreateRuntime(bid: number, formulaId: number, needLevel: number): CraftRuntime {
    const key = runtimeKey(bid, formulaId);
    let job = runtime.get(key);
    if (!job) {
        job = {
            bid,
            formulaId,
            step: 0,
            isActioning: false,
            pastTime: 0,
            totalTime: 0,
            phase: 'idle',
            handle: null,
            needLevel,
        };
        runtime.set(key, job);
    }
    job.needLevel = needLevel;
    return job;
}

function itemTitle(itemId: number): string {
    return getItemDef(itemId).name;
}

function buildName(bid: number, level: number): string {
    return buildLevelName(bid, Math.max(0, level));
}

function costRows(cost: Array<{ itemId: number; num: number }>): CraftCostRow[] {
    const session = getSession();
    return cost.map((c) => ({
        itemId: c.itemId,
        num: c.num,
        ok: Boolean(session && (session.storage[c.itemId] ?? 0) >= c.num),
    }));
}

function storageHas(storage: ItemCounts, itemId: number): boolean {
    return (storage[itemId] ?? 0) > 0;
}

/** Original getBuildActions role / owned-item filters. */
function formulaVisible(formulaId: number, role: RoleKey, storage: ItemCounts): boolean {
    // Hide small-bag recipe if already own small bag
    if (formulaId === 1405023 && storageHas(storage, 1305023)) {
        return false;
    }
    // Hide big-bag recipe if own big bag; also hide if no small bag path rules
    if (formulaId === 1405024) {
        if (storageHas(storage, 1305024)) {
            return false;
        }
        // Original: without small bag, big bag recipe hidden until small owned?
        // filter: if own big hide; if own small show others; if neither hide big only
        if (!storageHas(storage, 1305023) && !storageHas(storage, 1305024)) {
            return false;
        }
    }
    if (formulaId === 1404024 && storageHas(storage, 1304024)) {
        return false;
    }
    if (formulaId === 1405044 && storageHas(storage, 1305044)) {
        return false;
    }
    if (formulaId === 1405053 && storageHas(storage, 1305053)) {
        return false;
    }
    // Luo: no alcohol recipe
    if (formulaId === 1205033 && role === 'LUO') {
        return false;
    }
    // Yazi exclusive
    if (
        formulaId === 1401071 ||
        formulaId === 1401082 ||
        formulaId === 1402043 ||
        formulaId === 1202063
    ) {
        return role === 'YAZI';
    }
    // Yazi hides normal guns
    if (formulaId === 1401011 || formulaId === 1401022 || formulaId === 1401033) {
        return role !== 'YAZI';
    }
    return true;
}

function isFormulaLocked(formulaId: number): boolean {
    if (formulaId === 1405024) {
        return !isBigBagUnlocked();
    }
    if (formulaId === 1404024) {
        return !isBootUnlocked();
    }
    return false;
}

type FormulaEntry = {
    formulaId: number;
    needLevel: number;
    def: FormulaDef;
};

function collectFormulas(bid: number): FormulaEntry[] {
    const levels = BUILD_CONFIG[bid];
    if (!levels) {
        return [];
    }
    const out: FormulaEntry[] = [];
    levels.forEach((levelCfg, levelIndex) => {
        for (const fid of levelCfg.produceList ?? []) {
            const def = getFormulaDef(fid);
            if (!def) {
                continue;
            }
            out.push({ formulaId: fid, needLevel: levelIndex, def });
        }
    });
    return out;
}

function anyBusyOnBuild(bid: number): boolean {
    for (const job of runtime.values()) {
        if (job.bid === bid && job.isActioning) {
            return true;
        }
    }
    return false;
}

export function listCraftActions(bid: number): CraftActionView[] {
    const session = getSession();
    if (!session) {
        return [];
    }

    const buildLevel = getBuildLevel(bid);
    const entries = collectFormulas(bid).filter((entry) =>
        formulaVisible(entry.formulaId, session.role, session.storage),
    );

    const activeFid = activeFormulaByBid.get(bid) ?? -2;

    return entries.map((entry) => {
        const { formulaId, needLevel, def } = entry;
        const job = getOrCreateRuntime(bid, formulaId, needLevel);
        const produceItemId = def.produce[0]?.itemId ?? 0;
        const produceName = itemTitle(produceItemId);
        const locked = isFormulaLocked(formulaId);
        const needOk = buildLevel >= needLevel;
        const maxStep = def.placedTime?.length ? 2 : 1;

        let hint: string | undefined;
        let hintColor: CraftActionView['hintColor'];
        let actionLabel: string;
        let actionDisabled = false;
        let cost: CraftCostRow[] = [];

        const pct =
            job.isActioning && job.totalTime > 0
                ? Math.min(100, (job.pastTime / job.totalTime) * 100)
                : 0;

        if (!needOk) {
            hint = `你没有${buildName(bid, needLevel)}!`;
            hintColor = 'red';
            actionLabel = `制作(${def.makeTime}分)`;
            actionDisabled = true;
        } else if (locked) {
            hint = '需要商店解锁';
            hintColor = 'red';
            actionLabel = `制作(${def.makeTime}分)`;
            actionDisabled = true;
        } else if (job.isActioning) {
            if (job.phase === 'place' || job.step === 1) {
                const remainSec = Math.max(0, job.totalTime - job.pastTime);
                const hours = Math.max(1, Math.ceil(remainSec / 3600));
                hint = `${hours}小时后收取，去干点别的`;
            } else {
                hint = `正在制作${produceName}…`;
            }
            hintColor = 'white';
            actionLabel = job.step >= 1 ? '收获' : `制作(${def.makeTime}分)`;
            actionDisabled = true;
        } else if (job.step === 2 || (job.step === 1 && maxStep === 2 && !job.isActioning)) {
            // Ready to harvest after place phase (step 2 in original).
            // If step stuck at 1 without actioning, treat as harvestable too.
            const harvestReady = job.step >= 1 && !job.isActioning && maxStep === 2;
            if (harvestReady || job.step === 2) {
                job.step = 2;
                hint = `${produceName}可收取`;
                hintColor = 'white';
                actionLabel = '收获';
                actionDisabled = false;
            } else {
                actionLabel = `制作(${def.makeTime}分)`;
                cost = costRows(def.cost);
                actionDisabled = cost.some((c) => !c.ok);
            }
        } else {
            // step 0 ready to craft
            actionLabel = `制作(${def.makeTime}分)`;
            cost = costRows(def.cost);
            actionDisabled = cost.some((c) => !c.ok);
            // Another formula busy on this building
            if (activeFid !== -2 && activeFid !== formulaId) {
                actionDisabled = true;
            }
            if (anyBusyOnBuild(bid) && !job.isActioning) {
                actionDisabled = true;
            }
        }

        return {
            bid,
            formulaId,
            produceItemId,
            kind: 'formula' as const,
            step: job.step,
            isActioning: job.isActioning,
            percentage: pct,
            hint,
            hintColor,
            costRows: cost,
            actionLabel,
            actionDisabled,
        };
    });
}

function emitCraft(bid: number): void {
    gameBusEmit('craft_changed', { bid });
    gameBusEmit('session_updated');
}

function finishMakeImmediate(
    bid: number,
    _formulaId: number,
    def: FormulaDef,
    job: CraftRuntime,
): void {
    // No place phase: cost + gain
    if (!validateStorageItems(def.cost)) {
        job.isActioning = false;
        job.phase = 'idle';
        job.step = 0;
        activeFormulaByBid.set(bid, -2);
        emitCraft(bid);
        return;
    }
    costStorageItems(def.cost);
    gainStorageItems(def.produce);
    const item = def.produce[0]!;
    const session = getSession();
    if (session) {
        const stock = session.storage[item.itemId] ?? 0;
        appendSessionLog(
            `你做好了${item.num}个${itemTitle(item.itemId)}（当前库存：${stock}）`,
            `第${session.day}天 ${formatClock(session)}`,
        );
        gameBusEmit('logChanged', {
            text: session.lastLog,
            timeLabel: session.logs[session.logs.length - 1]?.timeLabel ?? '',
        });
    }
    job.step = 0;
    job.isActioning = false;
    job.phase = 'idle';
    job.pastTime = 0;
    job.handle = null;
    activeFormulaByBid.set(bid, -2);
    emitCraft(bid);
}

function startPlacePhase(
    bid: number,
    _formulaId: number,
    def: FormulaDef,
    job: CraftRuntime,
): void {
    if (!validateStorageItems(def.cost)) {
        job.isActioning = false;
        job.phase = 'idle';
        job.step = 0;
        activeFormulaByBid.set(bid, -2);
        emitCraft(bid);
        return;
    }
    costStorageItems(def.cost);

    const placeMinutes = def.placedTime?.[0] ?? 0;
    const placeTime = Math.max(1, placeMinutes * 60);
    job.step = 1;
    job.phase = 'place';
    job.isActioning = true;
    job.pastTime = 0;
    job.totalTime = placeTime;

    // Original place(): notAccelerate = true
    const handle = addTimerCallback(placeTime, {
        process: (dt) => {
            job.pastTime += dt;
            const percentage = Math.min(100, (job.pastTime / job.totalTime) * 100);
            gameBusEmit('progress', {
                channel: { kind: 'craft', id: bid },
                percentage,
            });
        },
        end: () => {
            job.isActioning = false;
            job.phase = 'idle';
            job.step = 2;
            job.pastTime = 0;
            job.handle = null;
            const item = def.produce[0]!;
            const session = getSession();
            if (session) {
                appendSessionLog(
                    `大功告成，去${buildName(bid, getBuildLevel(bid))}收取${itemTitle(item.itemId)}吧`,
                    `第${session.day}天 ${formatClock(session)}`,
                );
                gameBusEmit('logChanged', {
                    text: session.lastLog,
                    timeLabel: session.logs[session.logs.length - 1]?.timeLabel ?? '',
                });
            }
            // Keep active index until harvest (original keeps busy feel via step)
            activeFormulaByBid.set(bid, -2);
            emitCraft(bid);
        },
    });
    job.handle = handle;
    emitCraft(bid);
}

export function clickCraftAction(bid: number, formulaId: number): CraftClickResult {
    const session = getSession();
    if (!session) {
        return { ok: false, msg: '无存档' };
    }

    const entry = collectFormulas(bid).find((e) => e.formulaId === formulaId);
    if (!entry) {
        return { ok: false, msg: '未知配方' };
    }
    const { def, needLevel } = entry;
    const job = getOrCreateRuntime(bid, formulaId, needLevel);

    // Harvest path
    if (job.step === 2 && !job.isActioning) {
        const produce = def.produce.map((p) => ({ ...p }));
        gainStorageItems(produce);
        const item = produce[0]!;
        const stock = getSession()?.storage[item.itemId] ?? 0;
        appendSessionLog(
            `你收取了${item.num}个${itemTitle(item.itemId)}（当前库存：${stock}）`,
            `第${session.day}天 ${formatClock(session)}`,
        );
        gameBusEmit('logChanged', {
            text: getSession()?.lastLog ?? '',
            timeLabel: getSession()?.logs.slice(-1)[0]?.timeLabel ?? '',
        });
        job.step = 0;
        job.phase = 'idle';
        activeFormulaByBid.set(bid, -2);
        emitCraft(bid);
        return { ok: true };
    }

    if (job.isActioning) {
        return { ok: false, msg: '正在进行中' };
    }

    if (getBuildLevel(bid) < needLevel) {
        return { ok: false, msg: `你没有${buildName(bid, needLevel)}!` };
    }
    if (isFormulaLocked(formulaId)) {
        return { ok: false, msg: '需要商店解锁' };
    }
    if (!checkVigourOk()) {
        return { ok: false, msg: '精力不足，无法操作。' };
    }
    if (anyBusyOnBuild(bid)) {
        return { ok: false, msg: '该设施正忙' };
    }
    if (!validateStorageItems(def.cost)) {
        return { ok: false, msg: '材料不足' };
    }

    // Start make phase
    const makeTime = Math.max(1, def.makeTime * 60);
    const maxStep = def.placedTime?.length ? 2 : 1;
    job.step = 0;
    job.phase = 'make';
    job.isActioning = true;
    job.pastTime = 0;
    job.totalTime = makeTime;
    activeFormulaByBid.set(bid, formulaId);

    const handle = addTimerCallback(makeTime, {
        process: (dt) => {
            job.pastTime += dt;
            const percentage = Math.min(100, (job.pastTime / job.totalTime) * 100);
            gameBusEmit('progress', {
                channel: { kind: 'craft', id: bid },
                percentage,
            });
        },
        end: () => {
            job.handle = null;
            job.isActioning = false;
            job.pastTime = 0;
            if (maxStep === 2) {
                // Enter place phase (cost on transition)
                job.step = 1;
                startPlacePhase(bid, formulaId, def, job);
            } else {
                finishMakeImmediate(bid, formulaId, def, job);
            }
        },
    });
    job.handle = handle;
    accelerateWorkTime(makeTime);
    emitCraft(bid);
    return { ok: true };
}

export function clearCraftRuntime(): void {
    for (const job of runtime.values()) {
        if (job.handle) {
            removeTimerCallback(job.handle);
        }
    }
    runtime.clear();
    activeFormulaByBid.clear();
}

/** Expose for debug. */
export function getFormulaConfigCount(): number {
    return Object.keys(FORMULA_CONFIG).length;
}
