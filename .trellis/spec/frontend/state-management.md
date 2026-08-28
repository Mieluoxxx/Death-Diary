# State Management

## Scope / Trigger

The game has one active run and multiple Phaser Scenes. State ownership must
remain explicit when a change crosses UI, gameplay systems, IndexedDB, and the
cloud-save API.

## Signatures

- `getSession(): SessionState | null`
- `mutateSession(mutator: (session: SessionState) => void): SessionState`
- `setSession(session: SessionState): void`
- `markCloudSaveDirty(session: SessionState): void`
- `parseCloudSaveEnvelope<T>(value: unknown): CloudSaveEnvelope<T> | null`
- `giveNpcNeed(npcId: number, source: 'bag' | 'storage'): NpcActionResult`

## Contracts

- `SessionState` is the canonical serializable run state.
- Gameplay systems mutate it through `mutateSession`; the store schedules a
  debounced IndexedDB write and marks an authenticated cloud save dirty.
- `gameBus` is notification-only. It is not a second state store.
- UI-local state such as scroll offsets, open dialogs, and animation handles
  stays in the owning UI handle or Scene.
- Transaction drafts clone canonical inventories into UI-local maps. Canceling
  discards those maps; only a gameplay-system commit may update `SessionState`.
- When one action can consume from different inventories, the caller must pass
  the source explicitly. Active NPC meetings use `bag`; home visits use
  `storage`. Do not infer this from scene state or add a fallback source.
- Transient timer, battle, craft, and progress jobs do not enter `SessionState`.
- Cloud saves use `schemaVersion=1` and `{ state: { session: object } }`.

## Validation & Error Matrix

| Condition | Result |
|---|---|
| No active session | `getSession()` returns `null`; mutators throw |
| Valid cloud envelope v1 | shared parser returns a validated envelope |
| Unsupported cloud schema | parser returns `null`; API returns `unsupported_schema_version` |
| Missing/non-object `state.session` | parser returns `null`; API returns `invalid_save` |
| Cloud conflict | keep local/remote snapshots and require explicit resolution |
| Active NPC meeting lacks the requested bag item | return `not_enough`; do not consume home storage |
| Home NPC visit lacks the requested storage item | return `not_enough`; do not consume the carried bag item |
| Transaction page exits before commit | discard the draft; canonical inventories remain unchanged |

## Good / Base / Bad Cases

- Good: call a system API, let it call `mutateSession`, then emit a typed event.
- Good: call `giveNpcNeed(npcId, 'bag')` or `giveNpcNeed(npcId, 'storage')`
  according to the owning workflow.
- Base: read `getSession()` for a render refresh and derive display values.
- Bad: copy survival formulas into a UI callback or write directly to browser
  storage from a Scene.
- Bad: make a shared action silently choose an inventory or fall back from one
  inventory to another.

## Tests Required

- Assert schema v1 and malformed envelope parsing in `src/shared/saveContract.test.ts`.
- Assert timer/progress cleanup leaves no active job in
  `src/game/systems/timeClock.test.ts`.
- Assert cloud API status/error codes and revision conflict behavior in
  `server/src/app.test.ts`.
- Assert bag/storage source isolation and transactional commit behavior in
  `src/game/systems/npcSystem.test.ts`.
- Assert canceled UI drafts leave canonical inventories unchanged in the NPC
  Ego E2E card.

## Wrong vs Correct

### Wrong

```ts
localStorage.setItem('session', JSON.stringify(next));
gameBusEmit('session_updated');
```

For context-dependent inventory actions:

```ts
// Wrong: changing this implicit source fixes one workflow and breaks another.
giveNpcNeed(npcId);

// Correct: each workflow owns its inventory boundary.
giveNpcNeed(npcId, 'bag');
giveNpcNeed(npcId, 'storage');
```

### Correct

```ts
mutateSession((session) => {
    session.attrs.hp = nextHp;
});
gameBusEmit('session_updated');
```
