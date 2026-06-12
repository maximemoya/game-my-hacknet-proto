import type { Command } from "../../types";
import { commandHelp } from "../commandHelp";

export const help: Command = async (_args, context) => {
    const names = Object.keys(commandHelp);
    const nameWidth = Math.max(...names.map(n => n.length)) + 2;
    context.ui.writeLine("Commandes :");
    for (const name of names) {
        context.ui.writeClickableLine(`${name.padEnd(nameWidth)}${commandHelp[name].summary}`, `${name} `);
    }
    context.ui.writeLine("Tape '<commande> help' pour le detail d'une commande.");
    context.ui.writeLine("Tape 'prog-list' pour la liste des programmes.");
};
