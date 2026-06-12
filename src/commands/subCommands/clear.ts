import type { Command } from "../../types";

export const clear: Command = async (_args, context) => {
    context.ui.clearOutput();
};
