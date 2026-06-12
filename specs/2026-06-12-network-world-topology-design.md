# Network World Topology — Design

Date: 2026-06-12
Status: approved

## Goal

Replace the hardcoded 5-computer world with a larger (~35-45 machines), zone-based network built by a hybrid system: hand-authored backbone + seeded procedural filler. This is the foundation for two later projects: living-world simulation and missions/economy.

## Scope

In scope:
- `src/world/` module: world types, backbone data, seeded generator, `buildWorld()` entry point.
- 4 zones gated by password-locked gateway machines.
- Global registry of all machines (for future simulation tick).
- Vitest setup with unit tests for the generator.

Out of scope (later projects):
- Living-world simulation (NPC traffic, changing files).
- Missions/economy.
- World persistence to IndexedDB (fixed seed makes the world deterministic; the existing `db.get("fs")` stub stays untouched).
- New commands or scan/probe changes.

## Decisions made

| Question | Decision |
|---|---|
| Authoring | Hybrid: hand-authored backbone + procedural filler |
| Scale | ~30-50 machines, 4 zones, 8-12 machines each |
| Zone gating | Gateway machines, password found in files of previous zone |
| Persistence | Fixed seed (`WORLD_SEED = 1337`), no save/load yet |
| Architecture | World builder module + registry (no manager refactor) |

## Data model (`src/world/worldTypes.ts`)

```ts
type ZoneDef = {
  id: string;                    // "home", "suburb", "corp", "datacenter"
  ipBase: string;                // "10.20.30" — machines get ipBase + "." + suffix
  fillerCount: [number, number]; // min/max procedural machines
  theme: ZoneTheme;              // name pools + file flavor pools
  keyMachines: KeyMachineDef[];  // hand-authored machines
};

type KeyMachineDef = {
  name: string;
  ipSuffix: number;
  password?: string;             // connect password (gateways are locked)
  passwordAuthUser?: string;
  passwordAuthAdmin?: string;
  files?: FileDef[];             // lore files, password hints
  gatewayTo?: string;            // zone id this machine bridges into
};

type FileDef = { name: string; content: string; authority?: Authority };

type ZoneTheme = {
  machineNames: string[];        // pool for filler machine names
  fileTemplates: FileTemplate[]; // notes, logs, mail fragments
};
```

The existing `Computer`, `Folder`, `MyFile` classes are unchanged. Zone information is used only at generation time; it is not stored on `Computer`.

## Backbone (`src/world/worldData.ts`)

Four zones, escalating difficulty:

1. **home** — player's machine plus a few neighbors. Tutorial flavor. All open.
2. **suburb** — mostly open machines; one file contains the corp gateway password.
3. **corp** — gateway locked; user/admin sub-passwords matter more; one file contains the datacenter gateway password.
4. **datacenter** — final zone; admin passwords required for the interesting files.

Each zone's backbone declares its gateway machine (`gatewayTo`), lore machines with hand-written files, and the hand-placed password hints for the next gateway.

## Generation (`src/world/worldGen.ts`)

- **RNG:** Mulberry32, seeded by `WORLD_SEED = 1337`. Same world every load.
- **Machines:** per zone, create key machines from defs, then a random count of filler machines within `fillerCount`. Names drawn from the zone theme pool, IP suffixes unique within the zone, ~30% of fillers password-locked, each filler gets 1-3 generic files from templates.
- **Links (intra-zone):** each filler links to 1-3 random machines of its zone via the existing bidirectional `withComputerLinked`. Key machines get more links (hubs). Generator verifies each zone's graph is connected.
- **Links (inter-zone):** only the gateway machine links to the next zone's entry machine. No other cross-zone edges.
- **Password reachability rule:** every locked machine's connect password must appear in at least one file on a machine reachable before it. The generator places filler passwords into files of already-generated reachable machines; gateway passwords are hand-placed in the backbone.
- **Entry point:** `buildWorld(): { owner: Computer; all: Computer[] }`. `owner` is the player's machine in zone `home`.

## Integration

- `FileSystemManager` constructor (currently `src/main.ts:63-87`): the hardcoded block is replaced by `const { owner, all } = buildWorld()`.
- The `all` array is stored on `FileSystemManager` (exposed via `getAllComputers()`, added to `I_FileSystemManager`) as the global machine registry. Nothing consumes it yet; it exists for the future simulation tick, which needs machines not reachable by graph traversal from the player.
- `scan`, `connect`, tab completion: no changes — they already operate on `computersLinked`.
- `src/computer/ComputerTest.ts`: deleted (obsolete, replaced by the world module).

## Testing

Add Vitest (no test runner exists today). Pure unit tests on the generator, no DOM:

- Deterministic: two `buildWorld()` calls produce identical worlds (names, IPs, links).
- All IPs unique across the world.
- Each zone's internal graph is connected.
- Every locked machine's password is findable in a file on a machine reachable before it (BFS from owner, treating locked machines as passable once their password has been seen).
- Gateways are the only inter-zone links.
- Total machine count within expected bounds.

## Error handling

- Generator throws at build time if backbone data is invalid (duplicate IPs, `gatewayTo` referencing an unknown zone, missing entry machine). Fail fast on load rather than producing a broken world.

## Follow-up projects (not this spec)

1. Living world: simulation tick using the `all` registry (NPC connections in logs, files changing).
2. Missions/economy: objectives over the generated world.
