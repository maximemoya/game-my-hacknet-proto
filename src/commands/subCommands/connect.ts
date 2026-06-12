import type { Command } from "../../types";

export const connect: Command = async (args, context) => {
    const ip = args[0];
    const name = args[1];
    const password = args[2] ? args[2] : "";
    if (!ip || !name) return context.ui.writeLine("Usage: connect <ip> <name> <?password>");

    context.ui.writeLine(`try to connect to ${args} ...`);
    await context.delay(500);

    const sourceIp = context.fs.getCurrentComputer().addressIp;
    const newCurrentComputer = context.fs.getCurrentComputer().computersLinked.find(c => c.addressIp === ip && c.name === name && ((c.password) ? c.password === password : true));

    if (!newCurrentComputer) {
      context.ui.writeLine(`connexion to ${args} failed, please check ip and name by using scan or maybe you have wrong password `);
      return;
    }

    let varFolder = newCurrentComputer.mainFolder.children?.find(f => f.name === 'var');
    if (!varFolder) {
      varFolder = new (await import('../../computer/elements/Folder')).Folder("var", "admin");
      newCurrentComputer.mainFolder.withChildFolder(varFolder);
    }

    let logFolder = varFolder.children?.find(f => f.name === 'log');
    if (!logFolder) {
      logFolder = new (await import('../../computer/elements/Folder')).Folder("log", "admin");
      varFolder.withChildFolder(logFolder);
    }

    let logFile = logFolder.files?.find(f => f.name === 'connections.log');
    if (!logFile) {
      logFile = new (await import('../../computer/elements/File')).default("connections.log", "[LOGS STARTED]\n", "user");
      if (!logFolder.files) {
        logFolder.files = [];
      }
      logFolder.files.push(logFile);
    }

    const timestamp = new Date().toISOString();
    const logEntry = `\n[${timestamp}] Connection received from ${sourceIp}`;
    logFile.content += logEntry;

    context.network.isConnected = true;
    context.fs.setCurrentComputer(newCurrentComputer);
    context.fs.getCurrentComputer().authority = "guest";
    context.ui.updatePrompt(context.getPromptToUpdate(), context.network.isCurrentlyConnected(), context.fs.getCurrentComputer().authority);
    context.ui.updateConnectionBadge(true);
    context.ui.writeLine(`connexion succeed, you are now connected to ${context.fs.getCurrentComputer().addressIp} ${context.fs.getCurrentComputer().name} => ${context.fs.getCurrentFolder().name}`);
    return;
};
