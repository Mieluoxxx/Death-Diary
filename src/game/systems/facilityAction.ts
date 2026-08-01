/**
 * Facility actions: bed, chair rest/drink, dog feed, minefield, electric fence.
 * Chair (bid 10) ports RestBuildAction / DrinkBuildAction + buildActionConfig.
 */

import { CHAIR_ACTIONS, DOG_FEED_ACTION, MINEFIELD_ACTION } from '../data/buildActionConfig';
import { getItemDef } from '../data/itemConfig';
import { syncCloudSaveCheckpoint } from '../session/cloudSave';
import {
    appendSessionLog,
    costStorageItems,
    formatClock,
    getBuildLevel,
    getSession,
    mutateSession,
    validateStorageItems,
} from '../session/sessionStore';
import { checkVigourOk } from './buildSystem';
import { gameBusEmit } from './gameBus';
import { changeSpirit } from './playerAttrs';
import { addBonfireFuel } from './survivalLoop';
import type { TimerCallbackHandle } from './timeClock';
import {
    getTimedProgressJob,
    isTimedProgressActive,
    startTimedProgress,
    timedProgressPercentage,
} from './timedProgress';
import { advanceGuide, GuideStep } from './userGuide';

export type FacilityCostRow = {
    itemId: number;
    num: number;
    ok: boolean;
};

export type FacilityActionView = {
    bid: number;
    actionId: number;
    iconHint: string;
    step?: number;
    isActioning: boolean;
    percentage: number;
    hint?: string;
    hintColor?: 'red' | 'white' | 'gray';
    costRows: FacilityCostRow[];
    actionLabel: string;
    actionDisabled: boolean;
};

export type FacilityClickResult = { ok: true; msg?: string } | { ok: false; msg: string };

type ChairJob = {
    actionId: number;
    isActioning: boolean;
    pastTime: number;
    totalTime: number;
    handle: TimerCallbackHandle | null;
};

const chairJobs = new Map<number, ChairJob>();

function costRowsFor(costs: Array<{ itemId: number; num: number }>): FacilityCostRow[] {
    const session = getSession();
    return costs.map((c) => ({
        itemId: c.itemId,
        num: c.num,
        ok: Boolean(session && (session.storage[c.itemId] ?? 0) >= c.num),
    }));
}

function chairLevelIndex(): number {
    const level = getBuildLevel(10);
    const idx = Math.max(0, level);
    return Math.min(idx, CHAIR_ACTIONS.length - 1);
}

function chairConfig(actionId: number) {
    const levelCfg = CHAIR_ACTIONS[chairLevelIndex()]!;
    return levelCfg[actionId] ?? levelCfg[0]!;
}

function itemTitle(itemId: number): string {
    return getItemDef(itemId).name;
}

/** Busy rest/drink on chair. */
function chairBusy(): boolean {
    for (const job of chairJobs.values()) {
        if (job.isActioning) {
            return true;
        }
    }
    return false;
}

