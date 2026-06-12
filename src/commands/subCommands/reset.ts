import type { Command } from "../../types";
import { backgroundPrograms } from "../../programs/backgroundPrograms";

export const reset: Command = async (_args, context) => {
    backgroundPrograms.cancelAll();
    context.memory.reset();
    context.ui.updateMemoryUI(context.memory.getMemory());
    await context.db.delete("fs");
    await context.db.delete("memory");
    context.ui.writeLine("Reset: FS remis par défaut et IndexedDB nettoyée.");
};
