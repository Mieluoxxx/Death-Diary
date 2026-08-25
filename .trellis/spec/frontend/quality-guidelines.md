# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

The frontend is a Phaser game whose persistent session, game clock, event bus, and canvas UI form one observable behavior. A change is not verified by final state alone when the user experiences a transition over time.

---

## Forbidden Patterns

- Do not restart an active tween when a broad refresh submits the same target value. Track the animation target separately from the currently displayed value.
- Do not treat domain-event assertions as sufficient coverage for a canvas animation bug.
- Do not copy survival formulas into facility or UI callbacks; `survivalLoop.ts` owns hourly survival rules.

---

## Required Patterns

- Separate the source value, displayed value, and in-flight target for time-based UI transitions.
- Make unrelated high-frequency events idempotent for each animated component.
- When matching the original game, inspect the original event-to-view contract as well as the numeric formula.

---

## Testing Requirements

- Time-based regressions must assert at least one intermediate state or lifecycle event before completion.
- Animation tests must fail when same-target deduplication is removed; final-value-only assertions are insufficient.
- Shared clock changes require coverage for repeated and one-shot callbacks, priority, callback mutation, and large time-step catch-up.
- Browser verification remains required for the rendered canvas path after unit/integration tests pass.

---

## Code Review Checklist

- Does the test observe the layer named in the user report, or only an upstream state change?
- Can a broad `time_tick` / `session_updated` refresh restart or cancel an unrelated animation?
- Are callback targets and displayed values represented separately where they can diverge?
- Were original-game parity claims checked against the corresponding original UI and timer code?
