# Living World Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persistent NPCs move through the generated network in real time, leaving logs and files, visible via `scan` markers, a new `who` command, and a HUD live feed.

**Architecture:** New `src/world/sim/` module: `npcTypes.ts` (types), `npcGen.ts` (seeded roster), `simulation.ts` (`Simulation` class with pure `tick()` + `start/stop` timer wrapper). `Terminal` in `main.ts` builds the world once, passes it to `FileSystemManager` and the sim, and exposes the sim to commands via `CommandContext.sim`.

**Tech Stack:** Vanilla TypeScript, Vite, Vitest.

**Spec:** `specs/2026-06-12-living-world-sim-design.md`

**Note:** `docs/` is the Vite build output (GitHub Pages). Never hand-edit files there.

---

### Task 1: NPC types and roster generator

**Files:**
- Create: `src/world/sim/npcTypes.ts`
- Create: `src/world/sim/npcGen.ts`
- Test: `src/world/sim/npcGen.test.ts`

- [x] **Step 1: Write the types**

Create `src/world/sim/npcTypes.ts`:

```ts
export type Npc = {
  id: string;
  name: string;
  homeIp: string;
  zoneId: string;
};

export type NpcSession = {
  npcId: string;
  npcName: string;
  machineIp: string;
  sinceTick: number;
};

export type SimEvent = {
  kind: "connect" | "disconnect" | "file";
  npcName: string;
  machineName: string;
  machineIp: string;
  zoneId: string;
  tick: number;
  text: string;
};
```

- [x] **Step 2: Write the failing tests**

Create `src/world/sim/npcGen.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mulberry32 } from "../rng";
import { buildWorld } from "../worldGen";
import { generateNpcs } from "./npcGen";

describe("generateNpcs", () => {
  const world = buildWorld();

  it("creates 2-4 npcs per zone", () => {
    const npcs = generateNpcs(world.zones, world.owner, mulberry32(1));
    for (const zone of world.zones) {
      const count = npcs.filter((n) => n.zoneId === zone.id).length;
      expect(count).toBeGreaterThanOrEqual(2);
      expect(count).toBeLessThanOrEqual(4);
    }
  });

  it("homes are open machines of the npc's zone, never the owner", () => {
    const npcs = generateNpcs(world.zones, world.owner, mulberry32(1));
    for (const npc of npcs) {
      const zone = world.zones.find((z) => z.id === npc.zoneId)!;
      const home = zone.computers.find((c) => c.addressIp === npc.homeIp);
      expect(home).toBeDefined();
      expect(home!.password).toBe("");
      expect(home).not.toBe(world.owner);
    }
  });

  it("npc names are unique", () => {
    const npcs = generateNpcs(world.zones, world.owner, mulberry32(1));
    const names = npcs.map((n) => n.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("is deterministic for the same seed", () => {
    const a = generateNpcs(world.zones, world.owner, mulberry32(7));
    const b = generateNpcs(world.zones, world.owner, mulberry32(7));
    expect(a).toEqual(b);
  });
});
```

- [x] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/world/sim/npcGen.test.ts`
Expected: FAIL — cannot resolve `./npcGen`.

- [x] **Step 4: Write the generator**

Create `src/world/sim/npcGen.ts`:

```ts
import type { Computer } from "../../computer/Computer";
import { pick, randInt, type Rng } from "../rng";
import type { ZoneResult } from "../worldGen";
import type { Npc } from "./npcTypes";

const NPC_NAMES = [
  "claire", "hugo", "lea", "marc", "nina", "paul", "sara", "theo", "emma", "louis",
  "jade", "noah", "alice", "felix", "manon", "victor", "zoe", "adam", "ines", "gabin",
];

