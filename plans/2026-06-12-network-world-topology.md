# Network World Topology Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded 5-computer world with a ~35-45 machine, 4-zone network built from a hand-authored backbone plus seeded procedural filler.

**Architecture:** New `src/world/` module: `worldTypes.ts` (declarative types), `worldData.ts` (backbone: 4 zones, gateways, lore files), `rng.ts` (seeded Mulberry32), `worldGen.ts` (`buildWorld()` returning owner + global registry). `FileSystemManager` in `main.ts` consumes `buildWorld()`. Existing `Computer`/`Folder`/`MyFile` classes and all commands unchanged.

**Tech Stack:** Vanilla TypeScript, Vite, Vitest (new dev dependency).

**Spec:** `specs/2026-06-12-network-world-topology-design.md`

**Note:** `docs/` is the Vite build output (GitHub Pages). Never hand-edit files there.

---

### Task 1: Vitest setup

**Files:**
- Modify: `package.json`

- [x] **Step 1: Install vitest**

Run: `npm i -D vitest`
Expected: added to `devDependencies`, no errors.

- [x] **Step 2: Add test script**

In `package.json` `"scripts"`, add:

```json
"test": "vitest run"
```

- [x] **Step 3: Verify runner works**

Run: `npx vitest run`
Expected: exits with "No test files found" (non-zero exit is fine at this point).

- [x] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add vitest"
```

---

### Task 2: Seeded RNG

**Files:**
- Create: `src/world/rng.ts`
- Test: `src/world/rng.test.ts`

- [x] **Step 1: Write the failing test**

Create `src/world/rng.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mulberry32, pick, randInt } from "./rng";

