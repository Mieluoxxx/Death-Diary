/**
 * Thin pub/sub for domain → UI (port of utils.emitter).
 * Not a gameplay rule engine — only notifies listeners after state changes.
 */

export type GameBusEventMap = {
    /** Any survival attribute changed; payload is the delta. */
    attr_change: { key: string; delta: number; value: number };
    hp_change: number;
    spirit_change: number;
    starve_change: number;
    vigour_change: number;
    injury_change: number;
    infect_change: number;
    temperature_change: number;
    logChanged: { text: string; timeLabel: string };
    time_tick: { gameTime: number; day: number; hour: number; minute: number };
    stage_change: 'day' | 'night';
    season_change: 0 | 1 | 2 | 3;
    weather_change: number;
    player_died: void;
    session_updated: void;
};

type Handler<T> = (payload: T) => void;

const listeners = new Map<string, Set<Handler<unknown>>>();

export function gameBusOn<K extends keyof GameBusEventMap> (
    eventName: K,
    handler: Handler<GameBusEventMap[K]>,
): void
{
    const key = eventName as string;
    let set = listeners.get(key);
    if (!set)
    {
        set = new Set();
        listeners.set(key, set);
    }
    set.add(handler as Handler<unknown>);
}

export function gameBusOff<K extends keyof GameBusEventMap> (
    eventName: K,
    handler: Handler<GameBusEventMap[K]>,
): void
{
    const set = listeners.get(eventName as string);
    if (!set)
    {
        return;
    }
    set.delete(handler as Handler<unknown>);
}

export function gameBusEmit<K extends keyof GameBusEventMap> (
    eventName: K,
    payload?: GameBusEventMap[K],
): void
{
    const set = listeners.get(eventName as string);
    if (!set || set.size === 0)
    {
        return;
    }
    // Copy so handlers can unsubscribe during emit.
    for (const handler of [...set])
    {
        (handler as Handler<GameBusEventMap[K]>)(payload as GameBusEventMap[K]);
    }
}

/** Drop all listeners (call on game stop / leave MainScene). */
export function gameBusClear (): void
{
    listeners.clear();
}
