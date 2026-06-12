import { authorityCompare } from "../../computer/authority/Authority";
import type { Command } from "../../types";

export const cat: Command = async (args, context) => {
    const path = args[0];
    if (!path) return context.ui.writeLine("Usage: cat <file>");
    const currentFolder = context.fs.getCurrentFolder();
    if (currentFolder.files && currentFolder.files.length > 0) {
      const file = currentFolder.files?.find(file => file.name === path);
      if (file) {
        if (authorityCompare(context.fs.getCurrentComputer().authority, file.accessAuthorityLevel)) {
          context.ui.writeLine(file.content);
          return;
        }
      }
    }
    context.ui.writeLine(`error : file does not exist with name "` + path + `"`);
    return;
};
