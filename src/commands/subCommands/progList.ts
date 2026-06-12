import type { Command } from "../../types";
import { printProgramList } from "../../programs/programRegistry";

export const progList: Command = async (_args, context) => {
    context.ui.writeLine("Programmes installes :");
    printProgramList(context);
};