describe("mulberry32", () => {
  it("is deterministic for the same seed", () => {
    const a = mulberry32(1337);
    const b = mulberry32(1337);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it("produces values in [0, 1)", () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("differs across seeds", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe("helpers", () => {
  it("randInt stays within inclusive bounds", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = randInt(rng, 2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
    }
  });

  it("pick returns an element of the array", () => {
    const rng = mulberry32(7);
    const arr = ["a", "b", "c"];
    for (let i = 0; i < 100; i++) expect(arr).toContain(pick(rng, arr));
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/world/rng.test.ts`
Expected: FAIL — cannot resolve `./rng`.

- [x] **Step 3: Write implementation**

Create `src/world/rng.ts`:

```ts
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: Rng, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/world/rng.test.ts`
Expected: PASS (5 tests).

- [x] **Step 5: Commit**

```bash
git add src/world/rng.ts src/world/rng.test.ts
git commit -m "feat(world): seeded mulberry32 rng with pick/randInt helpers"
```

---

### Task 3: World types

**Files:**
- Create: `src/world/worldTypes.ts`

- [x] **Step 1: Write the types**

Create `src/world/worldTypes.ts`:

```ts
import type { Authority } from "../computer/authority/Authority";

export type FileDef = { name: string; content: string; authority?: Authority };

export type FolderDef = {
  name: string;
  authority?: Authority;
  files?: FileDef[];
};

export type KeyMachineDef = {
  name: string;
  ipSuffix: number;
  password?: string;
  passwordAuthUser?: string;
  passwordAuthAdmin?: string;
  files?: FileDef[];
  folders?: FolderDef[];
  gatewayTo?: string;
  entry?: boolean;
  owner?: boolean;
};

export type ZoneTheme = {
  machineNames: string[];
  fileTemplates: { name: string; content: string }[];
};

export type ZoneDef = {
  id: string;
  ipBase: string;
  fillerCount: [number, number];
  theme: ZoneTheme;
  keyMachines: KeyMachineDef[];
};
```

- [x] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [x] **Step 3: Commit**

```bash
git add src/world/worldTypes.ts
git commit -m "feat(world): zone and machine definition types"
```

---

### Task 4: Backbone data

**Files:**
- Create: `src/world/worldData.ts`

- [x] **Step 1: Write the backbone**

Create `src/world/worldData.ts`. Four zones: home → suburb → corp → datacenter. Gateway passwords are hand-placed in files of the previous zone. The vault's connect password is hand-placed in `dc-entry`.

```ts
import type { ZoneDef } from "./worldTypes";

export const WORLD_SEED = 1337;

export const ZONES: ZoneDef[] = [
  {
    id: "home",
    ipBase: "192.168.0",
    fillerCount: [4, 6],
    theme: {
      machineNames: ["bob-pc", "fry-box", "mey-laptop", "dan-srv", "printer", "nas-box", "cam-front", "pi-zero"],
      fileTemplates: [
        { name: "notes.txt", content: "penser a changer le mot de passe du wifi" },
        { name: "todo.txt", content: "acheter cable ethernet\nsauvegarder les photos" },
        { name: "boot.log", content: "[OK] system started\n[OK] network up" },
      ],
    },
    keyMachines: [
      {
        name: "wax",
        ipSuffix: 42,
        owner: true,
        password: "wax",
        passwordAuthUser: "user",
        passwordAuthAdmin: "admin",
        files: [
          { name: "f1admin.txt", content: "le contenu du fichier admin", authority: "admin" },
          { name: "f1user.txt", content: "le contenu du fichier user", authority: "user" },
          { name: "f1guest.txt", content: "le contenu du fichier guest", authority: "guest" },
          { name: "readme_network.txt", content: "memo: le routeur du quartier 'gw-home' (192.168.0.1) accepte le mot de passe 'quartier-libre'. de la, on atteint le reseau du quartier." },
        ],
        folders: [
          {
            name: "intro",
            files: [
              { name: "readme.txt", content: "un nouveau contenu" },
              { name: "secret.txt", content: "code Bob => bob", authority: "admin" },
            ],
          },
          { name: "folderAdmin", authority: "admin" },
          { name: "folderUser", authority: "user" },
          { name: "folderGuest", authority: "guest" },
        ],
      },
      {
        name: "gw-home",
        ipSuffix: 1,
        password: "quartier-libre",
        gatewayTo: "suburb",
        files: [{ name: "routes.cfg", content: "uplink => 10.20.30.1 (cafe-router)" }],
      },
    ],
  },
  {
    id: "suburb",
    ipBase: "10.20.30",
    fillerCount: [7, 9],
    theme: {
      machineNames: ["biblio-pc1", "biblio-pc2", "shop-pos", "kiosk", "school-lab", "mairie-srv", "garage-pc", "radio-node", "atm-04", "cyber-cafe"],
      fileTemplates: [
        { name: "mail.txt", content: "re: reunion de quartier jeudi 18h, salle B" },
        { name: "caisse.log", content: "ticket #2231 ... 12.50 EUR\nticket #2232 ... 4.00 EUR" },
        { name: "agenda.txt", content: "lundi: livraison\nmardi: inventaire" },
      ],
    },
    keyMachines: [
      {
        name: "cafe-router",
        ipSuffix: 1,
        entry: true,
        files: [{ name: "welcome.txt", content: "hotspot du cafe - usage public" }],
      },
      {
        name: "biblio-srv",
        ipSuffix: 10,
        files: [
          { name: "mail_admin.txt", content: "IT: la passerelle AuroraCorp 'corp-uplink' (10.20.30.254) a ete reconfiguree, mot de passe 'aurora-gate-7'. merci de ne pas diffuser." },
        ],
      },
      {
        name: "corp-uplink",
        ipSuffix: 254,
        password: "aurora-gate-7",
        gatewayTo: "corp",
        files: [{ name: "uplink.cfg", content: "tunnel => 172.16.40.1 (aur-entry)" }],
      },
    ],
  },
  {
    id: "corp",
    ipBase: "172.16.40",
    fillerCount: [7, 9],
    theme: {
      machineNames: ["aur-ws-01", "aur-ws-02", "aur-ws-03", "aur-print", "aur-mail2", "aur-build", "aur-hr", "aur-dev1", "aur-dev2", "aur-backup"],
      fileTemplates: [
        { name: "standup.txt", content: "hier: refacto module paie\naujourd'hui: revue de code" },
        { name: "build.log", content: "[BUILD] aurora-core v2.4.1 ... OK (312s)" },
        { name: "memo_rh.txt", content: "rappel: badges obligatoires en zone serveur" },
      ],
    },
    keyMachines: [
      {
        name: "aur-entry",
        ipSuffix: 1,
        entry: true,
        files: [{ name: "motd.txt", content: "AuroraCorp - acces reserve au personnel" }],
      },
      {
        name: "aur-mail",
        ipSuffix: 25,
        files: [
          { name: "ticket_4112.txt", content: "ticket #4112: acces datacenter Helios via 'dc-uplink' (172.16.40.254). mot de passe temporaire 'helios-cooling-9', a changer avant vendredi." },
          { name: "direction.txt", content: "note interne direction: le projet Obsidian est confidentiel.", authority: "admin" },
        ],
      },
      {
        name: "dc-uplink",
        ipSuffix: 254,
        password: "helios-cooling-9",
        gatewayTo: "datacenter",
        files: [{ name: "uplink.cfg", content: "tunnel => 10.99.0.1 (dc-entry)" }],
      },
    ],
  },
  {
    id: "datacenter",
    ipBase: "10.99.0",
    fillerCount: [6, 8],
    theme: {
      machineNames: ["dc-rack-a1", "dc-rack-a2", "dc-rack-b1", "dc-cool-ctl", "dc-power-ctl", "dc-mon", "dc-tape", "dc-fw"],
      fileTemplates: [
        { name: "sensors.log", content: "temp rack A: 21.4C\ntemp rack B: 22.1C" },
        { name: "uptime.log", content: "up 412 days, load 0.42" },
        { name: "maint.txt", content: "maintenance planifiee dimanche 03:00" },
      ],
    },
    keyMachines: [
      {
        name: "dc-entry",
        ipSuffix: 1,
        entry: true,
        files: [
          { name: "motd.txt", content: "Helios Datacenter - zone restreinte" },
          { name: "maint_note.txt", content: "pour la maintenance du coffre 'dc-vault' (10.99.0.99): mot de passe 'obsidian'" },
        ],
      },
      {
        name: "dc-vault",
        ipSuffix: 99,
        password: "obsidian",
        passwordAuthAdmin: "root-obsidian",
        files: [
          { name: "vault_readme.txt", content: "coffre numerique - acces admin requis pour le contenu" },
          { name: "obsidian.dat", content: "PROJET OBSIDIAN - vous avez atteint le bout du reseau. felicitations.", authority: "admin" },
        ],
      },
    ],
  },
];
```

- [x] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [x] **Step 3: Commit**

```bash
git add src/world/worldData.ts
git commit -m "feat(world): 4-zone backbone data with gateways and lore"
```

---

### Task 5: Generator — machines and registry

**Files:**
- Create: `src/world/worldGen.ts`
- Test: `src/world/worldGen.test.ts`

- [x] **Step 1: Write the failing tests**

Create `src/world/worldGen.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildWorld } from "./worldGen";
import { ZONES } from "./worldData";
import type { Computer } from "../computer/Computer";

function fingerprint(all: Computer[]): string {
  return all
    .map(
      (c) =>
        `${c.addressIp}|${c.name}|${c.password}|` +
        `${c.computersLinked.map((l) => l.addressIp).sort().join(",")}|` +
        `${(c.mainFolder.files ?? []).map((f) => f.name).sort().join(",")}`
    )
    .sort()
    .join("\n");
}

describe("buildWorld machines", () => {
  it("is deterministic for the same seed", () => {
    expect(fingerprint(buildWorld(1337).all)).toBe(fingerprint(buildWorld(1337).all));
  });

  it("has unique IPs across the world", () => {
    const { all } = buildWorld();
    const ips = all.map((c) => c.addressIp);
    expect(new Set(ips).size).toBe(ips.length);
  });

  it("returns the owner machine wax", () => {
    const { owner } = buildWorld();
    expect(owner.name).toBe("wax");
    expect(owner.addressIp).toBe("192.168.0.42");
  });

  it("total machine count within expected bounds", () => {
    const { all } = buildWorld();
    const keyCount = ZONES.reduce((n, z) => n + z.keyMachines.length, 0);
    const minFiller = ZONES.reduce((n, z) => n + z.fillerCount[0], 0);
    const maxFiller = ZONES.reduce((n, z) => n + z.fillerCount[1], 0);
    expect(all.length).toBeGreaterThanOrEqual(keyCount + minFiller);
    expect(all.length).toBeLessThanOrEqual(keyCount + maxFiller);
  });

  it("every machine has a main folder", () => {
    const { all } = buildWorld();
    for (const c of all) expect(c.mainFolder.name).toBe("main");
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/world/worldGen.test.ts`
Expected: FAIL — cannot resolve `./worldGen`.

- [x] **Step 3: Write the generator (machines, no links yet)**

Create `src/world/worldGen.ts`:

```ts
import { Computer } from "../computer/Computer";
import MyFile from "../computer/elements/File";
import { Folder } from "../computer/elements/Folder";
import { mulberry32, pick, randInt, type Rng } from "./rng";
import { WORLD_SEED, ZONES } from "./worldData";
import type { KeyMachineDef, ZoneDef } from "./worldTypes";

export type ZoneResult = { id: string; computers: Computer[] };
export type World = { owner: Computer; all: Computer[]; zones: ZoneResult[] };

const PASSWORD_WORDS = ["lune", "tigre", "pixel", "nuage", "fer", "echo", "lotus", "orage"];

function validate(zones: ZoneDef[]): void {
  const ids = new Set(zones.map((z) => z.id));
  if (ids.size !== zones.length) throw new Error("duplicate zone id");
  for (const z of zones) {
    const suffixes = new Set(z.keyMachines.map((k) => k.ipSuffix));
    if (suffixes.size !== z.keyMachines.length) throw new Error(`duplicate ipSuffix in zone ${z.id}`);
    for (const k of z.keyMachines) {
      if (k.gatewayTo && !ids.has(k.gatewayTo)) throw new Error(`gatewayTo unknown zone: ${k.gatewayTo}`);
    }
  }
  for (const z of zones.slice(1)) {
    if (!z.keyMachines.some((k) => k.entry)) throw new Error(`zone ${z.id} has no entry machine`);
  }
  const owners = zones.flatMap((z) => z.keyMachines.filter((k) => k.owner));
  if (owners.length !== 1) throw new Error(`expected exactly 1 owner machine, got ${owners.length}`);
}

function buildKeyComputer(z: ZoneDef, def: KeyMachineDef): Computer {
  const c = new Computer(`${z.ipBase}.${def.ipSuffix}`, def.name, def.password);
  if (def.passwordAuthUser) c.withPasswordAuthUser(def.passwordAuthUser);
  if (def.passwordAuthAdmin) c.withPasswordAuthAdmin(def.passwordAuthAdmin);
  const main = new Folder("main");
  if (def.files?.length) main.withFiles(def.files.map((f) => new MyFile(f.name, f.content, f.authority)));
  for (const fo of def.folders ?? []) {
    const child = new Folder(fo.name, fo.authority);
    if (fo.files?.length) child.withFiles(fo.files.map((f) => new MyFile(f.name, f.content, f.authority)));
    main.withChildFolder(child);
  }
  c.withMainFolder(main);
  return c;
}

function buildFillerComputer(
  z: ZoneDef,
  rng: Rng,
  usedSuffixes: Set<number>,
  usedNames: Set<string>,
  index: number
): { computer: Computer; password: string } {
  let suffix = randInt(rng, 2, 250);
  while (usedSuffixes.has(suffix)) suffix = randInt(rng, 2, 250);
  usedSuffixes.add(suffix);

  let name = pick(rng, z.theme.machineNames);
  if (usedNames.has(name)) name = `${name}-${index}`;
  usedNames.add(name);

  const locked = rng() < 0.3;
  const password = locked ? `${pick(rng, PASSWORD_WORDS)}${randInt(rng, 10, 99)}` : "";

  const c = new Computer(`${z.ipBase}.${suffix}`, name, password || undefined);
  const files: MyFile[] = [];
  const usedFileNames = new Set<string>();
  const fileCount = randInt(rng, 1, 3);
  for (let f = 0; f < fileCount; f++) {
    const t = pick(rng, z.theme.fileTemplates);
    if (usedFileNames.has(t.name)) continue;
    usedFileNames.add(t.name);
    files.push(new MyFile(t.name, t.content));
  }
  c.withMainFolder(new Folder("main").withFiles(files));
  return { computer: c, password };
}

export function buildWorld(seed: number = WORLD_SEED): World {
  validate(ZONES);
  const rng = mulberry32(seed);
  const zoneResults: ZoneResult[] = [];
  let owner: Computer | undefined;

  for (const z of ZONES) {
    const computers: Computer[] = [];
    const usedSuffixes = new Set<number>(z.keyMachines.map((k) => k.ipSuffix));
    const usedNames = new Set<string>(z.keyMachines.map((k) => k.name));

    for (const def of z.keyMachines) {
      const c = buildKeyComputer(z, def);
      computers.push(c);
      if (def.owner) owner = c;
    }

    const fillerTotal = randInt(rng, z.fillerCount[0], z.fillerCount[1]);
    for (let i = 0; i < fillerTotal; i++) {
      const made = buildFillerComputer(z, rng, usedSuffixes, usedNames, i);
      computers.push(made.computer);
    }

    zoneResults.push({ id: z.id, computers });
  }

  if (!owner) throw new Error("no owner machine defined");
  return { owner, all: zoneResults.flatMap((zr) => zr.computers), zones: zoneResults };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/world/worldGen.test.ts`
Expected: PASS (5 tests).

- [x] **Step 5: Commit**

```bash
git add src/world/worldGen.ts src/world/worldGen.test.ts
git commit -m "feat(world): generator builds zone machines from backbone + seeded filler"
```

---

### Task 6: Generator — links (intra-zone + gateways)

**Files:**
- Modify: `src/world/worldGen.ts`
- Test: `src/world/worldGen.test.ts`

- [x] **Step 1: Write the failing tests**

Append to `src/world/worldGen.test.ts`:

```ts
describe("buildWorld links", () => {
  it("each zone's internal graph is connected", () => {
    const { zones } = buildWorld();
    for (const zone of zones) {
      const members = new Set(zone.computers);
      const visited = new Set<Computer>([zone.computers[0]]);
      const queue = [zone.computers[0]];
      while (queue.length) {
        const c = queue.shift()!;
        for (const l of c.computersLinked) {
          if (members.has(l) && !visited.has(l)) {
            visited.add(l);
            queue.push(l);
          }
        }
      }
      expect(visited.size).toBe(zone.computers.length);
    }
  });

  it("gateways are the only inter-zone links", () => {
    const { zones } = buildWorld();
    const zoneOf = new Map<string, string>();
    for (const zone of zones) for (const c of zone.computers) zoneOf.set(c.addressIp, zone.id);

    const allowedCross = new Set<string>();
    for (const z of ZONES) {
      for (const k of z.keyMachines) {
        if (!k.gatewayTo) continue;
        const target = ZONES.find((t) => t.id === k.gatewayTo)!;
        const entry = target.keyMachines.find((m) => m.entry)!;
        const gwIp = `${z.ipBase}.${k.ipSuffix}`;
        const entryIp = `${target.ipBase}.${entry.ipSuffix}`;
        allowedCross.add(`${gwIp}>${entryIp}`);
        allowedCross.add(`${entryIp}>${gwIp}`);
      }
    }

    for (const zone of zones) {
      for (const c of zone.computers) {
        for (const l of c.computersLinked) {
          if (zoneOf.get(l.addressIp) !== zone.id) {
            expect(allowedCross.has(`${c.addressIp}>${l.addressIp}`)).toBe(true);
          }
        }
      }
    }
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/world/worldGen.test.ts`
Expected: FAIL — connectivity test fails (no links yet, visited.size === 1).

- [x] **Step 3: Add linking to `buildWorld`**

In `src/world/worldGen.ts`, replace the `for (const z of ZONES) { ... }` loop body and the code after it. The zone loop gains intra-zone linking, and gateways are tracked then wired after all zones exist:

```ts
  const gatewayLinks: { computer: Computer; to: string }[] = [];
  const entryByZone = new Map<string, Computer>();

  for (const z of ZONES) {
    const computers: Computer[] = [];
    const usedSuffixes = new Set<number>(z.keyMachines.map((k) => k.ipSuffix));
    const usedNames = new Set<string>(z.keyMachines.map((k) => k.name));

    for (const def of z.keyMachines) {
      const c = buildKeyComputer(z, def);
      computers.push(c);
      if (def.owner) owner = c;
      if (def.entry) entryByZone.set(z.id, c);
      if (def.gatewayTo) gatewayLinks.push({ computer: c, to: def.gatewayTo });
    }

    const fillerTotal = randInt(rng, z.fillerCount[0], z.fillerCount[1]);
    for (let i = 0; i < fillerTotal; i++) {
      const made = buildFillerComputer(z, rng, usedSuffixes, usedNames, i);
      computers.push(made.computer);
    }

    // spanning chain guarantees connectivity, extra edges add mesh feel
    for (let i = 1; i < computers.length; i++) {
      computers[i].withComputerLinked(computers[randInt(rng, 0, i - 1)]);
    }
    for (const c of computers) {
      const extra = randInt(rng, 0, 2);
      for (let e = 0; e < extra; e++) {
        const other = pick(rng, computers);
        if (other !== c) c.withComputerLinked(other);
      }
    }

    zoneResults.push({ id: z.id, computers });
  }

  for (const gw of gatewayLinks) {
    const entry = entryByZone.get(gw.to);
    if (!entry) throw new Error(`zone ${gw.to} has no entry machine for gateway link`);
    gw.computer.withComputerLinked(entry);
  }
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/world/worldGen.test.ts`
Expected: PASS (7 tests).

- [x] **Step 5: Commit**

```bash
git add src/world/worldGen.ts src/world/worldGen.test.ts
git commit -m "feat(world): intra-zone linking with connectivity guarantee and gateway-only cross-zone links"
```

---

### Task 7: Generator — password hint placement + reachability

**Files:**
- Modify: `src/world/worldGen.ts`
- Test: `src/world/worldGen.test.ts`

- [x] **Step 1: Write the failing test**

Append to `src/world/worldGen.test.ts`. Simulates a player: starts on owner, reads guest-readable files, crosses to machines that are open or whose password was seen, until fixpoint. Every machine must be reachable.

```ts
describe("buildWorld progression", () => {
  it("every locked machine's password is findable before reaching it", () => {
    const { owner, all } = buildWorld();
    const visited = new Set<Computer>([owner]);
    const knownTexts: string[] = [];

    const readFiles = (c: Computer) => {
      const collect = (folder: import("../computer/elements/Folder").Folder) => {
        for (const f of folder.files ?? []) {
          if (f.accessAuthorityLevel === "guest") knownTexts.push(f.content);
        }
        for (const child of folder.children ?? []) {
          if (child.accessAuthorityLevel === "guest") collect(child);
        }
      };
      collect(c.mainFolder);
    };
    readFiles(owner);

    let grew = true;
    while (grew) {
      grew = false;
      for (const c of [...visited]) {
        for (const l of c.computersLinked) {
          if (visited.has(l)) continue;
          const canEnter = l.password === "" || knownTexts.some((t) => t.includes(`'${l.password}'`));
          if (canEnter) {
            visited.add(l);
            readFiles(l);
            grew = true;
          }
        }
      }
    }

    const unreached = all.filter((c) => !visited.has(c)).map((c) => `${c.name}@${c.addressIp}`);
    expect(unreached).toEqual([]);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/world/worldGen.test.ts`
Expected: FAIL — locked filler machines unreached (no hints placed yet).

- [x] **Step 3: Add hint placement**

In `src/world/worldGen.ts`, inside the zone loop, track locked fillers and place hints after linking (before `zoneResults.push`):

Change the filler loop to collect locked machines:

```ts
    const lockedFillers: { computer: Computer; password: string }[] = [];
    const fillerTotal = randInt(rng, z.fillerCount[0], z.fillerCount[1]);
    for (let i = 0; i < fillerTotal; i++) {
      const made = buildFillerComputer(z, rng, usedSuffixes, usedNames, i);
      computers.push(made.computer);
      if (made.password) lockedFillers.push(made);
    }
```

After the extra-edges loop, add:

```ts
    // every locked filler's password lands in a guest file on an enterable machine of the zone
    const hintHosts = computers.filter((c) => c.password === "" || (owner !== undefined && c === owner));
    for (const lf of lockedFillers) {
      const host = pick(rng, hintHosts);
      const hint = new MyFile(
        `memo_${lf.computer.name}.txt`,
        `pense-bete: acces ${lf.computer.name} (${lf.computer.addressIp}) => mot de passe '${lf.password}'`
      );
      if (!host.mainFolder.files) host.mainFolder.files = [];
      host.mainFolder.files.push(hint);
    }
```

Note: `hintHosts` is never empty — every zone has an open entry machine, except `home` whose owner (player start) qualifies. The reachability test also relies on backbone hints quoting passwords in single quotes (`'quartier-libre'`, `'aurora-gate-7'`, `'helios-cooling-9'`, `'obsidian'`) — already done in Task 4 data.

- [x] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: PASS (all tests, 13 total).

- [x] **Step 5: Commit**

```bash
git add src/world/worldGen.ts src/world/worldGen.test.ts
git commit -m "feat(world): guaranteed-findable password hints for locked machines"
```

---

### Task 8: Integration into the game

**Files:**
- Modify: `src/types.ts` (I_FileSystemManager)
- Modify: `src/main.ts:57-99` (FileSystemManager)
- Delete: `src/computer/ComputerTest.ts`

- [x] **Step 1: Confirm ComputerTest is unused**

Run: `grep -rn "ComputerTest" src/`
Expected: only `src/computer/ComputerTest.ts` itself.

- [x] **Step 2: Add getAllComputers to the interface**

In `src/types.ts`, inside `I_FileSystemManager`, add after `getOwnerComputer(): Computer;`:

```ts
  getAllComputers(): Computer[];
```

- [x] **Step 3: Rewrite FileSystemManager**

In `src/main.ts`, replace the whole `FileSystemManager` class with:

```ts
class FileSystemManager implements I_FileSystemManager {
  private ownerComputer: Computer;
  private currentComputer: Computer;
  private currentFolder: Folder;
  private allComputers: Computer[];

  constructor() {
    const world = buildWorld();
    this.ownerComputer = world.owner;
    this.allComputers = world.all;
    this.currentComputer = this.ownerComputer;
    this.currentFolder = this.currentComputer.mainFolder;
  }

  getOwnerComputer = () => this.ownerComputer;
  setOwnerComputer = (newOwnerComputer: Computer) => { this.ownerComputer = newOwnerComputer; };
  getAllComputers = () => this.allComputers;
  getCurrentComputer = () => this.currentComputer;
  setCurrentComputer = (newCurrentComputer: Computer) => { this.currentComputer = newCurrentComputer; this.currentFolder = newCurrentComputer.mainFolder; };
  getCurrentFolder = () => this.currentFolder;
  setCurrentFolder = (newCurrentFolder: Folder) => { this.currentFolder = newCurrentFolder; };
}
```

Update imports at the top of `src/main.ts`: add `import { buildWorld } from "./world/worldGen";`, change `import { Computer }` and `import { Folder }` to type-only (`import type { Computer } from "./computer/Computer";` / `import type { Folder } from "./computer/elements/Folder";`), and remove the now-unused `import MyFile from "./computer/elements/File";`.

- [x] **Step 4: Delete ComputerTest**

```bash
git rm src/computer/ComputerTest.ts
```

- [x] **Step 5: Type-check and test**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors, all tests pass.

- [x] **Step 6: Manual smoke test**

Run: `npm run dev`, open the URL, then in the game terminal:
- `scan` → lists home-zone neighbors (bob-pc/fry-box/... plus `gw-home` LOCKED)
- `cat readme_network.txt` → shows gw-home password
- `connect <index of gw-home> quartier-libre` → connected
- `scan` from gw-home → shows cafe-router (suburb)
Expected: progression works, no console errors. Stop dev server.

- [x] **Step 7: Commit**

```bash
git add src/main.ts src/types.ts
git commit -m "feat: game world built by zone generator instead of hardcoded computers"
```

---

### Task 9: Build and deploy

**Files:**
- Modify: `docs/` (generated by Vite — do not hand-edit)

- [x] **Step 1: Production build**

Run: `npm run build`
Expected: `tsc` clean, Vite writes to `docs/`.

- [x] **Step 2: Commit and push**

```bash
git add docs plans/2026-06-12-network-world-topology.md
git commit -m "feat: deploy generated network world"
git push
```

- [x] **Step 3: Verify deploy**

After GitHub Pages rebuild (~1 min), open `https://maximemoya.github.io/game-my-hacknet-proto/` and run `scan`.
Expected: new home-zone machines listed.