export function generateNpcs(zones: ZoneResult[], owner: Computer, rng: Rng): Npc[] {
  const npcs: Npc[] = [];
  const usedNames = new Set<string>();
  for (const zone of zones) {
    const homes = zone.computers.filter((c) => c.password === "" && c !== owner);
    if (homes.length === 0) throw new Error(`zone ${zone.id} has no open machine for npc homes`);
    const count = randInt(rng, 2, 4);
    for (let i = 0; i < count; i++) {
      let name = pick(rng, NPC_NAMES);
      while (usedNames.has(name)) name = `${pick(rng, NPC_NAMES)}${randInt(rng, 10, 99)}`;
      usedNames.add(name);
      const home = pick(rng, homes);
      npcs.push({ id: `npc-${zone.id}-${i}`, name, homeIp: home.addressIp, zoneId: zone.id });
    }
  }
  return npcs;
}
```

- [x] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/world/sim/npcGen.test.ts`
Expected: PASS (4 tests).

- [x] **Step 6: Commit**

```bash
git add src/world/sim/npcTypes.ts src/world/sim/npcGen.ts src/world/sim/npcGen.test.ts
git commit -m "feat(sim): seeded npc roster generator with open-machine homes"
```

---

### Task 2: Simulation class

**Files:**
- Create: `src/world/sim/simulation.ts`
- Test: `src/world/sim/simulation.test.ts`

- [x] **Step 1: Write the failing tests**

Create `src/world/sim/simulation.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { mulberry32 } from "../rng";
import { buildWorld } from "../worldGen";
import { generateNpcs } from "./npcGen";
import { Simulation } from "./simulation";
import type { SimEvent } from "./npcTypes";

function makeSim(seed = 7) {
  const world = buildWorld();
  const npcs = generateNpcs(world.zones, world.owner, mulberry32(seed));
  const sim = new Simulation(world.zones, npcs, mulberry32(seed + 1));
  return { world, npcs, sim };
}

describe("Simulation", () => {
  it("starts every npc on its home machine", () => {
    const { npcs, sim } = makeSim();
    const sessions = sim.getSessions();
    expect(sessions.length).toBe(npcs.length);
    for (const npc of npcs) {
      expect(sessions.find((s) => s.npcId === npc.id)!.machineIp).toBe(npc.homeIp);
    }
  });

  it("is deterministic for the same seed", () => {
    const a = makeSim(3);
    const b = makeSim(3);
    const eventsA: SimEvent[] = [];
    const eventsB: SimEvent[] = [];
    for (let i = 0; i < 50; i++) {
      eventsA.push(...a.sim.tick());
      eventsB.push(...b.sim.tick());
    }
    expect(eventsA).toEqual(eventsB);
  });

  it("sessions stay on open machines inside the npc's zone", () => {
    const { world, npcs, sim } = makeSim();
    const zoneOf = new Map<string, string>();
    for (const z of world.zones) for (const c of z.computers) zoneOf.set(c.addressIp, z.id);
    for (let i = 0; i < 200; i++) sim.tick();
    for (const s of sim.getSessions()) {
      const npc = npcs.find((n) => n.id === s.npcId)!;
      expect(zoneOf.get(s.machineIp)).toBe(npc.zoneId);
      const machine = world.all.find((c) => c.addressIp === s.machineIp)!;
      expect(machine.password).toBe("");
    }
  });

  it("moves only follow computersLinked edges", () => {
    const { world, sim } = makeSim();
    const byIp = new Map(world.all.map((c) => [c.addressIp, c]));
    for (let i = 0; i < 200; i++) {
      const events = sim.tick();
      for (let j = 0; j < events.length; j++) {
        const e = events[j];
        if (e.kind === "disconnect") {
          const next = events[j + 1];
          expect(next.kind).toBe("connect");
          expect(next.npcName).toBe(e.npcName);
          const from = byIp.get(e.machineIp)!;
          expect(from.computersLinked.some((c) => c.addressIp === next.machineIp)).toBe(true);
        }
      }
    }
  });

  it("caps access.log at 20 lines", () => {
    const { world, sim } = makeSim();
    for (let i = 0; i < 500; i++) sim.tick();
    let foundLog = false;
    for (const c of world.all) {
      const log = c.mainFolder.files?.find((f) => f.name === "access.log");
      if (log) {
        foundLog = true;
        expect(log.content.split("\n").length).toBeLessThanOrEqual(20);
      }
    }
    expect(foundLog).toBe(true);
  });

  it("caps npc-dropped files at 5 per machine", () => {
    const { world, sim } = makeSim();
    for (let i = 0; i < 500; i++) sim.tick();
    for (const c of world.all) {
      const npcFiles = c.mainFolder.files?.filter((f) => f.name.startsWith("note_")) ?? [];
      expect(npcFiles.length).toBeLessThanOrEqual(5);
    }
  });

  it("emits every returned event to subscribers", () => {
    const { sim } = makeSim();
    const seen: SimEvent[] = [];
    sim.onEvent((e) => seen.push(e));
    let returned = 0;
    for (let i = 0; i < 50; i++) returned += sim.tick().length;
    expect(returned).toBeGreaterThan(0);
    expect(seen.length).toBe(returned);
  });

  it("start ticks on an interval and stop halts it", () => {
    vi.useFakeTimers();
    const { sim } = makeSim();
    sim.start(1000);
    vi.advanceTimersByTime(3500);
    expect(sim.ticks).toBe(3);
    sim.stop();
    vi.advanceTimersByTime(3000);
    expect(sim.ticks).toBe(3);
    vi.useRealTimers();
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/world/sim/simulation.test.ts`
Expected: FAIL — cannot resolve `./simulation`.

