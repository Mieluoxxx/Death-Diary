/**
 * Port of Buried-City player.die / relive + DeathNode first-aid logic.
 */

import { getSession, mutateSession, type SessionState } from '../session/sessionStore';
import { recomputeHpMax } from './playerAttrs';
import { gameBusEmit } from './gameBus';

/** Original RELIVE_ITEMID. */
export const FIRST_AID_KIT_ID = 1106054;

export function countFirstAidKits(session: SessionState = getSession()!): number {
    if (!session) {
        return 0;
    }
    return (session.bag[FIRST_AID_KIT_ID] ?? 0) + (session.storage[FIRST_AID_KIT_ID] ?? 0);
}

/** Prefer bag, then storage — original DeathNode order. */
export function consumeFirstAidKit(): boolean {
    const session = getSession();
    if (!session) {
        return false;
    }
    if ((session.bag[FIRST_AID_KIT_ID] ?? 0) >= 1) {
        mutateSession((live) => {
            const have = live.bag[FIRST_AID_KIT_ID] ?? 0;
            if (have <= 1) {
                delete live.bag[FIRST_AID_KIT_ID];
            } else {
                live.bag[FIRST_AID_KIT_ID] = have - 1;
            }
        });
        return true;
    }
    if ((session.storage[FIRST_AID_KIT_ID] ?? 0) >= 1) {
        mutateSession((live) => {
            const have = live.storage[FIRST_AID_KIT_ID] ?? 0;
            if (have <= 1) {
                delete live.storage[FIRST_AID_KIT_ID];
            } else {
                live.storage[FIRST_AID_KIT_ID] = have - 1;
            }
        });
        return true;
    }
    return false;
}

/**
 * Original player.relive: fill spirit/starve/vigour, clear injury/infect,
 * restore hp to max, clear sleep/cure/bind flags.
 */
export function relivePlayer(): boolean {
    const session = getSession();
    if (!session) {
        return false;
    }

    mutateSession((live) => {
        live.isDead = false;
        live.isInSleep = false;
        live.cured = false;
        live.cureTime = 0;
        live.binded = false;
        live.bindTime = 0;
        live.buff = null;

        live.attrs.injury = 0;
        live.attrs.infect = 0;
        live.attrs.starve = 100;
        live.attrs.vigour = 100;
        live.attrs.spirit = 100;
        recomputeHpMax(live);
        live.attrs.hp = live.attrs.hpMax;

        live.isAtHome = true;
        live.isAtSite = false;
        live.nowSiteId = null;
        live.navigation = [{ nodeName: 'HomeNode' }];
    });

    gameBusEmit('session_updated');
    return true;
}

/** Original cc.timer.getFinalTimeStr → "X天X时X分" (day index style). */
export function formatSurvivalDuration(session: SessionState): string {
    const dayLived = Math.max(0, session.day - 1);
    const hour = session.hour;
    const minute = session.minute;
    return `${dayLived}天${hour}时${minute}分`;
}

/** End screen big numbers: day index / hour / minute. */
export function survivalClockParts(session: SessionState): {
    day: string;
    hour: string;
    minute: string;
} {
    const dayLived = Math.max(0, session.day - 1);
    return {
        day: String(dayLived),
        hour: String(session.hour).padStart(2, '0'),
        minute: String(session.minute).padStart(2, '0'),
    };
}
