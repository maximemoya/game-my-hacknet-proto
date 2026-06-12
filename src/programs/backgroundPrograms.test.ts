import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackgroundProgramManager, pickBruteForceDurationMs } from "./backgroundPrograms";

describe("pickBruteForceDurationMs", () => {
    it("returns 60000 when rand is 0", () => {
        expect(pickBruteForceDurationMs(() => 0)).toBe(60_000);
    });

    it("returns 300000 when rand is just below 1", () => {
        expect(pickBruteForceDurationMs(() => 0.9999999)).toBe(300_000);
    });

    it("always returns a multiple of 10s between 60s and 300s", () => {
        for (let i = 0; i < 200; i++) {
            const ms = pickBruteForceDurationMs();
            expect(ms % 10_000).toBe(0);
            expect(ms).toBeGreaterThanOrEqual(60_000);
            expect(ms).toBeLessThanOrEqual(300_000);
        }
    });
});

describe("BackgroundProgramManager", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(1_000_000);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("start adds a program to the list with correct endsAt and notifies listeners", () => {
        const manager = new BackgroundProgramManager();
        let notified = 0;
        manager.onChange(() => { notified++; });

        const program = manager.start({
            name: "brute-force-small-password",
            targetLabel: "1.2.3.4 target",
            ram: 256,
            durationMs: 60_000,
            onComplete: () => {},
        });

        expect(manager.list()).toEqual([program]);
        expect(program.endsAt).toBe(1_000_000 + 60_000);
        expect(program.ram).toBe(256);
        expect(notified).toBe(1);
    });

    it("calls onComplete once and removes the program when duration elapses", () => {
        const manager = new BackgroundProgramManager();
        let completed = 0;
        let notified = 0;
        manager.onChange(() => { notified++; });

        manager.start({
            name: "brute-force-small-password",
            targetLabel: "1.2.3.4 target",
            ram: 256,
            durationMs: 60_000,
            onComplete: () => { completed++; },
        });

        vi.advanceTimersByTime(59_999);
        expect(completed).toBe(0);
        vi.advanceTimersByTime(1);
        expect(completed).toBe(1);
        expect(manager.list()).toEqual([]);
        expect(notified).toBe(2);

        vi.advanceTimersByTime(600_000);
        expect(completed).toBe(1);
    });

    it("runs concurrent programs independently", () => {
        const manager = new BackgroundProgramManager();
        const done: string[] = [];

        manager.start({ name: "a", targetLabel: "x", ram: 256, durationMs: 60_000, onComplete: () => done.push("a") });
        manager.start({ name: "b", targetLabel: "y", ram: 256, durationMs: 120_000, onComplete: () => done.push("b") });

        expect(manager.list().length).toBe(2);
        vi.advanceTimersByTime(60_000);
        expect(done).toEqual(["a"]);
        expect(manager.list().length).toBe(1);
        expect(manager.list()[0].name).toBe("b");
        vi.advanceTimersByTime(60_000);
        expect(done).toEqual(["a", "b"]);
        expect(manager.list()).toEqual([]);
    });

    it("cancelAll empties the list and never calls onComplete", () => {
        const manager = new BackgroundProgramManager();
        let completed = 0;
        let notified = 0;
        manager.onChange(() => { notified++; });

        manager.start({ name: "a", targetLabel: "x", ram: 256, durationMs: 60_000, onComplete: () => { completed++; } });
        manager.cancelAll();

        expect(manager.list()).toEqual([]);
        expect(notified).toBe(2);
        vi.advanceTimersByTime(600_000);
        expect(completed).toBe(0);
    });
});
