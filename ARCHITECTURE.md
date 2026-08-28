# Death-Diary Architecture

## Runtime Shape

```text
src/main.ts
  -> session initialization (IndexedDB)
  -> Phaser Game (640x1136, Scale.FIT)
      -> Boot -> Preloader -> menu/story/home scenes
          -> HomeScene shell
              -> navigation host -> ui/nodes pages
                  -> systems -> SessionState + gameBus events

SessionState
  -> browserSave (IndexedDB, debounced)
  -> cloudSave (fetch, revision/conflict handling)
      -> server/src/app.ts (Hono API)
          -> server/src/db.ts (SQLite + migrations)
```

## Ownership

| Area | Owner | Rule |
|------|-------|------|
| Static gameplay data | `src/game/data/` | Read-only tables and lookup helpers; no session writes |
| Generated art metadata | `src/game/assets/` | `frames.gen.ts` and multiatlas output come from `bun run gen:frames` |
| Full-screen lifecycle | `src/game/scenes/` | Scene transitions, resource loading, shell setup and teardown |
| Canvas panels | `src/game/ui/` and `ui/nodes/` | Render/input code; call systems for gameplay effects |
| Gameplay rules | `src/game/systems/` | Mutate session, advance game time, emit typed events |
| Serializable run state | `src/game/session/sessionStore.ts` | `SessionState`, normalization, import/export, local persistence |
| Transient runtime state | systems module state | Timers, battles, craft jobs and progress jobs are cleared on scene exit |
| Cross-layer notifications | `src/game/systems/gameBus.ts` | Typed pub/sub only; not a second state store |
| Settings / cross-run progress | `settings/`, `medal/`, `iapStore` | Browser-local today; cloud progress/entitlements are deferred until a concrete client flow exists |
| Storage API | `server/src/` | Auth, save/progress endpoints, SQLite persistence and static serving |

## Save Boundary

`src/shared/saveContract.ts` owns the cloud-save envelope contract. The current
wire format is `schemaVersion=1` with `state.session` as an object. The
frontend still owns the rich `SessionState` model and normalization; the shared
module owns the version check and envelope shape so the client and server do
not drift independently.

Future save changes must add a migration at this boundary and retain loading
support for existing version 1 data.

## Navigation Flow

```text
MainMenu -> ChooseScene -> StoryScene -> HomeScene
HomeScene -> HomeNode / StorageNode / GateNode / MapNode / SiteNode
MapNode -> SiteNode -> BattleAndWorkNode -> WorkRoomStorageNode
player_died -> DeathScene
```

`Game.ts` and `GameOver.ts` are template-era placeholders. Keep them only if a
runtime or test reference is found; otherwise they can be removed in a
separate cleanup.

## Change Guidance

- Search for existing helpers before adding a new layer or utility.
- Keep gameplay duration on `timeClock`, not `setTimeout`.
- On Scene shutdown, stop the survival loop and clear transient jobs/listeners.
- Do not manually edit generated atlas files.
- Verify behavior with typecheck, tests, build, and browser checks for changed
  rendered flows.
