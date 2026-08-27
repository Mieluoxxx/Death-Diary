# State Management

> How state is managed in this project.

---

## Overview

<!--
Document your project's state management conventions here.

Questions to answer:
- What state management solution do you use?
- How is local vs global state decided?
- How do you handle server state?
- What are the patterns for derived state?
-->

(To be filled by the team)

---

## State Categories

<!-- Local state, global state, server state, URL state -->

(To be filled by the team)

---

## When to Use Global State

<!-- Criteria for promoting state to global -->

(To be filled by the team)

---

## Server State

<!-- How server data is cached and synchronized -->

(To be filled by the team)

---

## Common Mistakes

<!-- State management mistakes your team has made -->

(To be filled by the team)

---

## NPC Inventory Boundary

### Scope / Trigger

Use this contract when one NPC action can consume items from more than one
player inventory or when a UI stages an exchange before confirmation.

### Signatures

- `giveNpcNeed(npcId: number, source: 'bag' | 'storage'): NpcActionResult`

### Contracts

- Active NPC meetings pass `bag`; NPC home visits pass `storage`.
- Callers must choose the source explicitly. Do not infer it from scene state
  or fall back to another inventory.
- Transaction drafts clone canonical inventories into UI-local maps. Canceling
  discards the maps; only a gameplay-system commit updates `SessionState`.

### Validation & Error Matrix

| Condition | Result |
|---|---|
| Selected source lacks the requested item | return `not_enough`; do not consume another source |
| Transaction page exits before commit | discard draft; canonical inventories remain unchanged |

### Good / Base / Bad Cases

- Good: `giveNpcNeed(npcId, 'bag')` from an active meeting.
- Base: `giveNpcNeed(npcId, 'storage')` from a home visit.
- Bad: `giveNpcNeed(npcId)` with an implicit or fallback source.

### Tests Required

- Assert bag/storage isolation in `src/game/systems/npcSystem.test.ts`.
- Assert draft cancellation in `e2e/e2e-npc-trade.md`.

### Wrong vs Correct
