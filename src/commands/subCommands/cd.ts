import { authorityCompare } from "../../computer/authority/Authority";
import type { Command } from "../../types";

export const cd: Command = async (args, context) => {
    const path = args[0];
    if (!path) return context.ui.writeLine("Usage: cd <folder> or ../");
    const currentFolder = context.fs.getCurrentFolder();
    if (path === "../") {
      if (currentFolder.parent) {
        context.fs.setCurrentFolder(currentFolder.parent);
        context.ui.writeLine(`currentFolder : ` + currentFolder.parent.name);
        context.ui.updatePrompt(context.getPromptToUpdate(), context.network.isCurrentlyConnected(), context.fs.getCurrentComputer().authority);
        return;
      }
      context.ui.writeLine(`error : no parent folder.`);
      return;
    }
    const childFolder = currentFolder.children?.find(folder => folder.name === path);
    if (childFolder) {
      if (authorityCompare(context.fs.getCurrentComputer().authority, childFolder.accessAuthorityLevel)) {
        context.fs.setCurrentFolder(childFolder);
        context.ui.writeLine(`currentFolder : ` + childFolder.name);
        context.ui.updatePrompt(context.getPromptToUpdate(), context.network.isCurrentlyConnected(), context.fs.getCurrentComputer().authority);
        return;
      }
    }
    context.ui.writeLine(`error : folder does not exist with name "` + path + `"`);
    return;
};
