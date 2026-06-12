import type { Command } from "../../types";
import { printProgramList, programRegistry } from "../../programs/programRegistry";

export const run: Command = async (args, context) => {
  const tool = args[0] ?? "";
  if (tool === "") {
    context.ui.writeLine("Programmes disponibles :");
    return printProgramList(context);
  }
  const def = programRegistry[tool];
  if (!def) {
    return context.ui.writeLine(`run: programme inconnu '${tool}'. Tape 'prog-list'.`);
  }
  if (args[1] === "help") {
    for (const line of def.help) context.ui.writeLine(line);
    return;
  }
  if (def.requiresArgs && args.length === 1) {
    return context.ui.writeLine(def.usage);
  }
  return def.run(args.slice(1), context);
};
