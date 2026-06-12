import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runBruteForceSmallPassword } from "./bruteForceSmallPassword";
import { BackgroundProgramManager } from "../../programs/backgroundPrograms";
import { Computer } from "../../computer/Computer";
import type { CommandContext } from "../../types";

type Line = { text: string; cls?: string };

function buildSetup(opts: {
    targetPassword?: string;
    authUser?: string;
    authAdmin?: string;
    memoryUsed?: number;
    scanned?: boolean;
    staleScan?: boolean;
} = {}) {
    const home = new Computer("10.0.0.1", "home");
    if (opts.authUser !== undefined) home.withPasswordAuthUser(opts.authUser);
    if (opts.authAdmin !== undefined) home.withPasswordAuthAdmin(opts.authAdmin);
    const target = new Computer("10.0.0.2", "target", opts.targetPassword);
    home.withComputerLinked(target);

    const lines: Line[] = [];
    const memory = { total: 512, used: opts.memoryUsed ?? 0 };

    const context = {
        fs: {
            getCurrentComputer: () => home,
        },
        ui: {
            writeLine: (text: string, cls?: string) => { lines.push({ text, cls }); },
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
        network: {
            scanResults: opts.scanned === false ? [] : [
                { ip: "10.0.0.2", name: "target", passwordRequired: (opts.targetPassword ?? "") !== "" },
            ],
            scanSourceIp: opts.staleScan ? "99.99.99.99" : "10.0.0.1",
        },
    } as unknown as CommandContext;

    return { context, lines, memory, home, target };
}

const USAGE = "Usage: run brute-force-small-password <ip> <name> | run brute-force-small-password auth <user|admin>";

describe("runBruteForceSmallPassword", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const deps = () => ({ manager: new BackgroundProgramManager(), pickDurationMs: () => 60_000 });

    it("prints usage on missing args", async () => {
        const { context, lines, memory } = buildSetup();
        await runBruteForceSmallPassword([], context, deps());
        await runBruteForceSmallPassword(["auth"], context, deps());
        await runBruteForceSmallPassword(["auth", "root"], context, deps());
        await runBruteForceSmallPassword(["10.0.0.2"], context, deps());
        expect(lines.map(l => l.text)).toEqual([USAGE, USAGE, USAGE, USAGE]);
        expect(memory.used).toBe(0);
    });

    it("refuses a target absent from scan results", async () => {
        const { context, lines, memory } = buildSetup({ targetPassword: "abc", scanned: false });
        await runBruteForceSmallPassword(["10.0.0.2", "target"], context, deps());
        expect(lines).toEqual([{ text: "brute-force-small-password: cible inconnue, lance 'scan' d'abord", cls: undefined }]);
        expect(memory.used).toBe(0);
    });

    it("refuses stale scan results", async () => {
        const { context, lines, memory } = buildSetup({ targetPassword: "abc", staleScan: true });
        await runBruteForceSmallPassword(["10.0.0.2", "target"], context, deps());
        expect(lines).toEqual([{ text: "scan results are stale (scanned from another host), run 'scan' again", cls: undefined }]);
        expect(memory.used).toBe(0);
    });

    it("refuses an OPEN target without allocating memory", async () => {
        const { context, lines, memory } = buildSetup({ targetPassword: "" });
        await runBruteForceSmallPassword(["10.0.0.2", "target"], context, deps());
        expect(lines).toEqual([{ text: "brute-force-small-password: 10.0.0.2 target est OPEN, aucun mot de passe à cracker", cls: undefined }]);
        expect(memory.used).toBe(0);
    });

    it("refuses auth mode when auth password is empty", async () => {
        const { context, lines, memory } = buildSetup({ authUser: "" });
        await runBruteForceSmallPassword(["auth", "user"], context, deps());
        expect(lines).toEqual([{ text: "brute-force-small-password: auth:user sans mot de passe, rien à cracker", cls: undefined }]);
        expect(memory.used).toBe(0);
    });

    it("refuses when memory is insufficient", async () => {
        const { context, lines, memory } = buildSetup({ targetPassword: "abc", memoryUsed: 384 });
        const d = deps();
        await runBruteForceSmallPassword(["10.0.0.2", "target"], context, d);
        expect(lines).toEqual([{ text: "run: mémoire insuffisante pour brute-force-small-password (besoin 256 Mo)", cls: undefined }]);
        expect(memory.used).toBe(384);
        expect(d.manager.list()).toEqual([]);
    });

    it("cracks a short password on a scanned ip (green result, memory freed)", async () => {
        const { context, lines, memory } = buildSetup({ targetPassword: "abc123" });
        const d = deps();
        await runBruteForceSmallPassword(["10.0.0.2", "target"], context, d);

        expect(memory.used).toBe(256);
        expect(d.manager.list().length).toBe(1);
        expect(d.manager.list()[0].targetLabel).toBe("10.0.0.2 target");
        expect(lines.length).toBe(1);
        expect(lines[0].text).toContain("Lancement de brute-force-small-password");

        vi.advanceTimersByTime(60_000);
        expect(lines[1]).toEqual({ text: "brute-force-small-password: 10.0.0.2 target abc123", cls: "bf-success" });
        expect(memory.used).toBe(0);
        expect(d.manager.list()).toEqual([]);
    });

    it("fails on a password of 8 chars or more (red result, memory freed)", async () => {
        const { context, lines, memory } = buildSetup({ targetPassword: "longpassword123" });
        const d = deps();
        await runBruteForceSmallPassword(["10.0.0.2", "target"], context, d);

        vi.advanceTimersByTime(60_000);
        expect(lines[1]).toEqual({ text: "brute-force-small-password: 10.0.0.2 target failed !", cls: "bf-fail" });
        expect(memory.used).toBe(0);
    });

    it("cracks the current computer admin auth password", async () => {
        const { context, lines } = buildSetup({ authAdmin: "s3cret" });
        const d = deps();
        await runBruteForceSmallPassword(["auth", "admin"], context, d);

        expect(d.manager.list()[0].targetLabel).toBe("auth:admin");
        vi.advanceTimersByTime(60_000);
        expect(lines[1]).toEqual({ text: "brute-force-small-password: admin s3cret", cls: "bf-success" });
    });

    it("fails on a long user auth password", async () => {
        const { context, lines } = buildSetup({ authUser: "verylongpassword" });
        const d = deps();
        await runBruteForceSmallPassword(["auth", "user"], context, d);

        vi.advanceTimersByTime(60_000);
        expect(lines[1]).toEqual({ text: "brute-force-small-password: user failed !", cls: "bf-fail" });
    });
});