- [x] **Step 3: Write the implementation**

Create `src/world/sim/simulation.ts`:

```ts
import type { Computer } from "../../computer/Computer";
import MyFile from "../../computer/elements/File";
import { pick, type Rng } from "../rng";
import type { ZoneResult } from "../worldGen";
import type { Npc, NpcSession, SimEvent } from "./npcTypes";

const LOG_FILE = "access.log";
const LOG_MAX_LINES = 20;
const NPC_FILES_MAX = 5;

const NOTE_PHRASES = [
  "rien a signaler aujourd'hui.",
  "penser a sauvegarder le dossier client.",
  "reunion deplacee a demain matin.",
  "le serveur a redemarre cette nuit, tout est revenu.",
  "rappel: changer les mots de passe le mois prochain.",
];

export class Simulation {
  private byIp = new Map<string, Computer>();
  private zoneByIp = new Map<string, string>();
  private sessions = new Map<string, NpcSession>();
  private npcs: Npc[];
  private rng: Rng;
  private tickCount = 0;
  private listeners: ((e: SimEvent) => void)[] = [];
  private npcFilesByIp = new Map<string, MyFile[]>();
  private intervalId: ReturnType<typeof setInterval> | undefined;

  constructor(zones: ZoneResult[], npcs: Npc[], rng: Rng) {
    this.npcs = npcs;
    this.rng = rng;
    for (const z of zones) {
      for (const c of z.computers) {
        this.byIp.set(c.addressIp, c);
        this.zoneByIp.set(c.addressIp, z.id);
      }
    }
    for (const npc of npcs) {
      this.sessions.set(npc.id, { npcId: npc.id, npcName: npc.name, machineIp: npc.homeIp, sinceTick: 0 });
    }
  }

  get ticks(): number {
    return this.tickCount;
  }

  getSessions(): NpcSession[] {
    return [...this.sessions.values()];
  }

  zoneIdOf(ip: string): string | undefined {
    return this.zoneByIp.get(ip);
  }

  onEvent(cb: (e: SimEvent) => void): void {
    this.listeners.push(cb);
  }

  start(intervalMs: number = 8000): void {
    if (this.intervalId !== undefined) return;
    this.intervalId = setInterval(() => {
      try {
        this.tick();
      } catch (err) {
        console.error("simulation tick failed", err);
      }
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  tick(): SimEvent[] {
    this.tickCount++;
    const events: SimEvent[] = [];
    for (const npc of this.npcs) {
      const roll = this.rng();
      if (roll < 0.6) continue;
      if (roll < 0.85) this.move(npc, events);
      else if (roll < 0.95) this.logActivity(npc);
      else this.dropFile(npc, events);
    }
    for (const e of events) for (const cb of this.listeners) cb(e);
    return events;
  }

  private currentMachine(npc: Npc): Computer {
    return this.byIp.get(this.sessions.get(npc.id)!.machineIp)!;
  }

  private move(npc: Npc, events: SimEvent[]): void {
    const from = this.currentMachine(npc);
    const candidates = from.computersLinked.filter(
      (c) => c.password === "" && this.zoneByIp.get(c.addressIp) === npc.zoneId
    );
    if (candidates.length === 0) return;
    const to = pick(this.rng, candidates);
    this.appendLog(from, `[t${this.tickCount}] ${npc.name}: deconnexion`);
    this.appendLog(to, `[t${this.tickCount}] ${npc.name}: connexion depuis ${from.addressIp}`);
    events.push(this.makeEvent("disconnect", npc, from, `${npc.name} quitte ${from.name}`));
    this.sessions.set(npc.id, { npcId: npc.id, npcName: npc.name, machineIp: to.addressIp, sinceTick: this.tickCount });
    events.push(this.makeEvent("connect", npc, to, `${npc.name} se connecte a ${to.name}`));
  }

  private logActivity(npc: Npc): void {
    this.appendLog(this.currentMachine(npc), `[t${this.tickCount}] ${npc.name}: session active`);
  }

  private dropFile(npc: Npc, events: SimEvent[]): void {
    const machine = this.currentMachine(npc);
    if (!machine.mainFolder.files) machine.mainFolder.files = [];
    const file = new MyFile(
      `note_${npc.name}_t${this.tickCount}.txt`,
      `${npc.name}, t${this.tickCount}: ${pick(this.rng, NOTE_PHRASES)}`
    );
    const owned = this.npcFilesByIp.get(machine.addressIp) ?? [];
    if (owned.length >= NPC_FILES_MAX) {
      const oldest = owned.shift()!;
      const idx = machine.mainFolder.files.indexOf(oldest);
      if (idx >= 0) machine.mainFolder.files.splice(idx, 1);
    }
    owned.push(file);
    this.npcFilesByIp.set(machine.addressIp, owned);
    machine.mainFolder.files.push(file);
    events.push(this.makeEvent("file", npc, machine, `${npc.name} ecrit ${file.name} sur ${machine.name}`));
  }

  private appendLog(machine: Computer, line: string): void {
    if (!machine.mainFolder.files) machine.mainFolder.files = [];
    let log = machine.mainFolder.files.find((f) => f.name === LOG_FILE);
    if (!log) {
      log = new MyFile(LOG_FILE, "");
      machine.mainFolder.files.push(log);
    }
    const lines = log.content === "" ? [] : log.content.split("\n");
    lines.push(line);
    while (lines.length > LOG_MAX_LINES) lines.shift();
    log.content = lines.join("\n");
  }

  private makeEvent(kind: SimEvent["kind"], npc: Npc, machine: Computer, text: string): SimEvent {
    return {
      kind,
      npcName: npc.name,
      machineName: machine.name,
      machineIp: machine.addressIp,
      zoneId: this.zoneByIp.get(machine.addressIp) ?? "",
      tick: this.tickCount,
      text,
    };
  }
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/world/sim/simulation.test.ts`
Expected: PASS (8 tests).

