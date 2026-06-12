import type { Command } from "../../types";

export const disconnect: Command = async (_args, context) => {
    context.ui.writeLine(`disconnecting...`);
    await context.delay(Math.random() * 1000 + 500);
    context.network.isConnected = false;
    context.fs.setCurrentComputer(context.fs.getOwnerComputer());
    context.fs.getCurrentComputer().authority = "admin";
    context.ui.updatePrompt(context.getPromptToUpdate(), context.network.isCurrentlyConnected(), context.fs.getCurrentComputer().authority);
    context.ui.updateConnectionBadge(false);
    context.ui.writeLine(`disconnect succeed, you are now back to ${context.fs.getCurrentComputer().addressIp} ${context.fs.getCurrentComputer().name} => ${context.fs.getCurrentFolder().name}`);
    return;
};
