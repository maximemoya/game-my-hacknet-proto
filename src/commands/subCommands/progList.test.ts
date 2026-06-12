import { describe, expect, it } from "vitest";
import { progList } from "./progList";
import type { CommandContext } from "../../types";

describe("progList", () => {
    it("lists the installed programs with RAM cost, clickable to run them", async () => {
        const lines: string[] = [];
        const clickables: { text: string; commandToFill: string }[] = [];
        const context = {
            ui: {
                writeLine: (text: string) => { lines.push(text); },
                writeClickableLine: (text: string, commandToFill: string) => { clickables.push({ text, commandToFill }); },
            },
        } as unknown as CommandContext;

        await progList([], context);

        expect(lines[0]).toBe("Programmes installes :");
        expect(clickables.length).toBe(3);
        expect(clickables[0].text).toContain("ping");
        expect(clickables[0].text).toContain("128 Mo");
        expect(clickables[1].text).toContain("tracer");
        expect(clickables[1].text).toContain("256 Mo");
        expect(clickables[2].text).toContain("brute-force-small-password");
        expect(clickables[2].commandToFill).toBe("run brute-force-small-password ");
        expect(lines[lines.length - 1]).toContain("run <programme> help");
    });
});
