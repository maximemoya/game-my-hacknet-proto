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
