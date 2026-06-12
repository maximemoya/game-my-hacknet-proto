import type { Command } from "../../types";

export const scan: Command = async (_args, context) => {
    context.ui.writeLine("Scanning network...");
    const computersLinked = context.fs.getCurrentComputer().computersLinked;
    if (computersLinked.length === 0) {
      await context.delay(500);
      context.ui.writeLine(`none`);
    }
    for (const computer of computersLinked) {
      await context.delay(Math.random() * 500 + 250);
      context.ui.writeLine(`${computer.addressIp}	${computer.name}`);
    }
    context.ui.writeLine(`Scanning network completed`);
};
