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
