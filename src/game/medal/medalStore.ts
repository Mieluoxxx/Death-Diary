/**
 * Port of Buried-City Medal (assets/src/game/medal.js).
 * Cross-run medal progress in localStorage["medal"].
 * Web slice: storage + progress API; grant/improve wired when player/session exists.
 */

export type MedalSeriesIndex = 1 | 2 | 3;

export type MedalId = '101' | '102' | '103' | '201' | '202' | '203' | '301' | '302' | '303';

export type MedalEntry = {
    aim: number;
    aimCompleted: number;
    completed: 0 | 1;
    warned?: boolean;
    effect: {
        items?: Array<{ itemId: number; num: number }>;
        attr?: { hp: number };
    };
};

export type MedalMap = Record<MedalId, MedalEntry>;

/** Config from original MedalConfig — aim / effect are source of truth on load. */
export const MEDAL_CONFIG: MedalMap = {
    '103': {
        aim: 5,
        aimCompleted: 0,
        completed: 0,
        effect: { items: [{ itemId: 1103083, num: 6 }] },
    },
    '102': {
        aim: 60,
        aimCompleted: 0,
        completed: 0,
        effect: { items: [{ itemId: 1104011, num: 2 }] },
    },
    '101': {
        aim: 120,
        aimCompleted: 0,
        completed: 0,
        effect: { items: [{ itemId: 1104043, num: 1 }] },
    },
    '203': {
        aim: 20,
        aimCompleted: 0,
        completed: 0,
        effect: { attr: { hp: 10 } },
    },
    '202': {
        aim: 400,
        aimCompleted: 0,
        completed: 0,
        effect: { attr: { hp: 20 } },
    },
    '201': {
        aim: 8000,
        aimCompleted: 0,
        completed: 0,
        effect: { attr: { hp: 50 } },
    },
    '303': {
        aim: 5,
        aimCompleted: 0,
        completed: 0,
        effect: { items: [{ itemId: 1305011, num: 30 }] },
    },
    '302': {
        aim: 10,
        aimCompleted: 0,
        completed: 0,
        effect: { items: [{ itemId: 1301011, num: 1 }] },
    },
    '301': {
        aim: 30,
        aimCompleted: 0,
        completed: 0,
        effect: { items: [{ itemId: 1301052, num: 1 }] },
    },
};

const STORAGE_KEY = 'medal';
const ONE_GAME_KEY = 'medalForOneGame';

function cloneConfig(): MedalMap {
    return JSON.parse(JSON.stringify(MEDAL_CONFIG)) as MedalMap;
}

function isMedalId(value: string): value is MedalId {
    return value in MEDAL_CONFIG;
}

function loadMap(): MedalMap {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return cloneConfig();
        }
        const parsed = JSON.parse(raw) as Partial<Record<string, Partial<MedalEntry>>>;
        const map = cloneConfig();
        for (const medalId of Object.keys(MEDAL_CONFIG) as MedalId[]) {
            const saved = parsed[medalId];
            if (!saved) {
                continue;
            }
            if (typeof saved.aimCompleted === 'number') {
                map[medalId].aimCompleted = saved.aimCompleted;
            }
            if (saved.completed === 0 || saved.completed === 1) {
                map[medalId].completed = saved.completed;
            }
            if (typeof saved.warned === 'boolean') {
                map[medalId].warned = saved.warned;
            }
            // aim + effect always from config (original Medal.init)
        }
        return map;
    } catch {
        return cloneConfig();
    }
}

let medalMap: MedalMap | null = null;
let completedForOneGame: MedalSeriesIndex[] = [];

export function initMedal(): MedalMap {
    if (!medalMap) {
        medalMap = loadMap();
    }
    try {
        const raw = localStorage.getItem(ONE_GAME_KEY);
        completedForOneGame = raw ? (JSON.parse(raw) as MedalSeriesIndex[]) : [];
    } catch {
        completedForOneGame = [];
    }
    return medalMap;
}

export function getMedalMap(): MedalMap {
    return initMedal();
}

export function saveMedal(): void {
    if (!medalMap) {
        return;
    }
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(medalMap));
    } catch {
        // ignore quota / private mode
    }
}

/**
 * Active tier for a series (1=days, 2=kills, 3=secret).
 * Original: walk 03→01; stop on first incomplete after completed lower tiers.
 */
export function getNowMedalId(seriesIndex: MedalSeriesIndex): MedalId {
    const map = getMedalMap();
    let medalInfoIndex = Number(`${seriesIndex}03`);
    const endIndex = Number(`${seriesIndex}01`);
    for (let medalIdNumber = medalInfoIndex; medalIdNumber >= endIndex; medalIdNumber -= 1) {
        const key = String(medalIdNumber);
        if (isMedalId(key) && map[key].completed) {
            medalInfoIndex = medalIdNumber - 1;
        }
    }
    const candidate = String(medalInfoIndex);
    if (isMedalId(candidate) && map[candidate]) {
        return candidate;
    }
    const fallback = String(medalInfoIndex + 1);
    return (isMedalId(fallback) ? fallback : `${seriesIndex}03`) as MedalId;
}

/** Highest completed tier id in a series, or null if none. */
export function getCompletedMedalId(seriesIndex: MedalSeriesIndex): MedalId | null {
    const map = getMedalMap();
    let medalInfoIndex = Number(`${seriesIndex}03`);
    const endIndex = Number(`${seriesIndex}01`);
    let found: MedalId | null = null;
    for (let medalIdNumber = medalInfoIndex; medalIdNumber >= endIndex; medalIdNumber -= 1) {
        const key = String(medalIdNumber);
        if (isMedalId(key) && map[key].completed) {
            found = key;
            medalInfoIndex = medalIdNumber;
        }
    }
    return found;
}

/** Star frame: original star_(3-level) with special case when grade-1 completed. */
export function getStarFrameForMedal(medalId: MedalId, completed: boolean): string {
    const level = Number(String(medalId).slice(-1));
    if (level === 1 && completed) {
        return 'star_3.png';
    }
    return `star_${3 - level}.png`;
}

export function markMedalWarned(medalId: MedalId): void {
    const map = getMedalMap();
    if (map[medalId]) {
        map[medalId].warned = true;
        saveMedal();
    }
}

function checkCompleted(medalInfo: MedalEntry, seriesIndex: MedalSeriesIndex): void {
    if (medalInfo.completed === 1) {
        return;
    }
    if (medalInfo.aimCompleted >= medalInfo.aim) {
        medalInfo.completed = 1;
        completedForOneGame.push(seriesIndex);
        try {
            localStorage.setItem(ONE_GAME_KEY, JSON.stringify(completedForOneGame));
        } catch {
            // ignore
        }
    }
}

export function checkDay(day: number): void {
    const map = getMedalMap();
    for (const medalId of ['101', '102', '103'] as MedalId[]) {
        const info = map[medalId];
        if (info.completed !== 1) {
            info.aimCompleted += Number(day);
            checkCompleted(info, 1);
        }
    }
    saveMedal();
}

