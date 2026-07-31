import { getSession, mutateSession } from '../session/sessionStore';

/** Exact 0..27 opening-guide sequence from Buried-City/src/game/userGuide.js. */
export const GuideStep = {
    GAME_START: 0,
    HOME_GATE: 1,
    GATE_OUT: 2,
    MAP_SITE: 3,
    MAP_SITE_GO: 4,
    ENTER_SITE: 5,
    FIGHT_SITE: 6,
    NEXT_ROOM: 7,
    WORK_SITE: 8,
    ALL_GET: 9,
    BACK_ROOM: 10,
    BACK_SITE: 11,
    MAP_SITE_HOME: 12,
    MAP_SITE_HOME_GO: 13,
    BACK_HOME_WARN: 14,
    HOME_STORAGE: 15,
    STORAGE_ITEM: 16,
    STORAGE_EAT: 17,
    STORAGE_BACK: 18,
    HOME_SLEEP: 19,
    MAKE_BED: 20,
    BED_SLEEP: 21,
    SLEEP_WAKE_UP: 22,
    WAKE_UP_WARN: 23,
    HOME_TOOL: 24,
    TOOL_ALEX: 25,
    TOOL_BACK: 26,
    HOME_GATE_AGAIN: 27,
    FINISHED: 28,
} as const;

export type GuideStepValue = (typeof GuideStep)[keyof typeof GuideStep];
export type UserGuideState = {
    version: 1;
    status: 'active' | 'completed' | 'skipped';
    step: GuideStepValue;
};

type GuideListener = () => void;
const listeners = new Set<GuideListener>();

export function getGuideState(): UserGuideState | null {
    return getSession()?.guide ?? null;
}

export function isGuideStep(step: GuideStepValue): boolean {
    const guide = getGuideState();
    return guide?.status === 'active' && guide.step === step;
}

/** Advance only from the expected step, making duplicate UI events harmless. */
export function advanceGuide(expected: GuideStepValue): boolean {
    if (!isGuideStep(expected)) {
        return false;
    }
    mutateSession((session) => {
        const next = Math.min(GuideStep.FINISHED, expected + 1) as GuideStepValue;
        session.guide.step = next;
        if (next === GuideStep.FINISHED) {
            session.guide.status = 'completed';
        }
    });
    notifyGuideChanged();
    return true;
}

export function skipGuide(): void {
    const guide = getGuideState();
    if (guide?.status !== 'active') {
        return;
    }
    mutateSession((session) => {
        session.guide.status = 'skipped';
        session.guide.step = GuideStep.FINISHED;
    });
    notifyGuideChanged();
}

export function onGuideChanged(listener: GuideListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function notifyGuideChanged(): void {
    for (const listener of [...listeners]) {
        listener();
    }
}
