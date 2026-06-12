import type { Command } from "../types";
import { changeAuth } from "./subCommands/changeAuth";
import { help } from "./subCommands/help";
import { ls } from "./subCommands/ls";
import { pwd } from "./subCommands/pwd";
import { cd } from "./subCommands/cd";
import { cat } from "./subCommands/cat";
import { echo } from "./subCommands/echo";
import { whoami } from "./subCommands/whoami";
import { clear } from "./subCommands/clear";
import { mem } from "./subCommands/mem";
import { scan } from "./subCommands/scan";
import { connect } from "./subCommands/connect";
import { disconnect } from "./subCommands/disconnect";
import { run } from "./subCommands/run";
import { rm } from "./subCommands/rm";
import { save } from "./subCommands/save";
import { load } from "./subCommands/load";
import { reset } from "./subCommands/reset";

export const commands: Record<string, Command> = {
  changeAuth,
  help,
  ls,
  pwd,
  cd,
  cat,
  echo,
  whoami,
  clear,
  mem,
  scan,
  connect,
  disconnect,
  run,
  rm,
  save,
  load,
  reset,
};