import { authorityCompare } from "../../computer/authority/Authority";
import type { Command } from "../../types";

export const ls: Command = async (_args, context) => {
    const currentFolder = context.fs.getCurrentFolder();
    const names: String[] = [];
    if (currentFolder.files) {
      names.push(...currentFolder.files.filter(
        file => authorityCompare(context.fs.getCurrentComputer().authority, file.accessAuthorityLevel)
      ).map(f => f.name));
    }
    if (currentFolder.children) {
      names.push(...currentFolder.children.filter(
        folder => authorityCompare(context.fs.getCurrentComputer().authority, folder.accessAuthorityLevel)
      ).map(f => f.name));
    }
    context.ui.writeLine(names.join("  ") || "");
};
