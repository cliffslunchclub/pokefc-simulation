# PokéFC watched-match controls — MVP contract

Status: design defaults, not yet wired to a match UI or engine. Do not interpret this document as a tested TacticMesh capability.

## User controls
- Pause / resume watched playback.
- Playback selections: 1x (default), 2x, 4x. These are **requested playback rates**, not a promise of real-time simulation throughput.
- Open tactics panel and request formation, tactical preset and lineup changes. Changes must be validated by the match adapter before applying.
- Substitution panel: propose up to five substitutions in at most three regulation-time windows; halftime does not count as a window. Competition rules can override these defaults. An injury does not automatically grant extra substitutions.
- Quick Sim to End: explicit user action, never automatic on speed change. It simulates remaining regulation plus any competition-required extra time/penalties. Preserve current score, clock, possession, cards, injuries, substitutions, tactics, stamina and RNG continuity to the extent supported by both engines; unsupported state blocks handoff rather than silently resetting.
- Switching back from Quick Sim to watched mode is **not** an MVP feature. No arcade mode.

## Architecture
Keep three concepts distinct:
1. **Simulation throughput**: engine ticks per wall-clock second; subject to benchmarking.
2. **Playback speed**: presentation rate of already simulated snapshots/events; may buffer or fall behind.
3. **Quick Sim**: distinct simulation adapter that advances remaining match time.

Never alter simulation physics or random outcomes merely because the user selected 2x/4x playback. If playback is unable to keep pace, expose buffering or cap available speed rather than mislabeling performance.

## Determinism / saves
- Match seed and RNG state must be persisted with checkpoint and handoff metadata.
- Autosave at match start, halftime, after full-time, and before Quick Sim handoff. The final state must be committed atomically after Quick Sim.
- Quick Sim must not reroll completed events or rewind the clock.
- A saved match must record engine and rules versions so incompatible resumes can be detected.

## Competition-dependent settings (proposed, not locked)
- Regulation: 2 x 45 minutes.
- Extra time if competition requires: 2 x 15 minutes.
- Penalties if competition requires: five attempts per side, then sudden death.
- Weather: cosmetic in MVP; no untested physics modifiers.
- Injuries: enabled by default, frequency configurable later.
- Franchise fatigue: persistent, but recovery rates are pending design/testing.

## Acceptance checks before claiming implementation
- Pause/resume and 1x/2x/4x do not change the final result for the same seed and same decisions.
- Tactical changes and substitutions are applied exactly once at valid stoppages and survive saves.
- Quick Sim receives a complete, versioned checkpoint and continues from the correct time/score.
- Both adapters produce a consistent final match record; unsupported state is surfaced.
- Benchmarks confirm which playback speeds can actually be sustained.
