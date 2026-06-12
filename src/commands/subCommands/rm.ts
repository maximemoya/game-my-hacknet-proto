import { authorityCompare } from "../../computer/authority/Authority";
import type { Command } from "../../types";

export const rm: Command = async (args, context) => {
    const path = args[0];
    if (!path) return context.ui.writeLine("Usage: rm <file_or_folder>");

    const currentFolder = context.fs.getCurrentFolder();
    const currentUserAuthority = context.fs.getCurrentComputer().authority;

    const fileIndex = currentFolder.files?.findIndex(f => f.name === path) ?? -1;
    if (fileIndex !== -1 && currentFolder.files) {
      const file = currentFolder.files[fileIndex];
      if (authorityCompare(currentUserAuthority, file.accessAuthorityLevel)) {
        currentFolder.files.splice(fileIndex, 1);
        context.ui.writeLine(`File '${path}' deleted.`);
      } else {
        context.ui.writeLine(`rm: permission denied to delete file '${path}'.`);
      }
      return;
    }

    const folderIndex = currentFolder.children?.findIndex(f => f.name === path) ?? -1;
    if (folderIndex !== -1 && currentFolder.children) {
      const folder = currentFolder.children[folderIndex];
      if (authorityCompare(currentUserAuthority, folder.accessAuthorityLevel)) {
        if (!folder.children || folder.children.length === 0) {
          currentFolder.children.splice(folderIndex, 1);
          context.ui.writeLine(`Folder '${path}' and its files have been deleted.`);
        } else {
          context.ui.writeLine(`rm: failed to remove '${path}': Directory contains other directories.`);
        }
      } else {
        context.ui.writeLine(`rm: permission denied to delete folder '${path}'.`);
      }
      return;
    }

    context.ui.writeLine(`rm: cannot remove '${path}': No such file or directory.`);
};
