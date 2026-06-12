import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "./run";
import { USAGE } from "./bruteForceSmallPassword";
import type { CommandContext } from "../../types";

type Line = { text: string; cls?: string };
type ClickableLine = { text: string; commandToFill: string };

function buildContext(opts: { memoryUsed?: number } = {}) {
    const lines: Line[] = [];
    const clickables: ClickableLine[] = [];
    const memory = { total: 512, used: opts.memoryUsed ?? 0 };

    const context = {
        ui: {
            writeLine: (text: string, cls?: string) => { lines.push({ text, cls }); },
            writeClickableLine: (text: string, commandToFill: string) => { clickables.push({ text, commandToFill }); },
            updateMemoryUI: () => {},
        },
        memory: {
            getMemory: () => memory,
            allocate: (amount: number) => {
                if (memory.used + amount > memory.total) return false;
                memory.used += amount;
                return true;
            },
            free: (amount: number) => { memory.used = Math.max(0, memory.used - amount); },
        },
        delay: (ms: number) => new Promise<void>(r => setTimeout(r, ms)),
    } as unknown as CommandContext;

    return { context, lines, clickables, memory };
}

describe("run", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("lists programs when called without args", async () => {
        const { context, lines, clickables } = buildContext();
        await run([], context);
        expect(lines[0].text).toBe("Programmes disponibles :");
        expect(clickables.length).toBe(3);
        expect(clickables.map(c => c.commandToFill)).toEqual([
            "run ping ",
            "run tracer ",
            "run brute-force-small-password ",
        ]);
    });

    it("rejects an unknown program", async () => {
        const { context, lines } = buildContext();
        await run(["nope"], context);
        expect(lines).toEqual([{ text: "run: programme inconnu 'nope'. Tape 'prog-list'.", cls: undefined }]);
    });

    it("runs ping: allocates 128 Mo, prints launch and done, frees memory", async () => {
        const { context, lines, memory } = buildContext();
        const promise = run(["ping"], context);
        expect(memory.used).toBe(128);
        expect(lines[0].text).toBe("Lancement de ping... (consomme 128 Mo)");
        await vi.advanceTimersByTimeAsync(5000);
        await promise;
        expect(lines[1].text).toBe("ping: terminé.");
        expect(memory.used).toBe(0);
    });

    it("refuses ping when memory is insufficient", async () => {
        const { context, lines, memory } = buildContext({ memoryUsed: 448 });
        await run(["ping"], context);
        expect(lines).toEqual([{ text: "run: mémoire insuffisante pour ping (besoin 128 Mo)", cls: undefined }]);
        expect(memory.used).toBe(448);
    });

    it("prints usage for brute-force-small-password without args", async () => {
        const { context, lines, memory } = buildContext();
        await run(["brute-force-small-password"], context);
        expect(lines).toEqual([{ text: USAGE, cls: undefined }]);
        expect(memory.used).toBe(0);
    });

    it("prints program help on 'run <program> help'", async () => {
        const { context, lines, memory } = buildContext();
        await run(["brute-force-small-password", "help"], context);
        expect(lines.length).toBeGreaterThan(1);
        expect(lines[0].text).toContain("brute-force-small-password:");
        expect(lines.map(l => l.text)).toContain(USAGE);
        expect(memory.used).toBe(0);
    });
});
