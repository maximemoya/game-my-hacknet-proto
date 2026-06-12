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
