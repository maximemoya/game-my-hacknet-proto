import { describe, expect, it } from "vitest";
import { grep } from "./grep";
import { Computer } from "../../computer/Computer";
import { Folder } from "../../computer/elements/Folder";
import MyFile from "../../computer/elements/File";
import type { Authority } from "../../computer/authority/Authority";
import type { CommandContext } from "../../types";

function buildComputer(authority: Authority): Computer {
    const computer = new Computer("1.2.3.4", "target", undefined, authority);
    const main = new Folder("home", "guest").withFiles([
        new MyFile("readme.txt", "hello world\nsecond line with secret"),
        new MyFile("admin.txt", "secret root password", "admin"),
    ]);
    const logs = new Folder("logs", "guest").withFiles([
        new MyFile("net.log", "secret handshake\nnothing here"),
    ]);
    main.withChildFolder(logs);
    return computer.withMainFolder(main);
}

function buildContext(computer: Computer, lines: string[]): CommandContext {
    return {
        fs: {
            getCurrentComputer: () => computer,
            getCurrentFolder: () => computer.mainFolder,
        },
        ui: {
            writeLine: (text: string) => { lines.push(text); },
        },
    } as unknown as CommandContext;
}

describe("grep", () => {
    it("prints usage without pattern", async () => {
        const lines: string[] = [];
        await grep([], buildContext(buildComputer("admin"), lines));
        expect(lines).toEqual(["Usage: grep <text>"]);
    });

    it("finds matches in current folder and subfolders with path and line number", async () => {
        const lines: string[] = [];
        await grep(["secret"], buildContext(buildComputer("admin"), lines));
        expect(lines).toEqual([
            "readme.txt:2: second line with secret",
            "admin.txt:1: secret root password",
            "logs/net.log:1: secret handshake",
        ]);
    });

    it("joins args into one pattern", async () => {
        const lines: string[] = [];
        await grep(["secret", "handshake"], buildContext(buildComputer("admin"), lines));
        expect(lines).toEqual(["logs/net.log:1: secret handshake"]);
    });

    it("skips files above current authority", async () => {
        const lines: string[] = [];
        await grep(["secret"], buildContext(buildComputer("guest"), lines));
        expect(lines).toEqual([
            "readme.txt:2: second line with secret",
            "logs/net.log:1: secret handshake",
        ]);
    });

    it("reports when nothing matches", async () => {
        const lines: string[] = [];
        await grep(["zzz_nope"], buildContext(buildComputer("admin"), lines));
        expect(lines).toEqual(['no match for "zzz_nope"']);
    });
});
