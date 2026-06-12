import type { Authority } from "./authority/Authority";
import { Folder } from "./elements/Folder";

export class Computer {

    private _name: string = "computer"
    private _addressIp: string = "0.0.0.0";
    private _mainFolder: Folder = new Folder("home");
    private _authority: Authority = "admin"

    private _password: string = ""
    private _passwordAuthUser: string = ""
    private _passwordAuthAdmin: string = ""

    private _computersLinked: Computer[] = []

    // ----------------------------------------------

    constructor(
        addressIp: string,
        name: string,
        password?: string,
        authority?: Authority
    ) {
        this.addressIp = addressIp;
        this.name = name;
        if (password) this.password = password;
        if (authority) this.authority = authority;
    }

    // ----------------------------------------------

    public withMainFolder(folder: Folder): Computer {
        this.mainFolder = folder;
        return this;
    }

    public withComputersLinked(computers: Computer[]): Computer {
        this.computersLinked = computers;
        return this;
    }

    public withComputerLinked(computer: Computer): Computer {
        if (!this._computersLinked.find(c => c.addressIp === computer.addressIp && c.name === computer.name)) {
            this._computersLinked.push(computer);
            if (!computer.computersLinked.find(c => c.addressIp === this.addressIp && c.name === this.name)) {
                computer._computersLinked.push(this);
            }
        }
        return this;
    }

    public withPasswordAuthUser(passwordAuthUser: string): Computer {
        this.passwordAuthUser = passwordAuthUser;
        return this;
    }

    public withPasswordAuthAdmin(passwordAuthAdmin: string): Computer {
        this.passwordAuthAdmin = passwordAuthAdmin;
        return this;
    }

    // ----------------------------------------------

    get name(): string {
        return this._name;
    }

    set name(value: string) {
        this._name = value;
    }

    get addressIp(): string {
        return this._addressIp;
    }

    set addressIp(value: string) {
        const ipRegex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipRegex.test(value)) {
            throw new Error("Invalid IP address format");
        }
        this._addressIp = value;
    }

    get mainFolder(): Folder {
        return this._mainFolder;
    }

    set mainFolder(value: Folder) {
        this._mainFolder = value;
    }

    get authority(): "guest" | "user" | "admin" {
        return this._authority;
    }

    set authority(value: "guest" | "user" | "admin") {
        this._authority = value;
    }

    get computersLinked(): Computer[] {
        return this._computersLinked;
    }

    set computersLinked(values: Computer[]) {
        values.forEach(v => {
            if (!v.computersLinked.find(c => c.addressIp === v.addressIp && c.name === v.name)) {
                v.computersLinked.push(this)
            }
        })
        this._computersLinked = [...values];
    }

    get password(): string {
        return this._password;
    }

    set password(value: string) {
        this._password = value;
    }

    get passwordAuthUser(): string {
        return this._passwordAuthUser;
    }

    set passwordAuthUser(value: string) {
        this._passwordAuthUser = value;
    }

    get passwordAuthAdmin(): string {
        return this._passwordAuthAdmin;
    }

    set passwordAuthAdmin(value: string) {
        this._passwordAuthAdmin = value;
    }

}