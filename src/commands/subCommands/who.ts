import type { Command } from "../../types";

export const who: Command = async (_args, context) => {
  const ip = context.fs.getCurrentComputer().addressIp;
  const sessions = context.sim.getSessions().filter((s) => s.machineIp === ip);
  if (sessions.length === 0) {
    context.ui.writeLine("aucun utilisateur connecte.");
    return;
  }
  for (const s of sessions) {
    context.ui.writeLine(`${s.npcName.padEnd(12)} depuis tick ${s.sinceTick}`);
  }
};
