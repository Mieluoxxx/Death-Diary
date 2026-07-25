/**
 * Shared timed-progress jobs for facility / craft / upgrade style actions.
 *
 * One channel + percentage stream drives UI progress bars.
 * Callers own domain side-effects in onTick / onEnd.
 */

import { gameBusEmit } from './gameBus';
import { accelerateWorkTime, addTimerCallback, type TimerCallbackHandle } from './timeClock';

export type ProgressKind = 'facility' | 'craft' | 'build_upgrade';

export type ProgressChannel = {
    kind: ProgressKind;
    /** Building / facility id (or other primary id). */
    id: number;
    /** Optional sub-action (e.g. bed actionId 0/1/2). */
    actionId?: number;
};

export type TimedProgressJob = {
    channel: ProgressChannel;
    isActioning: boolean;
    pastTime: number;
    totalTime: number;
    handle: TimerCallbackHandle | null;
};

export type StartTimedProgressOpts = {
    channel: ProgressChannel;
    /** Duration in game seconds. */
    duration: number;
    /** Default true — match original accelerateWorkTime. */
    accelerate?: boolean;
    onTick?: (job: TimedProgressJob, percentage: number) => void;
    onEnd?: (job: TimedProgressJob) => void;
};

/** Active jobs keyed by channel identity. */
const jobs = new Map<string, TimedProgressJob>();

export function progressKey(channel: ProgressChannel): string {
    const action = channel.actionId ?? -1;
    return `${channel.kind}:${channel.id}:${action}`;
}

export function getTimedProgressJob(channel: ProgressChannel): TimedProgressJob | null {
    return jobs.get(progressKey(channel)) ?? null;
}

export function isTimedProgressActive(channel: ProgressChannel): boolean {
    return Boolean(jobs.get(progressKey(channel))?.isActioning);
}

export function timedProgressPercentage(channel: ProgressChannel): number {
    const job = jobs.get(progressKey(channel));
    if (!job?.isActioning || job.totalTime <= 0) {
        return 0;
    }
    return Math.min(100, (job.pastTime / job.totalTime) * 100);
}

/**
 * Start a timed job that emits `progress` each process tick and `progress_done` on end.
 * Replaces any existing job on the same channel.
 */
export function startTimedProgress(opts: StartTimedProgressOpts): TimedProgressJob {
    const key = progressKey(opts.channel);
    const existing = jobs.get(key);
    if (existing?.handle) {
        // Leave previous timer running if still registered; mark idle so UI drops it.
        existing.isActioning = false;
        existing.handle = null;
    }

    const duration = Math.max(1, opts.duration);
    const job: TimedProgressJob = {
        channel: opts.channel,
        isActioning: true,
        pastTime: 0,
        totalTime: duration,
        handle: null,
    };
    jobs.set(key, job);

    const handle = addTimerCallback(duration, {
        process: (dt) => {
            job.pastTime += dt;
            const percentage = Math.min(100, (job.pastTime / job.totalTime) * 100);
            gameBusEmit('progress', {
                channel: opts.channel,
                percentage,
            });
            opts.onTick?.(job, percentage);
        },
        end: () => {
            job.isActioning = false;
            job.handle = null;
            job.pastTime = 0;
            jobs.delete(key);
            gameBusEmit('progress', {
                channel: opts.channel,
                percentage: 100,
            });
            gameBusEmit('progress_done', { channel: opts.channel });
            opts.onEnd?.(job);
        },
    });
    job.handle = handle;

    if (opts.accelerate !== false) {
        accelerateWorkTime(duration);
    }

    // Initial paint so bars don't wait for first tick.
    gameBusEmit('progress', {
        channel: opts.channel,
        percentage: 0,
    });

    return job;
}

export function clearTimedProgress(channel: ProgressChannel): void {
    const key = progressKey(channel);
    const job = jobs.get(key);
    if (!job) {
        return;
    }
    job.isActioning = false;
    job.handle = null;
    jobs.delete(key);
}
