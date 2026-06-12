import { describe, expect, it } from "vitest";
import { commandHelp, getHelpFor, HELP_SUFFIX_EXEMPT } from "./commandHelp";
import { commands } from "./commands";

describe("commandHelp", () => {
    it("covers exactly the registered commands", () => {
        expect(Object.keys(commandHelp).sort()).toEqual(Object.keys(commands).sort());
    });

    it("every exempt command exists", () => {
        for (const name of HELP_SUFFIX_EXEMPT) {
            expect(commands[name]).toBeDefined();
        }
    });
});

describe("getHelpFor", () => {
    it("returns help lines for '<command> help'", () => {
        const lines = getHelpFor("scan", ["help"]);
        expect(lines).not.toBeNull();
        expect(lines![0]).toContain("scan:");
        expect(lines![1]).toContain("Usage:");
    });

    it("does not fire for exempt commands (echo help prints 'help')", () => {
        expect(getHelpFor("echo", ["help"])).toBeNull();
    });

    it("only fires on exactly ['help']", () => {
        expect(getHelpFor("cat", [])).toBeNull();
        expect(getHelpFor("cat", ["a.txt", "help"])).toBeNull();
        expect(getHelpFor("cat", ["help", "extra"])).toBeNull();
    });

    it("returns null for unknown commands", () => {
        expect(getHelpFor("nope", ["help"])).toBeNull();
    });
});
