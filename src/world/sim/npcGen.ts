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
