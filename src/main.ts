import { type Authority } from "./computer/authority/Authority";
import type { Computer } from "./computer/Computer";
import type { Folder } from "./computer/elements/Folder";
import { buildWorld, type World } from "./world/worldGen";
import { mulberry32 } from "./world/rng";
import { WORLD_SEED } from "./world/worldData";
import { generateNpcs } from "./world/sim/npcGen";
import { Simulation } from "./world/sim/simulation";
import { commands } from "./commands/commands";
import { getHelpFor } from "./commands/commandHelp";
import { programRegistry } from "./programs/programRegistry";
import { startMatrixRain } from "./matrixRain";
import { startHud, pushNetFeedLine } from "./hud";
import { setupAudio, playKeyClick, playCommandSfx, playError } from "./audio";
import { DiscoveredNetwork } from "./discoveredNetwork";
import { ScanView } from "./scanView";
import type { I_DatabaseManager, I_FileSystemManager, I_MemoryManager, I_NetworkManager, I_UIManager, MemoryState, CommandContext, ScanEntry } from "./types";

const MEM_MAX_SIZE = 512;

class DatabaseManager implements I_DatabaseManager {
  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("HacknetProtoDB", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async put(key: string, value: any): Promise<void> {
    const db = await this.openDB();
    return new Promise<void>((res, rej) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(value, key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const db = await this.openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction("kv", "readonly");
      const req = tx.objectStore("kv").get(key);
      req.onsuccess = () => res(req.result ?? null);
      req.onerror = () => rej(req.error);
    });
  }

  async delete(key: string): Promise<void> {
    const db = await this.openDB();
    return new Promise<void>((res, rej) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").delete(key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }
}

class FileSystemManager implements I_FileSystemManager {
  private ownerComputer: Computer;
  private currentComputer: Computer;
  private currentFolder: Folder;
  private allComputers: Computer[];

  constructor(world: World) {
    this.ownerComputer = world.owner;
    this.allComputers = world.all;
    this.currentComputer = this.ownerComputer;
    this.currentFolder = this.currentComputer.mainFolder;
  }

  getOwnerComputer = () => this.ownerComputer;
  getAllComputers = () => this.allComputers;
  setOwnerComputer = (newOwnerComputer: Computer) => { this.ownerComputer = newOwnerComputer; };
  getCurrentComputer = () => this.currentComputer;
  setCurrentComputer = (newCurrentComputer: Computer) => { this.currentComputer = newCurrentComputer; this.currentFolder = newCurrentComputer.mainFolder; };
  getCurrentFolder = () => this.currentFolder;
  setCurrentFolder = (newCurrentFolder: Folder) => { this.currentFolder = newCurrentFolder; };
}

class MemoryManager implements I_MemoryManager {
  private memory: MemoryState;

  constructor() {
    this.memory = { total: MEM_MAX_SIZE, used: 0 };
  }

  getMemory = () => this.memory;
  setMemory = (memory: MemoryState) => { this.memory = memory; };
  allocate = (amount: number) => {
    if (this.memory.used + amount > this.memory.total) return false;
    this.memory.used += amount;
    return true;
  };
  free = (amount: number) => { this.memory.used = Math.max(0, this.memory.used - amount); };
  reset = () => { this.memory = { total: MEM_MAX_SIZE, used: 0 }; };
}

class UIManager implements I_UIManager {
  private output: HTMLDivElement;
  private cwdEl: HTMLDivElement;
  private memUsedEl: HTMLSpanElement;
  private memTotEl: HTMLSpanElement;
  private connBadge: HTMLDivElement;
  private cmdInput: HTMLInputElement;

  constructor() {
    this.output = document.getElementById("output") as HTMLDivElement;
    this.cwdEl = document.getElementById("cwd") as HTMLDivElement;
    this.memUsedEl = document.getElementById("memUsed") as HTMLSpanElement;
    this.memTotEl = document.getElementById("memTot") as HTMLSpanElement;
    this.connBadge = document.getElementById("connBadge") as HTMLDivElement;
    this.cmdInput = document.getElementById("cmd") as HTMLInputElement;
  }

  private currentCmdClass: string = "";

  setCommandClass = (name: string) => {
    this.currentCmdClass = name ? " cmd-" + name.replace(/[^\w-]/g, "") : "";
  };

  writeLine = (text: string, cls?: string) => {
    const d = document.createElement("div");
    d.className = "line" + this.currentCmdClass + (cls ? " " + cls : "");
    d.textContent = text;
    this.output.appendChild(d);
    this.output.scrollTop = this.output.scrollHeight;
  };

  writeClickableLine = (text: string, commandToFill: string, cls?: string) => {
    const d = document.createElement("div");
    d.className = "line clickable" + this.currentCmdClass + (cls ? " " + cls : "");
    d.textContent = text;
    d.addEventListener("click", () => {
      this.cmdInput.value = commandToFill;
      this.cmdInput.focus();
      this.cmdInput.setSelectionRange(this.cmdInput.value.length, this.cmdInput.value.length);
    });
    this.output.appendChild(d);
    this.output.scrollTop = this.output.scrollHeight;
  };

  writePromptLine = (text: string) => {
    const d = document.createElement("div");
    d.className = "line";
    const name = text.split(/\s+/)[0];
    const cmdCls = "cmd-" + name.replace(/[^\w-]/g, "");
    d.innerHTML = `<span class="prompt">> </span><span class="${cmdCls}">${this.escapeHtml(name)}</span>${this.escapeHtml(text.slice(name.length))}`;
    this.output.appendChild(d);
    this.output.scrollTop = this.output.scrollHeight;
  };

  clearOutput = () => { this.output.innerHTML = ""; };

  updateMemoryUI = (memory: MemoryState) => {
    this.memUsedEl.textContent = String(memory.used);
    this.memTotEl.textContent = String(memory.total);
  };

  updatePrompt = (cwd: string, isConnected: boolean, authority: Authority) => {
    this.cwdEl.classList.remove("cwdAuthAdmin", "cwdAuthUser", "cwdAuthGuest");
    switch (authority) {
      case "admin": this.cwdEl.classList.add("cwdAuthAdmin"); break;
      case "user": this.cwdEl.classList.add("cwdAuthUser"); break;
      case "guest": this.cwdEl.classList.add("cwdAuthGuest"); break;
    }
    this.cwdEl.textContent = cwd + (isConnected ? "#" : "$");
  };

  updateConnectionBadge = (isConnected: boolean) => { this.connBadge.textContent = isConnected ? "connected" : "offline"; };

  private escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}

class NetworkManager implements I_NetworkManager {
  public isConnected: boolean = false;
  public scanResults: ScanEntry[] = [];
  public scanSourceIp: string = "";
  public discovered = new DiscoveredNetwork();
  isCurrentlyConnected = () => this.isConnected;
}

class Terminal {
  private db: I_DatabaseManager;
  private fs: I_FileSystemManager;
  private memory: I_MemoryManager;
  private ui: I_UIManager;
  private network: I_NetworkManager;
  private sim: Simulation;
  private form: HTMLFormElement;
  private cmdInput: HTMLInputElement;
  private scanView: ScanView;
  private history: string[] = [];
  private historyIndex: number = 0;

  constructor() {
    this.db = new DatabaseManager();
    const world = buildWorld();
    this.fs = new FileSystemManager(world);
    const simRng = mulberry32(WORLD_SEED + 1);
    this.sim = new Simulation(world.zones, generateNpcs(world.zones, world.owner, simRng), simRng);
    this.sim.onEvent((e) => {
      if (e.zoneId === this.sim.zoneIdOf(this.fs.getCurrentComputer().addressIp)) {
        pushNetFeedLine(e.text);
      }
    });
    this.sim.start();
    this.memory = new MemoryManager();
    this.ui = new UIManager();
    this.network = new NetworkManager();

    this.form = document.getElementById("form") as HTMLFormElement;
    this.cmdInput = document.getElementById("cmd") as HTMLInputElement;

    this.scanView = new ScanView({
      container: document.getElementById("scanView") as HTMLElement,
      discovered: this.network.discovered,
      getCurrentIp: () => this.fs.getCurrentComputer().addressIp,
      getOwnerIp: () => this.fs.getOwnerComputer().addressIp,
      onNodeAction: (node) => {
        if (node.ip === this.fs.getCurrentComputer().addressIp) return;
        if (node.passwordRequired && !node.unlocked) {
          this.setActiveTab("terminal");
          this.cmdInput.value = `connect ${node.ip} ${node.name} `;
          this.cmdInput.focus();
          this.cmdInput.setSelectionRange(this.cmdInput.value.length, this.cmdInput.value.length);
        } else {
          void this.submitCommand(`connect ${node.ip} ${node.name}`).then(() => {
            if (this.fs.getCurrentComputer().addressIp === node.ip) {
              this.scanView.show();
            } else {
              this.setActiveTab("terminal");
            }
          });
        }
      },
      onScan: () => this.submitCommand("scan"),
    });
    this.setupTabs();

    this.setupEventListeners();
    startMatrixRain(document.getElementById("rain") as HTMLCanvasElement);
    startHud();
    setupAudio();
    this.init();
  }

  private setupTabs(): void {
    const tabTerminal = document.getElementById("tabTerminal") as HTMLButtonElement;
    const tabScanView = document.getElementById("tabScanView") as HTMLButtonElement;
    tabTerminal.addEventListener("click", () => this.setActiveTab("terminal"));
    tabScanView.addEventListener("click", () => this.setActiveTab("scan"));
  }

  private setActiveTab(which: "terminal" | "scan"): void {
    const tabTerminal = document.getElementById("tabTerminal") as HTMLButtonElement;
    const tabScanView = document.getElementById("tabScanView") as HTMLButtonElement;
    const terminalView = document.getElementById("terminalView") as HTMLDivElement;
    const scanViewEl = document.getElementById("scanView") as HTMLDivElement;
    const isTerminal = which === "terminal";
    tabTerminal.classList.toggle("active", isTerminal);
    tabScanView.classList.toggle("active", !isTerminal);
    terminalView.hidden = !isTerminal;
    scanViewEl.hidden = isTerminal;
    if (isTerminal) {
      this.scanView.hide();
      this.cmdInput.focus();
    } else {
      this.scanView.show();
    }
  }

  private submitCommand = async (raw: string): Promise<void> => {
    if (raw !== this.history[this.history.length - 1]) {
      this.history.push(raw);
    }
    this.historyIndex = this.history.length;
    this.ui.writePromptLine(raw);
    const parts = raw.split(/\s+/);
    const name = parts[0];
    const args = parts.slice(1);
    await this.executeCommand(name, args);
  };

  private setupEventListeners(): void {
    this.form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const raw = this.cmdInput.value.trim();
      if (!raw) return;
      this.cmdInput.value = "";
      await this.submitCommand(raw);
    });

    this.cmdInput.addEventListener("keydown", (ev) => {
      playKeyClick();
      if (ev.key === "ArrowUp") {
        ev.preventDefault();
        if (this.historyIndex > 0) {
          this.historyIndex--;
          this.cmdInput.value = this.history[this.historyIndex];
          this.cmdInput.setSelectionRange(this.cmdInput.value.length, this.cmdInput.value.length);
        }
      } else if (ev.key === "ArrowDown") {
        ev.preventDefault();
        if (this.historyIndex < this.history.length) {
          this.historyIndex++;
          this.cmdInput.value = this.historyIndex === this.history.length ? "" : this.history[this.historyIndex];
          this.cmdInput.setSelectionRange(this.cmdInput.value.length, this.cmdInput.value.length);
        }
      } else if (ev.key === "Tab") {
        ev.preventDefault();

        const value = this.cmdInput.value;
        const trimmedValue = value.trim();
        const parts = trimmedValue.split(/\s+/);
        const commandName = parts[0];
        const lastPart = parts[parts.length - 1];

        const fileAndFolderCommands = ["cat", "cd", "rm"];
        const programs = Object.keys(programRegistry);

        if (parts.length === 1) {
          const commandKeys = Object.keys(commands);
          const matches = commandKeys.filter(k => k.startsWith(commandName));
          if (matches.length === 1) {
            this.cmdInput.value = matches[0] + " ";
          } else if (matches.length > 1) {
            this.ui.writeLine(matches.join("  "));
          }
        } else if (parts.length > 1 && fileAndFolderCommands.includes(commandName)) {
          const currentFolder = this.fs.getCurrentFolder();
          const suggestions = [
            ...(currentFolder.files?.map(f => f.name) ?? []),
            ...(currentFolder.children?.map(f => f.name) ?? [])
          ].filter(name => name.startsWith(lastPart));

          if (suggestions.length === 1) {
            const completedValue = trimmedValue.substring(0, trimmedValue.length - lastPart.length) + suggestions[0];
            this.cmdInput.value = completedValue + " ";
          } else if (suggestions.length > 1) {
            this.ui.writeLine(suggestions.join("  "));
          }
        } else if (parts.length > 1 && commandName === "run") {
          const suggestions = programs.filter(p => p.startsWith(lastPart));

          if (suggestions.length === 1) {
            const completedValue = trimmedValue.substring(0, trimmedValue.length - lastPart.length) + suggestions[0];
            this.cmdInput.value = completedValue + " ";
          } else if (suggestions.length > 1) {
            this.ui.writeLine(suggestions.join("  "));
          }
        } else if (parts.length > 1 && commandName === "connect") {
          const linked = this.fs.getCurrentComputer().computersLinked;
          const suggestions = parts.length === 2
            ? linked.map(c => c.addressIp).filter(s => s.startsWith(lastPart))
            : linked.filter(c => c.addressIp === parts[1]).map(c => c.name).filter(s => s.startsWith(lastPart));

          if (suggestions.length === 1) {
            const completedValue = trimmedValue.substring(0, trimmedValue.length - lastPart.length) + suggestions[0];
            this.cmdInput.value = completedValue + " ";
          } else if (suggestions.length > 1) {
            this.ui.writeLine(suggestions.join("  "));
          }
        }
      }
    });
  }

  private async executeCommand(name: string, args: string[]): Promise<void> {
    const cmd = commands[name];
    if (!cmd) {
      playError();
      this.ui.setCommandClass("error");
      this.ui.writeLine(`${name}: commande inconnue. Tape 'help'.`);
      this.ui.setCommandClass("");
      return;
    }
    playCommandSfx(name);
    this.ui.setCommandClass(name);
    const helpLines = getHelpFor(name, args);
    if (helpLines) {
      for (const line of helpLines) this.ui.writeLine(line);
      this.ui.setCommandClass("");
      return;
    }
    try {
      const context: CommandContext = {
        fs: this.fs,
        ui: this.ui,
        memory: this.memory,
        network: this.network,
        db: this.db,
        sim: this.sim,
        getPromptToUpdate: this.getPromptToUpdate,
        delay: this.delay,
      };
      await cmd(args, context);
    } catch (err: any) {
      console.error(err);
      playError();
      this.ui.setCommandClass("error");
      this.ui.writeLine(`Erreur: ${err?.message ?? String(err)}`);
    } finally {
      this.ui.setCommandClass("");
      this.scanView.markDirty();
    }
  }

  private delay = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

  private getPromptToUpdate = (): string => {
    return this.fs.getCurrentComputer().addressIp + " " + this.fs.getCurrentComputer().name + `[${this.fs.getCurrentComputer().authority.toUpperCase()}]` + " => " + this.fs.getCurrentFolder().fullPathName;
  }

  private async init(): Promise<void> {
    const owner = this.fs.getOwnerComputer();
    this.network.discovered.upsertNode({
      ip: owner.addressIp,
      name: owner.name,
      passwordRequired: owner.password !== "",
    });
    this.ui.writeLine("Hacknet-like terminal prototype (Vanilla TS)");
    this.ui.writeLine("Tape 'help' pour commencer.");
    this.ui.updateMemoryUI(this.memory.getMemory());
    this.ui.updatePrompt(this.getPromptToUpdate(), this.network.isCurrentlyConnected(), this.fs.getCurrentComputer().authority);

    const saved = await this.db.get<any>("fs");
    if (saved) {
      this.ui.writeLine("load from db.get fs => work in progress...");
    }
  }
}

new Terminal();
