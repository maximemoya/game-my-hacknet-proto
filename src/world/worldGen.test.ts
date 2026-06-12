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
