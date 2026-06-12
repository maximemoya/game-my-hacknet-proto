import type { Authority } from "../authority/Authority";
import type MyFile from "./File";

export class Folder {

    private _name: string = "name"
    private _parent: Folder | undefined = undefined
    private _children: Folder[] | undefined = undefined
    private _files: MyFile[] | undefined = undefined
    private _accessAuthorityLevel: Authority = "guest"

    // ----------------------------------------------

    constructor(name: string, authorityAccess?: Authority, parent?: Folder) {
        this._name = name;
        if (authorityAccess) this.accessAuthorityLevel = authorityAccess;
        this._parent = parent;
    }

    // ----------------------------------------------

    public withFiles(files: MyFile[]): Folder {
        this.files = [...files]
        return this
    }

    public withChildrenFolder(folders: Folder[]): Folder {
        this.children = folders;
        return this;
    }

    public withChildFolder(folder: Folder): Folder {
        if (!this.children) {
            this.children = [];
        }
        folder.parent = this;
        this.children.push(folder);
        return this;
    }

    // ----------------------------------------------

    get fullPathName(): string {
        const pathParts: string[] = [];
        let current: Folder | undefined = this;
        while (current) {
            pathParts.unshift(current.name);
            current = current.parent;
        }
        return pathParts.join("/");
    }

    // ----------------------------------------------

    get name(): string {
        return this._name;
    }

    set name(value: string) {
        this._name = value;
    }

    get parent(): Folder | undefined {
        return this._parent;
    }

    set parent(value: Folder | undefined) {
        this._parent = value;
    }

    get children(): Folder[] | undefined {
        return this._children;
    }

    set children(values: Folder[] | undefined) {
        if (values) {
            this._children = [...values];
            this._children?.forEach(childFolder => childFolder.parent = this)
        }
    }

    get files(): MyFile[] | undefined {
        return this._files;
    }

    set files(value: MyFile[] | undefined) {
        this._files = value;
    }

    get accessAuthorityLevel(): "guest" | "user" | "admin" {
        return this._accessAuthorityLevel;
    }

    set accessAuthorityLevel(value: "guest" | "user" | "admin") {
        this._accessAuthorityLevel = value;
    }

}