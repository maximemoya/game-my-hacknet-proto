import type { Command } from "../../types";

export const connect: Command = async (args, context) => {
    let ip = args[0];
    let name = args[1];
    let password = args[2] ? args[2] : "";
    if (ip && /^\d+$/.test(ip) && !args[2]) {
      const entry = context.network.scanResults[parseInt(ip, 10) - 1];
      if (!entry) return context.ui.writeLine(`no scan result [${ip}], run 'scan' first`);
      if (context.network.scanSourceIp !== context.fs.getCurrentComputer().addressIp)
        return context.ui.writeLine("scan results are stale (scanned from another host), run 'scan' again");
      ip = entry.ip;
      name = entry.name;
      password = args[1] ? args[1] : "";
    }
    if (!ip || !name) return context.ui.writeLine("Usage: connect <ip> <name> <?password> | connect <scanIndex> <?password>");

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
