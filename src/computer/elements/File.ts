import type { Authority } from "../authority/Authority";

export default class MyFile {

    private _name: string = "name.txt"
    private _content: string = ""
    private _accessAuthorityLevel: Authority = "guest"

    // ----------------------------------------------

    constructor(name: string, content: string, authorityAccess?: Authority) {
        this.name = name;
        this.content = content;
        if (authorityAccess) this.accessAuthorityLevel = authorityAccess;
    }

    // ----------------------------------------------

    get name(): string {
        return this._name;
    }

    set name(value: string) {
        this._name = value;
    }

    get content(): string {
        return this._content;
    }

    set content(value: string) {
        this._content = value;
    }

    get accessAuthorityLevel(): "guest" | "user" | "admin" {
        return this._accessAuthorityLevel;
    }

    set accessAuthorityLevel(value: "guest" | "user" | "admin") {
        this._accessAuthorityLevel = value;
    }

}