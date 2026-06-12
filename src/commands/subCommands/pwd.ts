import type { Command } from "../../types";

export const pwd: Command = async (_args, context) => context.ui.writeLine(context.fs.getCurrentFolder().fullPathName);