- [x] **Step 5: Commit**

```bash
git add src/world/sim/simulation.ts src/world/sim/simulation.test.ts
git commit -m "feat(sim): npc simulation with move/log/file ticks and capped writes"
```

---

### Task 3: Wire simulation into the game

**Files:**
- Modify: `src/types.ts`
- Modify: `src/main.ts`

- [x] **Step 1: Add I_Simulation to types**

In `src/types.ts`, add after the `import type { Folder }` line:

```ts
import type { NpcSession } from "./world/sim/npcTypes";
```

Add after the `I_NetworkManager` interface:

```ts
export interface I_Simulation {
  getSessions(): NpcSession[];
  zoneIdOf(ip: string): string | undefined;
}
```

In `CommandContext`, add after `db: I_DatabaseManager;`:

```ts
  sim: I_Simulation;
```

- [x] **Step 2: Pass the world into FileSystemManager**

In `src/main.ts`, change the `FileSystemManager` constructor (currently calls `buildWorld()` itself) to accept the world:

```ts
  constructor(world: World) {
    this.ownerComputer = world.owner;
    this.allComputers = world.all;
    this.currentComputer = this.ownerComputer;
    this.currentFolder = this.currentComputer.mainFolder;
  }
```

Update imports at the top of `src/main.ts`:

