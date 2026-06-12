import type { Command } from "../../types";

export const scan: Command = async (_args, context) => {
    context.ui.writeLine("Scanning network...");
    const computersLinked = context.fs.getCurrentComputer().computersLinked;
    context.network.scanResults = [];
    context.network.scanSourceIp = context.fs.getCurrentComputer().addressIp;
    if (computersLinked.length === 0) {
      await context.delay(500);
      context.ui.writeLine(`none`);
    }
    const indexWidth = String(computersLinked.length).length + 2;
    const nameWidth = Math.max(4, ...computersLinked.map(c => c.name.length));
    let index = 1;
    for (const computer of computersLinked) {
      await context.delay(Math.random() * 500 + 250);
      context.network.scanResults.push({
        ip: computer.addressIp,
        name: computer.name,
        passwordRequired: computer.password !== "",
      });
      const sessions = context.sim.getSessions().filter(s => s.machineIp === computer.addressIp);
      const userMark = sessions.length > 0 ? `  [user: ${sessions.map(s => s.npcName).join(",")}]` : "";
      context.ui.writeClickableLine(
        `${`[${index}]`.padEnd(indexWidth + 2)}${computer.addressIp.padEnd(17)}${computer.name.padEnd(nameWidth + 2)}auth: ${(computer.password ? "LOCKED" : "OPEN").padEnd(8)}links: ${computer.computersLinked.length}${userMark}`,
        `connect ${computer.addressIp} ${computer.name}`
      );
      index++;
    }
    context.ui.writeLine(`Scanning network completed`);
};
