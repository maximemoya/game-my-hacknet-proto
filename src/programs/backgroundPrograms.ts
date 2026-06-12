export type ActiveProgram = {
    id: number;
    name: string;
    targetLabel: string;
    ram: number;
    endsAt: number;
};

export type StartOptions = {
    name: string;
    targetLabel: string;
    ram: number;
    durationMs: number;
    onComplete: () => void;
};

export class BackgroundProgramManager {
    private programs: ActiveProgram[] = [];
    private timers = new Map<number, ReturnType<typeof setTimeout>>();
    private listeners: (() => void)[] = [];
    private nextId = 1;

    start = (opts: StartOptions): ActiveProgram => {
        const program: ActiveProgram = {
            id: this.nextId++,
            name: opts.name,
            targetLabel: opts.targetLabel,
            ram: opts.ram,
            endsAt: Date.now() + opts.durationMs,
        };
        this.programs.push(program);
        this.timers.set(program.id, setTimeout(() => {
            this.programs = this.programs.filter(p => p.id !== program.id);
            this.timers.delete(program.id);
            opts.onComplete();
            this.notify();
        }, opts.durationMs));
        this.notify();
        return program;
    };

    list = (): readonly ActiveProgram[] => this.programs;

    onChange = (cb: () => void): void => {
        this.listeners.push(cb);
    };

    cancelAll = (): void => {
        for (const timer of this.timers.values()) clearTimeout(timer);
        this.timers.clear();
        this.programs = [];
        this.notify();
    };

    private notify(): void {
        for (const cb of this.listeners) cb();
    }
}

export const backgroundPrograms = new BackgroundProgramManager();

export function pickBruteForceDurationMs(rand: () => number = Math.random): number {
    return (6 + Math.floor(rand() * 25)) * 10_000;
}
