# Living World Simulation — Design

Date: 2026-06-12
Status: approved

## Goal

Make the generated network feel alive: persistent NPCs move between machines in real time, leave connection logs, and occasionally drop files. The player observes this through `scan`, a new `who` command, and a live HUD event feed. Pure ambiance — no mechanical effect on gameplay (missions/economy is a later project).

## Scope

In scope:
- `src/world/sim/` module: NPC types, seeded NPC roster generator, `Simulation` class with a real-time tick.
- NPC behaviors per tick: idle, move along existing links, append a log line, drop a themed file.
- Player visibility: `scan` session markers, new `who` command, HUD live event feed.
- Vitest unit tests on the pure tick logic (no timers).

Out of scope (later projects):
- NPCs reacting to the player (alerts, password changes).
- NPC-generated files containing gameplay-relevant info (passwords, hints).
- Missions/economy.
- Persistence of sim state (sim restarts fresh each page load, same as the world).

## Decisions made

| Question | Decision |
|---|---|
| Observable behaviors | NPC connection logs + files appearing/changing + visible live NPC activity |
| Time model | Real-time tick (`setInterval`, ~8s) while the game is open |
| NPC visibility | `scan` marker + `who` command + HUD live feed |
| NPC model | Persistent NPCs with identity and home machine |
| Gameplay impact | Ambiance only |
| Architecture | Dedicated `src/world/sim/` module, pure testable `tick()` |

## Data model (`src/world/sim/npcTypes.ts`)

```ts
type Npc = {
  id: string;        // "npc-home-0"
  name: string;      // French first name from pool
  homeIp: string;    // open machine of its zone
  zoneId: string;
};

type NpcSession = {
  npcId: string;
  npcName: string;   // denormalized for scan/who display
  machineIp: string; // where the NPC currently is
  sinceTick: number;
};

type SimEvent = {
  kind: "connect" | "disconnect" | "file";
  npcName: string;
  machineName: string;
  machineIp: string;
  zoneId: string;
  tick: number;
  text: string;      // human-readable line for the HUD feed
};
```

## NPC roster (`src/world/sim/npcGen.ts`)

- `generateNpcs(zones: ZoneResult[], rng: Rng): Npc[]`.
- 2-4 NPCs per zone, names from a French first-name pool (deduplicated; suffix on collision).
- Home machine: random machine of the zone with an empty connect password (open). Every zone has at least one open machine (entry machines are open; `home` zone has open fillers and the owner machine is excluded as an NPC home).
- Deterministic: seeded by `WORLD_SEED` via the existing Mulberry32 RNG.

## Simulation (`src/world/sim/simulation.ts`)

`Simulation` class:

- Constructor: `(zones: ZoneResult[], npcs: Npc[], rng: Rng)`. Builds IP→Computer and IP→zoneId maps and starts each NPC with a session on its home machine.
- `tick(): SimEvent[]` — pure, no timers. For each NPC, roll one action:
  - 60% idle — nothing.
  - 25% move — pick a random `computersLinked` neighbor of the current machine that is open (empty password); disconnect event + connect event; append a log line to both machines' `access.log`. No open neighbor: stay (counts as idle).
  - 10% log — append a flavor line to the current machine's `access.log` (e.g. `"[tick 42] claire@biblio-pc2: session active"`).
  - 5% file — drop a themed note/mail file on the current machine, named from the zone's file flavor with an NPC twist (e.g. `mail_claire_3.txt`).
- `access.log` capped at 20 lines, FIFO (oldest dropped). NPC-dropped files capped at 5 per machine; beyond that, overwrite the oldest NPC file.
- NPCs never enter password-locked machines (homes are always open by construction) — keeps logs coherent with the world's access rules. NPCs stay inside their zone (cross-zone moves blocked even via gateway links).
- `start(intervalMs = 8000)` / `stop()` — wraps `tick()` in `setInterval`. Each interval callback wraps the tick in try/catch: on error, `console.error` and keep running. Never throws into the game loop.
- `getSessions(): NpcSession[]` — current sessions, for `scan` and `who`.
- `onEvent(cb: (e: SimEvent) => void)` — subscription for the HUD feed.

## Player visibility

- **`scan` marker** (`src/commands/subCommands/scan.ts`): when a listed machine has an active NPC session, append `[user: <name>]` to its line. Multiple sessions: list all names.
- **`who` command** (new `src/commands/subCommands/who.ts`, registered in `commands.ts` + help): lists NPC sessions on the *current* machine — `claire    depuis tick 42`. Empty: `aucun utilisateur connecte.`
- **HUD live feed** (`src/hud.ts`): small panel showing the last 8 `SimEvent.text` lines, scrolling. Filtered to the player's **current zone** (zone of the machine the player is connected to) to avoid spoiling the whole map. Zone of the player's machine is resolved via a zoneId-by-IP map exposed by the sim.

## Integration (`src/main.ts`)

```
buildWorld() → generateNpcs(world.zones, rng) → new Simulation(world.all, npcs, rng) → sim.start()
```

- `FileSystemManager` (or a sibling singleton) holds the `Simulation` instance; commands access it the same way they access the file-system manager.
- `buildWorld()` already returns `zones` (`ZoneResult[]`) — the sim uses it for NPC generation and the zone filter; no world-module changes expected beyond exports.

## Testing

Vitest, pure unit tests, no timers — call `tick()` directly:

- Deterministic: same seed → same event sequence over N ticks.
- Sessions always on machines that are open or the NPC's home; never on a locked machine.
- Moves only follow `computersLinked` edges; never cross zones.
- `access.log` never exceeds 20 lines; NPC files never exceed 5 per machine.
- Events emitted match state changes (connect/disconnect pairs on moves).
- `generateNpcs`: 2-4 per zone, homes are open machines of the right zone, owner machine never an NPC home.

## Error handling

- Interval callback: try/catch around `tick()`; log and continue. A sim bug must never break the terminal.
- `generateNpcs` throws at build time if a zone has no eligible open home machine (fail fast, same philosophy as `worldGen` validation).

## Follow-up projects (not this spec)

1. Missions/economy: objectives over the living world (watch an NPC, intercept a file).
2. NPC reactions: detection, alerts, password rotation.
