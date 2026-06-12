import type { Authority } from "./computer/authority/Authority";
import type { Computer } from "./computer/Computer";
import type { Folder } from "./computer/elements/Folder";

// General Types
export type MemoryState = { total: number; used: number };
export type FileNode = { type: "file"; content: string } | { type: "dir"; children: Record<string, FileNode> };

// Manager Interfaces
export interface I_DatabaseManager {
  put(key: string, value: any): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  delete(key: string): Promise<void>;
}

export interface I_FileSystemManager {
  getOwnerComputer(): Computer;
  setOwnerComputer(newOwnerComputer: Computer): void;
  getCurrentComputer(): Computer;
  setCurrentComputer(newCurrentComputer: Computer): void;
  getCurrentFolder(): Folder;
  setCurrentFolder(newCurrentFolder: Folder): void;
}

export interface I_MemoryManager {
  getMemory(): MemoryState;
  setMemory(memory: MemoryState): void;
  allocate(amount: number): boolean;
  free(amount: number): void;
  reset(): void;
}

export interface I_UIManager {
  writeLine(text: string, cls?: string): void;
  writePromptLine(text: string): void;
  clearOutput(): void;
  updateMemoryUI(memory: MemoryState): void;
  updatePrompt(cwd: string, isConnected: boolean, authority: Authority): void;
  updateConnectionBadge(isConnected: boolean): void;
}

export interface I_NetworkManager {
  isConnected: boolean;
  isCurrentlyConnected(): boolean;
}

// Command Context and Type
export interface CommandContext {
  fs: I_FileSystemManager;
  ui: I_UIManager;
  memory: I_MemoryManager;
  network: I_NetworkManager;
  db: I_DatabaseManager;
  getPromptToUpdate: () => string;
  delay(ms: number): Promise<void>;
}

export type Command = (args: string[], context: CommandContext) => Promise<void>;
