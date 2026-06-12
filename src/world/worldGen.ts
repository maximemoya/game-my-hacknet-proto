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

    const lockedFillers: { computer: Computer; password: string }[] = [];
    const fillerTotal = randInt(rng, z.fillerCount[0], z.fillerCount[1]);
    for (let i = 0; i < fillerTotal; i++) {
      const made = buildFillerComputer(z, rng, usedSuffixes, usedNames, i);
      computers.push(made.computer);
      if (made.password) lockedFillers.push(made);
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

    zoneResults.push({ id: z.id, computers });
  }

  for (const gw of gatewayLinks) {
    const entry = entryByZone.get(gw.to);
    if (!entry) throw new Error(`zone ${gw.to} has no entry machine for gateway link`);
    gw.computer.withComputerLinked(entry);
  }

  if (!owner) throw new Error("no owner machine defined");
  return { owner, all: zoneResults.flatMap((zr) => zr.computers), zones: zoneResults };
}
