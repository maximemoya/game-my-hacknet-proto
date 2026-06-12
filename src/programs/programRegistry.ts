import type { CommandContext } from "../types";
import { runBruteForceSmallPassword, USAGE as BRUTE_FORCE_USAGE } from "../commands/subCommands/bruteForceSmallPassword";

export type ProgramDef = {
  name: string;
  description: string;
  ramCost: number;
  usage: string;
  help: string[];
  requiresArgs: boolean;
  run: (args: string[], context: CommandContext) => Promise<void>;
};

async function runSimpleTimedProgram(name: string, ramCost: number, context: CommandContext): Promise<void> {
  if (!context.memory.allocate(ramCost)) {
    return context.ui.writeLine(`run: mémoire insuffisante pour ${name} (besoin ${ramCost} Mo)`);
  }
  context.ui.writeLine(`Lancement de ${name}... (consomme ${ramCost} Mo)`);
  context.ui.updateMemoryUI(context.memory.getMemory());
  await context.delay(1500 + Math.random() * 2500);
  context.ui.writeLine(`${name}: terminé.`);
  context.memory.free(ramCost);
  context.ui.updateMemoryUI(context.memory.getMemory());
}

export const programRegistry: Record<string, ProgramDef> = {
  ping: {
    name: "ping",
    description: "teste la connexion reseau",
    ramCost: 128,
    usage: "Usage: run ping",
    help: [
      "ping: teste la connexion reseau (128 Mo).",
      "Usage: run ping",
    ],
    requiresArgs: false,
    run: (_args, context) => runSimpleTimedProgram("ping", 128, context),
  },
  tracer: {
    name: "tracer",
    description: "trace une route sur le reseau",
    ramCost: 256,
    usage: "Usage: run tracer",
    help: [
      "tracer: trace une route sur le reseau (256 Mo).",
      "Usage: run tracer",
    ],
    requiresArgs: false,
    run: (_args, context) => runSimpleTimedProgram("tracer", 256, context),
  },
  "brute-force-small-password": {
    name: "brute-force-small-password",
    description: "crack un mot de passe court en arriere-plan",
    ramCost: 256,
    usage: BRUTE_FORCE_USAGE,
    help: [
      "brute-force-small-password: crack un mot de passe court (moins de 8 caracteres) en arriere-plan (256 Mo).",
      BRUTE_FORCE_USAGE,
      "Mode cible: run brute-force-small-password <ip> <name> (lance 'scan' d'abord).",
      "Mode auth: run brute-force-small-password auth <user|admin> (crack le mot de passe d'autorite de la machine courante).",
    ],
    requiresArgs: true,
    run: (args, context) => runBruteForceSmallPassword(args, context),
  },
};

export function printProgramList(context: CommandContext): void {
  const defs = Object.values(programRegistry);
  const nameWidth = Math.max(4, ...defs.map(d => d.name.length)) + 2;
  for (const def of defs) {
    context.ui.writeClickableLine(
      `${def.name.padEnd(nameWidth)}${`${def.ramCost} Mo`.padEnd(8)}${def.description}`,
      `run ${def.name} `
    );
  }
  context.ui.writeLine("Tape 'run <programme> help' pour le detail d'un programme.");
}
