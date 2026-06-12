import type { Command } from "../../types";

export const mem: Command = async (_args, context) => {
    const mem = context.memory.getMemory();
    context.ui.writeLine(`Memory: ${mem.used}/${mem.total} Mo used`);
};
