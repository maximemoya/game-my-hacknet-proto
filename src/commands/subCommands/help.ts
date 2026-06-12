import type { Command } from "../../types";

export const help: Command = async (_args, context) => {
    context.ui.writeLine("Commandes: help, ls, cat, pwd, cd, echo, scan, connect, disconnect, rm, changeAuth, run, mem, clear, whoami, who, save, load, reset");
    context.ui.writeLine("Ex: ls, cat readme.txt, cd /home, scan, connect <1.2.0.7> <name> <?password>, changeAuth <admin | user | guest> <?password>, run tracer, who (sessions sur la machine), save/load fs (IndexedDB)");
};
