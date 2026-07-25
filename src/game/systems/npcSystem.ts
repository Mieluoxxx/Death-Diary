import {
    getNpcDef,
    isNpcId,
    NPC_IDS,
    ROLE_NPC_ID,
    type NpcDef,
    type NpcId,
    type NpcItemStack,
    type NpcReward,
} from '../data/npcConfig';
import { getSiteConfig } from '../data/siteConfig';
import {
    appendSessionLog,
    getSession,
    mutateSession,
    type ItemCounts,
    type NpcState,
    type RoleKey,
} from '../session/sessionStore';
import { getBagCapacity, getBagWeight, getCount } from './inventory';
import { isIapUnlocked } from './iapStore';
import { gameBusEmit } from './gameBus';
import { getItemDef, itemWeight } from '../data/itemConfig';

const NPC_REPUTATION_MAX = 10;
const SOCIAL_EFFECT_IAP_ID = 104;

export type NpcActionResult =
    | { ok: true }
    | {
          ok: false;
          reason:
              | 'no_session'
              | 'unknown_npc'
              | 'locked'
              | 'not_enough'
              | 'max_reputation'
              | 'overweight'
              | 'unfair_trade';
      };

export type NpcVisit = {
    npcId: NpcId;
    name: string;
    kind: 'gift' | 'help' | 'met';
    deliveredRewards: NpcReward[];
};

function addCount(counts: ItemCounts, itemId: number, amount: number): void {
    const next = (counts[itemId] ?? 0) + amount;
    if (next <= 0) {
        delete counts[itemId];
        return;
    }
    counts[itemId] = next;
}

function addItems(counts: ItemCounts, items: readonly NpcItemStack[]): void {
    for (const item of items) {
        addCount(counts, item.itemId, item.num);
    }
}

function stockForReputation(npc: NpcDef, reputation: number): ItemCounts {
    const storage: ItemCounts = {};
    for (let level = 0; level <= reputation; level += 1) {
        addItems(storage, npc.trading[level] ?? []);
    }
    return storage;
}

function addRewardsForLevel(state: NpcState, npc: NpcDef, level: number): void {
    const reward = npc.gifts[level];
    if (reward) {
        state.pendingRewards.push(reward);
    }
    if (isIapUnlocked(SOCIAL_EFFECT_IAP_ID)) {
        const extra = npc.extraGifts[level];
        if (extra) {
            state.pendingRewards.push(extra);
        }
    }
}

function applyReputationGain(state: NpcState, npc: NpcDef, amount: number): number {
    const previous = state.reputation;
    state.reputation = Math.min(NPC_REPUTATION_MAX, state.reputation + amount);
    for (let level = state.maxReputation + 1; level <= state.reputation; level += 1) {
        addRewardsForLevel(state, npc, level);
        addItems(state.storage, npc.trading[level] ?? []);
    }
    state.maxReputation = Math.max(state.maxReputation, state.reputation);
    return state.reputation - previous;
}

/** Map visibility is derived from this state; no secondary map NPC list exists. */
export function isNpcUnlocked(npcId: number): boolean {
    if (!isNpcId(npcId)) {
        return false;
    }
    return Boolean(getSession()?.npcs[npcId].unlocked);
}

export function getNpcState(npcId: number): NpcState | null {
    if (!isNpcId(npcId)) {
        return null;
    }
    return getSession()?.npcs[npcId] ?? null;
}

export function unlockNpc(npcId: number): NpcActionResult {
    const npc = getNpcDef(npcId);
    const session = getSession();
    if (!session) {
        return { ok: false, reason: 'no_session' };
    }
    if (!npc) {
        return { ok: false, reason: 'unknown_npc' };
    }
    if (session.npcs[npc.id].unlocked) {
        return { ok: true };
    }
    mutateSession((live) => {
        const state = live.npcs[npc.id];
        state.unlocked = true;
        state.storage = stockForReputation(npc, state.reputation);
    });
    appendSessionLog(`${npc.name} 出现在地图上。`);
    gameBusEmit('session_updated');
    return { ok: true };
}

export function getNpcNeed(npcId: number): NpcItemStack | null {
    const npc = getNpcDef(npcId);
    const state = getNpcState(npcId);
    if (!npc || !state?.unlocked) {
        return null;
    }
    for (let level = state.reputation; level >= 0; level -= 1) {
        const need = npc.needItems[level];
        if (need) {
            return need;
        }
    }
    return null;
}

export function giveNpcNeed(npcId: number): NpcActionResult {
    const npc = getNpcDef(npcId);
    const session = getSession();
    if (!session) {
        return { ok: false, reason: 'no_session' };
    }
    if (!npc) {
        return { ok: false, reason: 'unknown_npc' };
    }
    const state = session.npcs[npc.id];
    if (!state.unlocked) {
        return { ok: false, reason: 'locked' };
    }
    if (state.reputation >= NPC_REPUTATION_MAX) {
        return { ok: false, reason: 'max_reputation' };
    }
    const need = getNpcNeed(npc.id);
    if (!need || getCount(session.bag, need.itemId) < need.num) {
        return { ok: false, reason: 'not_enough' };
    }
    mutateSession((live) => {
        const liveState = live.npcs[npc.id];
        addCount(live.bag, need.itemId, -need.num);
        applyReputationGain(liveState, npc, 1);
    });
    appendSessionLog(
        `你向${npc.name}交付了${getItemDef(need.itemId).name}x${need.num}，好感度提升。`,
    );
    gameBusEmit('session_updated');
    return { ok: true };
}