```ts
import { buildWorld, type World } from "./world/worldGen";
import { mulberry32 } from "./world/rng";
import { WORLD_SEED } from "./world/worldData";
import { generateNpcs } from "./world/sim/npcGen";
import { Simulation } from "./world/sim/simulation";
```

(`buildWorld` is already imported — extend that line with `type World`.)

Also add `I_Simulation` to the type-only import list from `./types`.

- [x] **Step 3: Build and start the sim in Terminal**

In the `Terminal` class, add a field after `private network: I_NetworkManager;`:

```ts
  private sim: Simulation;
```

In the `Terminal` constructor, replace `this.fs = new FileSystemManager();` with:

```ts
    const world = buildWorld();
    this.fs = new FileSystemManager(world);
    const simRng = mulberry32(WORLD_SEED + 1);
    this.sim = new Simulation(world.zones, generateNpcs(world.zones, world.owner, simRng), simRng);
    this.sim.start();
```

In `executeCommand`, add to the `context` object after `db: this.db,`:

```ts
        sim: this.sim,
```

- [x] **Step 4: Type-check and test**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors, all tests pass.

- [x] **Step 5: Commit**

```bash
git add src/types.ts src/main.ts
git commit -m "feat(sim): run npc simulation in the game and expose it to commands"
```

---

### Task 4: Player visibility — who command and scan markers

**Files:**
- Create: `src/commands/subCommands/who.ts`
- Modify: `src/commands/commands.ts`
- Modify: `src/commands/subCommands/help.ts`
- Modify: `src/commands/subCommands/scan.ts:15-27`

- [x] **Step 1: Write the who command**

Create `src/commands/subCommands/who.ts`:

```ts
import type { Command } from "../../types";

export const who: Command = async (_args, context) => {
  const ip = context.fs.getCurrentComputer().addressIp;
  const sessions = context.sim.getSessions().filter((s) => s.machineIp === ip);
  if (sessions.length === 0) {
    context.ui.writeLine("aucun utilisateur connecte.");
    return;
  }
  for (const s of sessions) {
    context.ui.writeLine(`${s.npcName.padEnd(12)} depuis tick ${s.sinceTick}`);
  }
};
```

- [x] **Step 2: Register it**

In `src/commands/commands.ts`, add the import:

```ts
import { who } from "./subCommands/who";
```

And add `who,` to the `commands` record (after `whoami,`).

- [x] **Step 3: Update help**

In `src/commands/subCommands/help.ts`, add `who` to the command list line (after `whoami`) and add `who` usage to the examples line:

```ts
    context.ui.writeLine("Commandes: help, ls, cat, pwd, cd, echo, scan, connect, disconnect, rm, changeAuth, run, mem, clear, whoami, who, save, load, reset");
    context.ui.writeLine("Ex: ls, cat readme.txt, cd /home, scan, connect <1.2.0.7> <name> <?password>, changeAuth <admin | user | guest> <?password>, run tracer, who (sessions sur la machine), save/load fs (IndexedDB)");
```

- [x] **Step 4: Add session markers to scan**

In `src/commands/subCommands/scan.ts`, inside the `for (const computer of computersLinked)` loop, before the `context.ui.writeClickableLine(` call, add:

```ts
      const sessions = context.sim.getSessions().filter(s => s.machineIp === computer.addressIp);
      const userMark = sessions.length > 0 ? `  [user: ${sessions.map(s => s.npcName).join(",")}]` : "";
```