export function listFacilityActions(bid: number): FacilityActionView[] {
    const session = getSession();
    if (!session) {
        return [];
    }
    const level = getBuildLevel(bid);

    // Bed (9)
    if (bid === 9) {
        const locked = level < 0;
        // Any sleep action occupies the bed (original activeBtnIndex exclusivity).
        const sleepBusy = [0, 1, 2].some((actionId) =>
            isTimedProgressActive({ kind: 'facility', id: 9, actionId }),
        );
        const activeSleep = [0, 1, 2]
            .map((actionId) => getTimedProgressJob({ kind: 'facility', id: 9, actionId }))
            .find((job) => job?.isActioning);
        const activeId = activeSleep?.channel.actionId;
        const pct = sleepBusy
            ? timedProgressPercentage({
                  kind: 'facility',
                  id: 9,
                  actionId: activeId,
              })
            : 0;

        const rows: FacilityActionView[] = [];
        for (const actionId of [0, 1, 2] as const) {
            const hints = ['睡1个小时', '睡4个小时', '睡到天亮'] as const;
            const thisBusy = isTimedProgressActive({ kind: 'facility', id: 9, actionId });
            const anyOtherBusy = sleepBusy && !thisBusy;
            rows.push({
                bid,
                actionId,
                iconHint: `build_action_9_${actionId}.png`,
                isActioning: thisBusy,
                // Show progress on the active row (and keep bar fill via percentage).
                percentage: thisBusy ? pct : 0,
                hint: locked
                    ? '你没有睡袋!'
                    : thisBusy
                      ? '进入睡眠，身体和精力得到恢复'
                      : hints[actionId],
                hintColor: locked ? 'red' : 'white',
                costRows: [],
                actionLabel: '睡觉',
                actionDisabled: locked || sleepBusy || anyOtherBusy,
            });
        }
        return rows;
    }

    // Chair (10): coffee rest + Luo drink
    if (bid === 10) {
        const locked = level < 0;
        const levelIdx = Math.max(0, level);
        const actions: FacilityActionView[] = [];

        // index 0: coffee
        {
            const cfg = chairConfig(0);
            const job = chairJobs.get(0);
            const busy = Boolean(job?.isActioning);
            const pct =
                busy && job && job.totalTime > 0
                    ? Math.min(100, (job.pastTime / job.totalTime) * 100)
                    : 0;
            const rows = costRowsFor(cfg.cost);
            let hint: string | undefined;
            let hintColor: FacilityActionView['hintColor'];
            let disabled = locked;

            if (locked) {
                hint = '你没有椅子!';
                hintColor = 'red';
                disabled = true;
            } else if (busy) {
                hint =
                    levelIdx >= 2
                        ? '伴随着音乐和咖啡，你仿佛回到了从前的时光'
                        : levelIdx >= 1
                          ? '柔软的沙发和香醇的咖啡让你感到放松'
                          : '你享受着一杯热咖啡';
                hintColor = 'white';
                disabled = true;
            } else {
                disabled = rows.some((r) => !r.ok) || chairBusy();
            }

            actions.push({
                bid,
                actionId: 0,
                iconHint: 'build_action_10_0.png',
                isActioning: busy,
                percentage: pct,
                hint,
                hintColor,
                costRows: busy || locked ? [] : rows,
                actionLabel: `喝咖啡(${cfg.makeTime}分)`,
                actionDisabled: disabled,
            });
        }

        // index 1: drink — Luo only
        if (session.role === 'LUO') {
            const cfg = chairConfig(1);
            const job = chairJobs.get(1);
            const busy = Boolean(job?.isActioning);
            const pct =
                busy && job && job.totalTime > 0
                    ? Math.min(100, (job.pastTime / job.totalTime) * 100)
                    : 0;
            const rows = costRowsFor(cfg.cost);
            let hint: string | undefined;
            let hintColor: FacilityActionView['hintColor'];
            let disabled = locked;

            if (locked) {
                hint = '你没有椅子!';
                hintColor = 'red';
                disabled = true;
            } else if (busy) {
                hint =
                    levelIdx >= 2
                        ? '微醺的时候，连光线都变得柔和'
                        : levelIdx >= 1
                          ? '酒的辛辣驱散了空气中的恶臭和血腥，仿佛世界回归了正常'
                          : '一杯烈酒下肚，你感到身体暖活起来';
                hintColor = 'white';
                disabled = true;
            } else {
                disabled = rows.some((r) => !r.ok) || chairBusy();
            }

            actions.push({
                bid,
                actionId: 1,
                iconHint: 'build_action_10_1.png',
                isActioning: busy,
                percentage: pct,
                hint,
                hintColor,
                costRows: busy || locked ? [] : rows,
                actionLabel: `喝酒(${cfg.makeTime}分)`,
                actionDisabled: disabled,
            });
        }

        return actions;
    }

    // Dog house (12)
    if (bid === 12 && level >= 0) {
        const active = session.dogStarve > 0;
        const canFeed = session.dogStarve < session.dogStarveMax;
        const rows = costRowsFor([...DOG_FEED_ACTION.cost]);
        const okCost = rows.every((r) => r.ok);
        return [
            {
                bid,
                actionId: 0,
                iconHint: 'build_12_0.png',
                isActioning: false,
                percentage: 0,
                hint: active ? '狗很有精神' : '狗饿得厉害，无法协助防御',
                hintColor: active ? 'white' : 'red',
                costRows: rows,
                actionLabel: `喂食(${DOG_FEED_ACTION.makeTime}分)`,
                actionDisabled: !canFeed || !okCost,
            },
        ];
    }

    // Bonfire / fireplace (5)
    if (bid === 5 && level >= 0) {
        const fuel = session.bonfireFuel ?? 0;
        const rows = costRowsFor([{ itemId: 1101011, num: 1 }]);
        const okCost = rows.every((r) => r.ok);
        return [
            {
                bid,
                actionId: 0,
                iconHint: 'build_5_0.png',
                isActioning: fuel > 0,
                percentage: fuel > 0 ? Math.min(100, (fuel / 6) * 100) : 0,
                hint: fuel > 0 ? `燃烧中 燃料${fuel}/6` : '添加木材生火取暖',
                hintColor: fuel > 0 ? 'white' : 'gray',
                costRows: rows,
                actionLabel: fuel >= 6 ? '燃料已满' : '添柴',
                actionDisabled: fuel >= 6 || !okCost,
            },
        ];
    }

    // Minefield (17)
    if (bid === 17 && level >= 0) {
        const armed = session.isBombActive;
        const rows = costRowsFor([...MINEFIELD_ACTION.cost]);
        const okCost = rows.every((r) => r.ok);
        return [
            {
                bid,
                actionId: 0,
                iconHint: 'build_17_0.png',
                isActioning: false,
                percentage: 0,
                hint: armed ? '雷区已布置，可抵御一次夜袭' : '布置雷区以抵御夜袭',
                hintColor: armed ? 'white' : 'gray',
                costRows: rows,
                actionLabel: armed ? '已激活' : `布置(${MINEFIELD_ACTION.makeTime}分)`,
                actionDisabled: armed || !okCost,
            },
        ];
    }

    // Electric fence (19)
    if (bid === 19 && level >= 0) {
        const on = session.electricFenceActive;
        return [
            {
                bid,
                actionId: 0,
                iconHint: 'build_19_0.png',
                isActioning: false,
                percentage: 0,
                hint: on ? '电网运行中' : '启动电网抵御夜袭（需发电厂）',
                hintColor: on ? 'white' : 'gray',
                costRows: [],
                actionLabel: on ? '关闭' : '启动',
                actionDisabled: false,
            },
        ];
    }

    return [];
}