function weightedValue(
    counts: ItemCounts,
    favorite: readonly { itemId: number; price: number }[],
): number {
    const rates = new Map(favorite.map((entry) => [entry.itemId, entry.price]));
    return Object.entries(counts).reduce((total, [id, num]) => {
        const itemId = Number(id);
        return total + getItemDef(itemId).value * num * (rates.get(itemId) ?? 1);
    }, 0);
}

export function getNpcTradeRate(npcId: number, offer: ItemCounts, requested: ItemCounts): number {
    const npc = getNpcDef(npcId);
    const state = getNpcState(npcId);
    if (!npc || !state) {
        return 0;
    }
    const favorite = npc.favorite[state.reputation] ?? [];
    const requestedValue = weightedValue(requested, []);
    return requestedValue > 0 ? weightedValue(offer, favorite) / requestedValue : 0;
}

function countsWeight(counts: ItemCounts): number {
    return Object.entries(counts).reduce(
        (total, [id, num]) => total + itemWeight(Number(id)) * num,
        0,
    );
}

function hasCounts(have: ItemCounts, wanted: ItemCounts): boolean {
    return Object.entries(wanted).every(([id, num]) => (have[Number(id)] ?? 0) >= num);
}

/** Commit a transactional NPC trade draft after its rate and inventory checks. */
export function commitNpcTrade(
    npcId: number,
    offer: ItemCounts,
    requested: ItemCounts,
): NpcActionResult {
    const npc = getNpcDef(npcId);
    const session = getSession();
    if (!session) {
        return { ok: false, reason: 'no_session' };
    }
    if (!npc) {
        return { ok: false, reason: 'unknown_npc' };
    }
    const state = session.npcs[npc.id];
    if (!state.unlocked) {
        return { ok: false, reason: 'locked' };
    }
    if (!hasCounts(session.bag, offer) || !hasCounts(state.storage, requested)) {
        return { ok: false, reason: 'not_enough' };
    }
    if (getNpcTradeRate(npc.id, offer, requested) < 1) {
        return { ok: false, reason: 'unfair_trade' };
    }
    const finalWeight = getBagWeight(session) - countsWeight(offer) + countsWeight(requested);
    if (finalWeight > getBagCapacity(session)) {
        return { ok: false, reason: 'overweight' };
    }
    mutateSession((live) => {
        const liveState = live.npcs[npc.id];
        for (const [id, num] of Object.entries(offer)) {
            const itemId = Number(id);
            addCount(live.bag, itemId, -num);
            addCount(liveState.storage, itemId, num);
        }
        for (const [id, num] of Object.entries(requested)) {
            const itemId = Number(id);
            addCount(liveState.storage, itemId, -num);
            addCount(live.bag, itemId, num);
        }
        liveState.tradingCount += 1;
    });
    appendSessionLog(`你与${npc.name}完成了一次交换。`);
    gameBusEmit('session_updated');
    return { ok: true };
}

function deliverRewards(npcId: NpcId): NpcReward[] {
    const npc = getNpcDef(npcId)!;
    const state = getNpcState(npcId);
    if (!state || state.pendingRewards.length === 0) {
        return [];
    }
    const delivered = [...state.pendingRewards];
    mutateSession((live) => {
        const liveState = live.npcs[npcId];
        liveState.pendingRewards = [];
        for (const reward of delivered) {
            if (reward.kind === 'item') {
                addCount(live.storage, reward.itemId, reward.num);
                continue;
            }
            if (getSiteConfig(reward.siteId) && !live.map.unlocked.includes(reward.siteId)) {
                live.map.unlocked.push(reward.siteId);
            }
        }
    });
    for (const reward of delivered) {
        if (reward.kind === 'item') {
            appendSessionLog(`${npc.name} 送来了${getItemDef(reward.itemId).name}x${reward.num}。`);
        } else {
            const name = getSiteConfig(reward.siteId)?.name ?? `地点${reward.siteId}`;
            appendSessionLog(`${npc.name} 为你标出了${name}的位置。`);
        }
    }
    return delivered;
}

export function refreshNpcTrading(): void {
    if (!getSession()) {
        return;
    }
    mutateSession((live) => {
        for (const npcId of NPC_IDS) {
            const state = live.npcs[npcId];
            if (state.unlocked) {
                state.storage = stockForReputation(getNpcDef(npcId)!, state.reputation);
            }
        }
    });
    gameBusEmit('session_updated');
}

/** Original dawn visit: introduce an NPC, deliver unlocked rewards, or flag a request. */
export function runNpcDailyVisit(random: () => number = Math.random): NpcVisit | null {
    const session = getSession();
    if (!session || session.day < 2 || random() > 0.25) {
        return null;
    }
    const roleNpcId = ROLE_NPC_ID[session.role as RoleKey];
    const pool = NPC_IDS.filter((npcId) => npcId !== roleNpcId && npcId !== 5);
    if (session.npcs[5].unlocked) {
        pool.push(5);
    }
    const npcId = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]!;
    const npc = getNpcDef(npcId)!;
    const wasUnlocked = session.npcs[npcId].unlocked;
    unlockNpc(npcId);
    const deliveredRewards = deliverRewards(npcId);
    const kind: NpcVisit['kind'] =
        deliveredRewards.length > 0 ? 'gift' : wasUnlocked ? 'help' : 'met';
    if (kind === 'help') {
        const need = getNpcNeed(npcId);
        if (need) {
            appendSessionLog(
                `${npc.name} 托人询问你是否有${getItemDef(need.itemId).name}x${need.num}。`,
            );
        }
    }
    const visit = { npcId, name: npc.name, kind, deliveredRewards };
    gameBusEmit('npc_visit', visit);
    gameBusEmit('session_updated');
    return visit;
}
