import { type Authority } from "./computer/authority/Authority";
import { Computer } from "./computer/Computer";
import MyFile from "./computer/elements/File";
import { Folder } from "./computer/elements/Folder";
import { commands } from "./commands/commands";
import type { I_DatabaseManager, I_FileSystemManager, I_MemoryManager, I_NetworkManager, I_UIManager, MemoryState, CommandContext } from "./types";

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

  constructor() {
    this.ownerComputer = new Computer("192.168.0.42", "wax", "wax")
      .withPasswordAuthUser("user")
      .withPasswordAuthAdmin("admin")
      .withMainFolder(
        new Folder("main").withFiles(
          [
            new MyFile("f1admin.txt", "le contenu du fichier admin", "admin"),
            new MyFile("f1user.txt", "le contenu du fichier user", "user"),
            new MyFile("f1guest.txt", "le contenu du fichier guest", "guest"),
          ]
        ).withChildrenFolder(
          [
            new Folder("intro").withFiles([new MyFile("readme.txt", "un nouveau contenu"), new MyFile("secret.txt", "code Bob => bob", "admin")]),
            new Folder("folderAdmin", "admin"),
            new Folder("folderUser", "user"),
            new Folder("folderGuest", "guest"),
          ]
        )
      )
      .withComputersLinked([
        new Computer("192.168.2.1", "Bob", "bob"),
        new Computer("192.168.0.254", "Fry"),
        new Computer("192.168.14.9", "Mey"),
        new Computer("193.169.1.11", "Dan"),
      ]);

    this.currentComputer = this.ownerComputer;
    this.currentFolder = this.currentComputer.mainFolder;
  }

  getOwnerComputer = () => this.ownerComputer;
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

  constructor() {
    this.output = document.getElementById("output") as HTMLDivElement;
    this.cwdEl = document.getElementById("cwd") as HTMLDivElement;
    this.memUsedEl = document.getElementById("memUsed") as HTMLSpanElement;
    this.memTotEl = document.getElementById("memTot") as HTMLSpanElement;
    this.connBadge = document.getElementById("connBadge") as HTMLDivElement;
  }

  writeLine = (text: string, cls?: string) => {
    const d = document.createElement("div");
    d.className = "line" + (cls ? " " + cls : "");
    d.textContent = text;
    this.output.appendChild(d);
    this.output.scrollTop = this.output.scrollHeight;
  };

  writePromptLine = (text: string) => {
    const d = document.createElement("div");
    d.className = "line";
    d.innerHTML = `<span class="prompt">> </span>${this.escapeHtml(text)}`;
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
  isCurrentlyConnected = () => this.isConnected;
}

class Terminal {
  private db: I_DatabaseManager;
  private fs: I_FileSystemManager;
  private memory: I_MemoryManager;
  private ui: I_UIManager;
  private network: I_NetworkManager;
  private form: HTMLFormElement;
  private cmdInput: HTMLInputElement;

  constructor() {
    this.db = new DatabaseManager();
    this.fs = new FileSystemManager();
    this.memory = new MemoryManager();
    this.ui = new UIManager();
    this.network = new NetworkManager();

    this.form = document.getElementById("form") as HTMLFormElement;
    this.cmdInput = document.getElementById("cmd") as HTMLInputElement;

    this.setupEventListeners();
    this.init();
  }

  private setupEventListeners(): void {
    this.form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const raw = this.cmdInput.value.trim();
      if (!raw) return;
      this.ui.writePromptLine(raw);
      this.cmdInput.value = "";
      const parts = raw.split(/\s+/);
      const name = parts[0];
      const args = parts.slice(1);
      await this.executeCommand(name, args);
    });

    this.cmdInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Tab") {
        ev.preventDefault();

        const value = this.cmdInput.value;
        const trimmedValue = value.trim();
        const parts = trimmedValue.split(/\s+/);
        const commandName = parts[0];
        const lastPart = parts[parts.length - 1];

        const fileAndFolderCommands = ["cat", "cd", "rm"];
        const programs = ["ping", "tracer"];

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
        }
      }
    });
  }

  private async executeCommand(name: string, args: string[]): Promise<void> {
    const cmd = commands[name];
    if (!cmd) {
      this.ui.writeLine(`${name}: commande inconnue. Tape 'help'.`);
      return;
    }
    try {
      const context: CommandContext = {
        fs: this.fs,
        ui: this.ui,
        memory: this.memory,
        network: this.network,
        db: this.db,
        getPromptToUpdate: this.getPromptToUpdate,
        delay: this.delay,
      };
      await cmd(args, context);
    } catch (err: any) {
      console.error(err);
      this.ui.writeLine(`Erreur: ${err?.message ?? String(err)}`);
    }
  }

  private delay = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

  private getPromptToUpdate = (): string => {
    return this.fs.getCurrentComputer().addressIp + " " + this.fs.getCurrentComputer().name + `[${this.fs.getCurrentComputer().authority.toUpperCase()}]` + " => " + this.fs.getCurrentFolder().fullPathName;
  }

  private async init(): Promise<void> {
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
