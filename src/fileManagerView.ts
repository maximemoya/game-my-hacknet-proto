import { authorityCompare } from "./computer/authority/Authority";
import { playUiClick } from "./audio";
import type MyFile from "./computer/elements/File";
import type { Folder } from "./computer/elements/Folder";
import type { I_FileSystemManager } from "./types";

export interface FileManagerViewOptions {
  container: HTMLElement;
  fs: I_FileSystemManager;
  onCommand: (raw: string) => Promise<void>;
  runGrep: (pattern: string) => Promise<string[]>;
}

export class FileManagerView {
  private container: HTMLElement;
  private fs: I_FileSystemManager;
  private onCommand: (raw: string) => Promise<void>;
  private runGrep: (pattern: string) => Promise<string[]>;
  private dirty = true;
  private visible = false;
  private viewingFile: MyFile | null = null;
  private lastFolder: Folder | null = null;
  private searchTerm = "";
  private grepResults: string[] | null = null;
  private grepPattern = "";

  constructor(options: FileManagerViewOptions) {
    this.container = options.container;
    this.fs = options.fs;
    this.onCommand = options.onCommand;
    this.runGrep = options.runGrep;
  }

  show(): void {
    this.visible = true;
    if (this.dirty) this.render();
  }

  hide(): void {
    this.visible = false;
  }

  markDirty(): void {
    this.dirty = true;
    if (this.visible) this.render();
  }

  private render(): void {
    this.dirty = false;
    this.container.innerHTML = "";

    const computer = this.fs.getCurrentComputer();
    const folder = this.fs.getCurrentFolder();
    const authority = computer.authority;

    if (folder !== this.lastFolder) {
      this.viewingFile = null;
      this.grepResults = null;
      this.lastFolder = folder;
    }

    const path = document.createElement("div");
    path.className = "fmPath";
    path.textContent = `${computer.name} :: ${folder.fullPathName} `;
    const authSpan = document.createElement("span");
    switch (authority) {
      case "admin": authSpan.className = "fmAuthAdmin"; break;
      case "user": authSpan.className = "fmAuthUser"; break;
      case "guest": authSpan.className = "fmAuthGuest"; break;
    }
    authSpan.textContent = `[${authority.toUpperCase()}]`;
    path.appendChild(authSpan);
    this.container.appendChild(path);

    this.renderSearchBar();

    if (this.grepResults !== null) {
      this.renderGrepResults();
    } else if (this.viewingFile && folder.files?.includes(this.viewingFile)) {
      this.renderFileContent(this.viewingFile);
    } else {
      this.viewingFile = null;
      this.renderList(folder, authority);
    }
  }

  private renderSearchBar(): void {
    const row = document.createElement("div");
    row.className = "fmSearch";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "fmSearchInput";
    input.placeholder = "grep <text>";
    input.value = this.searchTerm;
    input.addEventListener("input", () => { this.searchTerm = input.value; });
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") { ev.preventDefault(); void this.doSearch(); }
    });
    row.appendChild(input);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fmSearchBtn";
    btn.textContent = "search";
    btn.addEventListener("click", () => { void this.doSearch(); });
    row.appendChild(btn);

    this.container.appendChild(row);
  }

  private async doSearch(): Promise<void> {
    const term = this.searchTerm.trim();
    if (!term) return;
    this.grepPattern = term;
    this.grepResults = await this.runGrep(term);
    this.render();
  }

  private renderGrepResults(): void {
    const content = document.createElement("div");
    content.className = "fmContent";

    const header = document.createElement("div");
    header.className = "fmContentHeader";
    const title = document.createElement("span");
    title.textContent = `grep: ${this.grepPattern}`;
    header.appendChild(title);
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "fmCloseBtn";
    closeBtn.textContent = "CLOSE [x]";
    closeBtn.addEventListener("click", () => { playUiClick(); this.grepResults = null; this.render(); });
    header.appendChild(closeBtn);
    content.appendChild(header);

    const body = document.createElement("div");
    body.className = "fmContentBody";
    body.textContent = (this.grepResults ?? []).join("\n");
    content.appendChild(body);

    this.container.appendChild(content);
  }

  private renderList(folder: Folder, authority: "guest" | "user" | "admin"): void {
    const list = document.createElement("div");
    list.className = "fmList";

    let entryCount = 0;

    if (folder.parent) {
      const up = document.createElement("div");
      up.className = "fmEntry fmFolder";
      up.textContent = "../";
      up.addEventListener("click", () => { void this.onCommand("cd ../"); });
      list.appendChild(up);
      entryCount++;
    }

    const visibleFolders = folder.children?.filter(
      child => authorityCompare(authority, child.accessAuthorityLevel)
    ) ?? [];
    for (const child of visibleFolders) {
      const entry = document.createElement("div");
      entry.className = "fmEntry fmFolder";
      entry.textContent = `▸ ${child.name}/`;
      entry.addEventListener("click", () => { void this.onCommand(`cd ${child.name}`); });
      list.appendChild(entry);
      entryCount++;
    }

    const visibleFiles = folder.files?.filter(
      file => authorityCompare(authority, file.accessAuthorityLevel)
    ) ?? [];
    for (const file of visibleFiles) {
      const entry = document.createElement("div");
      entry.className = "fmEntry fmFile";
      entry.textContent = file.name;
      entry.addEventListener("click", () => this.openFile(file));
      list.appendChild(entry);
      entryCount++;
    }

    if (entryCount === 0) {
      const empty = document.createElement("div");
      empty.className = "fmEmpty";
      empty.textContent = "(empty)";
      list.appendChild(empty);
    }

    this.container.appendChild(list);
  }

  private renderFileContent(file: MyFile): void {
    const content = document.createElement("div");
    content.className = "fmContent";

    const header = document.createElement("div");
    header.className = "fmContentHeader";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "fmCloseBtn";
    closeBtn.textContent = "CLOSE [x]";
    closeBtn.addEventListener("click", () => { playUiClick(); this.closeFile(); });
    header.appendChild(closeBtn);
    const title = document.createElement("span");
    title.textContent = file.name;
    header.appendChild(title);
    content.appendChild(header);

    const body = document.createElement("div");
    body.className = "fmContentBody";
    body.textContent = file.content;
    content.appendChild(body);

    this.container.appendChild(content);
  }

  private openFile(file: MyFile): void {
    if (!authorityCompare(this.fs.getCurrentComputer().authority, file.accessAuthorityLevel)) return;
    void this.onCommand(`cat ${file.name}`);
    this.viewingFile = file;
    this.render();
  }

  private closeFile(): void {
    this.viewingFile = null;
    this.render();
  }
}
