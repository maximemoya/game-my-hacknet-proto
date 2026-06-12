import { authorityCompare } from "../../computer/authority/Authority";
import type { Command } from "../../types";
import type { Folder } from "../../computer/elements/Folder";

export const grep: Command = async (args, context) => {
    const pattern = args.join(" ");
    if (!pattern) return context.ui.writeLine("Usage: grep <text>");
    const authority = context.fs.getCurrentComputer().authority;
    let matchCount = 0;

    const searchFolder = (folder: Folder, prefix: string) => {
      if (folder.files) {
        for (const file of folder.files) {
          if (!authorityCompare(authority, file.accessAuthorityLevel)) continue;
          file.content.split("\n").forEach((line, index) => {
            if (line.includes(pattern)) {
              context.ui.writeLine(`${prefix}${file.name}:${index + 1}: ${line}`);
              matchCount++;
            }
          });
        }
      }
      if (folder.children) {
        for (const child of folder.children) {
          if (!authorityCompare(authority, child.accessAuthorityLevel)) continue;
          searchFolder(child, `${prefix}${child.name}/`);
        }
      }
    };

    searchFolder(context.fs.getCurrentFolder(), "");
    if (matchCount === 0) context.ui.writeLine(`no match for "${pattern}"`);
};
