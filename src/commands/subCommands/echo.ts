import type { Command } from "../../types";

export const echo: Command = async (args, context) => context.ui.writeLine(args.join(" "));