export function clickFacilityAction(bid: number, actionId: number): FacilityClickResult {
    const session = getSession();
    if (!session) {
        return { ok: false, msg: '无存档' };
    }

    // Bonfire add fuel
    if (bid === 5) {
        return addBonfireFuel();
    }

    // Bed sleep
    if (bid === 9) {
        if (getBuildLevel(9) < 0) {
            return { ok: false, msg: '你没有睡袋!' };
        }
        if (
            [0, 1, 2].some((id) => isTimedProgressActive({ kind: 'facility', id: 9, actionId: id }))
        ) {
            return { ok: false, msg: '已经在睡觉' };
        }
        let hours = 1;
        if (actionId === 1) {
            hours = 4;
        } else if (actionId === 2) {
            hours = 8;
        }
        const gameSeconds = hours * 3600;
        void syncCloudSaveCheckpoint(session);
        mutateSession((live) => {
            live.isInSleep = true;
        });
        startTimedProgress({
            channel: { kind: 'facility', id: 9, actionId },
            duration: gameSeconds,
            accelerate: true,
            onEnd: () => {
                mutateSession((live) => {
                    live.isInSleep = false;
                });
                const live = getSession();
                if (live) {
                    appendSessionLog('你醒了。', `第${live.day}天 ${formatClock(live)}`);
                }
                gameBusEmit('facility_changed', { bid: 9 });
                gameBusEmit('session_updated');
            },
        });
        if (actionId === 0) {
            advanceGuide(GuideStep.BED_SLEEP);
        }
        // Also notify facility listeners so list rebuilds into "sleeping" state.
        gameBusEmit('facility_changed', { bid: 9 });
        gameBusEmit('session_updated');
        return { ok: true, msg: `睡了约${hours}小时` };
    }

    // Chair rest / drink
    if (bid === 10) {
        if (getBuildLevel(10) < 0) {
            return { ok: false, msg: '你没有椅子!' };
        }
        if (actionId === 1 && session.role !== 'LUO') {
            return { ok: false, msg: '只有老罗会在这里喝酒' };
        }
        if (!checkVigourOk()) {
            return { ok: false, msg: '你太累做不了任何工作，还是先去睡觉吧' };
        }
        if (chairBusy()) {
            return { ok: false, msg: '正在休息中' };
        }

        const cfg = chairConfig(actionId);
        if (!validateStorageItems(cfg.cost)) {
            return { ok: false, msg: '材料不足' };
        }

        const makeTime = Math.max(1, cfg.makeTime * 60);
        // Track chair jobs for busy checks and per-action progress.
        const job: ChairJob = {
            actionId,
            isActioning: true,
            pastTime: 0,
            totalTime: makeTime,
            handle: null,
        };
        chairJobs.set(actionId, job);

        const timed = startTimedProgress({
            channel: { kind: 'facility', id: 10, actionId },
            duration: makeTime,
            accelerate: true,
            onTick: (timedJob) => {
                job.pastTime = timedJob.pastTime;
            },
            onEnd: () => {
                job.isActioning = false;
                job.handle = null;
                job.pastTime = 0;
                chairJobs.delete(actionId);

                if (!validateStorageItems(cfg.cost)) {
                    gameBusEmit('facility_changed', { bid: 10 });
                    gameBusEmit('session_updated');
                    return;
                }
                costStorageItems(cfg.cost);

                if (Math.random() <= (cfg.effect.spirit_chance ?? 1)) {
                    changeSpirit(cfg.effect.spirit);
                }

                const first = cfg.cost[0]!;
                const name = itemTitle(first.itemId);
                const stock = getSession()?.storage[first.itemId] ?? 0;
                const live = getSession();
                if (live) {
                    if (actionId === 1) {
                        appendSessionLog(
                            `你静静地待了一会儿，（喝了一瓶酒（${name}当前库存：${stock}）），尝试着放松自己`,
                            `第${live.day}天 ${formatClock(live)}`,
                        );
                    } else {
                        appendSessionLog(
                            `你静静地待了一会儿，（喝了一杯咖啡（${name}当前库存：${stock}）），尝试着放松自己`,
                            `第${live.day}天 ${formatClock(live)}`,
                        );
                    }
                    gameBusEmit('logChanged', {
                        text: live.lastLog,
                        timeLabel: live.logs[live.logs.length - 1]?.timeLabel ?? '',
                    });
                }
                gameBusEmit('facility_changed', { bid: 10 });
                gameBusEmit('session_updated');
            },
        });
        job.handle = timed.handle;
        gameBusEmit('facility_changed', { bid: 10 });
        gameBusEmit('session_updated');
        return { ok: true };
    }

    if (bid === 12) {
        if (session.dogStarve >= session.dogStarveMax) {
            return { ok: false, msg: '狗已经吃饱了' };
        }
        if (!validateStorageItems([...DOG_FEED_ACTION.cost])) {
            return { ok: false, msg: '缺少肉' };
        }
        costStorageItems([...DOG_FEED_ACTION.cost]);
        mutateSession((live) => {
            live.dogStarve = live.dogStarveMax;
        });
        gameBusEmit('facility_changed', { bid });
        gameBusEmit('session_updated');
        return { ok: true, msg: '狗吃饱了，会协助抵御夜袭' };
    }

    if (bid === 17) {
        if (session.isBombActive) {
            return { ok: false, msg: '雷区已布置' };
        }
        if (!validateStorageItems([...MINEFIELD_ACTION.cost])) {
            return { ok: false, msg: '缺少自制炸药' };
        }
        costStorageItems([...MINEFIELD_ACTION.cost]);
        mutateSession((live) => {
            live.isBombActive = true;
        });
        gameBusEmit('facility_changed', { bid });
        gameBusEmit('session_updated');
        return { ok: true, msg: '雷区已布置' };
    }

    if (bid === 19) {
        mutateSession((live) => {
            live.electricFenceActive = !live.electricFenceActive;
        });
        gameBusEmit('facility_changed', { bid });
        gameBusEmit('session_updated');
        const on = getSession()?.electricFenceActive;
        return { ok: true, msg: on ? '电网已启动' : '电网已关闭' };
    }

    return { ok: false, msg: '设施动作尚未接入' };
}
