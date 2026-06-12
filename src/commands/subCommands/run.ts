import type { Command } from "../../types";

export const run: Command = async (args, context) => {
  const tool = args[0] ?? "";
  if (tool === "" || (tool !== "ping" && tool !== "tracer")) {
    return context.ui.writeLine(`Error run commande inconnue`);
  }
  const memCost = tool === "tracer" ? 256 : 128;
  if (!context.memory.allocate(memCost)) {
    return context.ui.writeLine(`run: mémoire insuffisante pour ${tool} (besoin ${memCost} Mo)`);
  }
  context.ui.writeLine(`Lancement de ${tool}... (consomme ${memCost} Mo)`);
  context.ui.updateMemoryUI(context.memory.getMemory());
  await context.delay(1500 + Math.random() * 2500);
  context.ui.writeLine(`${tool}: terminé.`);
  context.memory.free(memCost);
  context.ui.updateMemoryUI(context.memory.getMemory());
};