And change the first argument of `writeClickableLine` to end with `${userMark}`:

```ts
        `${`[${index}]`.padEnd(indexWidth + 2)}${computer.addressIp.padEnd(17)}${computer.name.padEnd(nameWidth + 2)}auth: ${(computer.password ? "LOCKED" : "OPEN").padEnd(8)}links: ${computer.computersLinked.length}${userMark}`,
```

- [x] **Step 5: Type-check and test**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors, all tests pass.

- [x] **Step 6: Manual smoke test**

Run: `npm run dev`, open the URL, then in the game terminal:
- `who` → `aucun utilisateur connecte.` (NPCs rarely sit on wax) or a name list
- `scan` → some neighbor lines eventually show `[user: <name>]` (wait a few ticks, re-scan)
- `connect` to an open neighbor, `ls` → after a while an `access.log` may appear; `cat access.log` shows NPC lines
Expected: no console errors. Stop dev server.

- [x] **Step 7: Commit**

```bash
git add src/commands/subCommands/who.ts src/commands/commands.ts src/commands/subCommands/help.ts src/commands/subCommands/scan.ts
git commit -m "feat(sim): who command and npc session markers in scan"
```

---

### Task 5: HUD live feed

**Files:**
- Modify: `index.html:438-446`
- Modify: `src/hud.ts`
- Modify: `src/main.ts` (Terminal constructor)

- [x] **Step 1: Add the NET FEED panel**

In `index.html`, inside `<aside class="sidebar">`, add a new sideBox right before the `SYS LOG` box (reuses the `.syslog` CSS class):

```html
        <div class="sideBox">
          <div class="sideTitle">NET FEED</div>
          <div class="syslog" id="netfeed"></div>
        </div>
```

- [x] **Step 2: Add the feed writer to hud.ts**

In `src/hud.ts`, add at the end of the file:

```ts
const NETFEED_MAX_LINES = 8;

export function pushNetFeedLine(text: string): void {
  const el = document.getElementById("netfeed");
  if (!el) return;
  const line = document.createElement("div");
  line.textContent = `[${new Date().toTimeString().slice(0, 8)}] ${text}`;
  el.appendChild(line);
  while (el.children.length > NETFEED_MAX_LINES) {
    el.removeChild(el.firstChild!);
  }
}
```

- [x] **Step 3: Subscribe in Terminal**

In `src/main.ts`, update the hud import:

```ts
import { startHud, pushNetFeedLine } from "./hud";
```

In the `Terminal` constructor, right before `this.sim.start();`, add:

```ts
    this.sim.onEvent((e) => {
      if (e.zoneId === this.sim.zoneIdOf(this.fs.getCurrentComputer().addressIp)) {
        pushNetFeedLine(e.text);
      }
    });
```

- [x] **Step 4: Type-check and test**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors, all tests pass.

- [x] **Step 5: Manual smoke test**

Run: `npm run dev`, open the URL. Within ~30s the NET FEED panel shows lines like `claire se connecte a bob-pc` (home zone only). `connect` to `gw-home` with `quartier-libre` — feed switches to suburb events.
Expected: feed capped at 8 lines, no console errors. Stop dev server.

- [x] **Step 6: Commit**

```bash
git add index.html src/hud.ts src/main.ts
git commit -m "feat(sim): live net feed panel filtered to the player's zone"
```

---

### Task 6: Build and deploy

**Files:**
- Modify: `docs/` (generated by Vite — do not hand-edit)

- [x] **Step 1: Production build**

Run: `npm run build`
Expected: `tsc` clean, Vite writes to `docs/`.

- [x] **Step 2: Commit and push**

```bash
git add docs plans/2026-06-12-living-world-sim.md
git commit -m "feat: deploy living world simulation"
git push
```

- [x] **Step 3: Verify deploy**

After GitHub Pages rebuild (~1 min), open `https://maximemoya.github.io/game-my-hacknet-proto/` — NET FEED panel animates, `who`/`scan` show NPC presence.
