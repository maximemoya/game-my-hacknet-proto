import type { Command } from "../../types";

export const whoami: Command = async (_args, context) => context.ui.writeLine(context.fs.getCurrentComputer().authority);
