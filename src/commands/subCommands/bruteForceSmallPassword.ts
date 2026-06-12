import type { CommandContext } from "../../types";
import { BackgroundProgramManager, backgroundPrograms, pickBruteForceDurationMs } from "../../programs/backgroundPrograms";

const RAM_COST = 256;
const PROGRAM_NAME = "brute-force-small-password";
export const USAGE = `Usage: run ${PROGRAM_NAME} <ip> <name> | run ${PROGRAM_NAME} auth <user|admin>`;

export async function runBruteForceSmallPassword(
    args: string[],
    context: CommandContext,
    deps: { manager?: BackgroundProgramManager; pickDurationMs?: () => number } = {}
): Promise<void> {
    const manager = deps.manager ?? backgroundPrograms;
    const pickDurationMs = deps.pickDurationMs ?? pickBruteForceDurationMs;

    let targetLabel: string;
    let getPassword: () => string;
    let formatResult: (pwd: string | null) => string;

    if (args[0] === "auth") {
        const authType = args[1];
        if (authType !== "user" && authType !== "admin") {
            return context.ui.writeLine(USAGE);
        }
        const computer = context.fs.getCurrentComputer();
        getPassword = () => authType === "user" ? computer.passwordAuthUser : computer.passwordAuthAdmin;
        if (getPassword() === "") {
            return context.ui.writeLine(`${PROGRAM_NAME}: auth:${authType} sans mot de passe, rien à cracker`);
        }
        targetLabel = `auth:${authType}`;
        formatResult = (pwd) => pwd !== null
            ? `${PROGRAM_NAME}: ${authType} ${pwd}`
            : `${PROGRAM_NAME}: ${authType} failed !`;
    } else {
        const ip = args[0];
        const name = args[1];
        if (!ip || !name) {
            return context.ui.writeLine(USAGE);
        }
        const entry = context.network.scanResults.find(e => e.ip === ip && e.name === name);
        if (!entry) {
            return context.ui.writeLine(`${PROGRAM_NAME}: cible inconnue, lance 'scan' d'abord`);
        }
        if (context.network.scanSourceIp !== context.fs.getCurrentComputer().addressIp) {
            return context.ui.writeLine("scan results are stale (scanned from another host), run 'scan' again");
        }
        const target = context.fs.getCurrentComputer().computersLinked.find(c => c.addressIp === ip && c.name === name);
        if (!target) {
            return context.ui.writeLine(`${PROGRAM_NAME}: cible inconnue, lance 'scan' d'abord`);
        }
        if (target.password === "") {
            return context.ui.writeLine(`${PROGRAM_NAME}: ${ip} ${name} est OPEN, aucun mot de passe à cracker`);
        }
        getPassword = () => target.password;
        targetLabel = `${ip} ${name}`;
        formatResult = (pwd) => pwd !== null
            ? `${PROGRAM_NAME}: ${ip} ${name} ${pwd}`
            : `${PROGRAM_NAME}: ${ip} ${name} failed !`;
    }

    if (!context.memory.allocate(RAM_COST)) {
        return context.ui.writeLine(`run: mémoire insuffisante pour ${PROGRAM_NAME} (besoin ${RAM_COST} Mo)`);
    }
    context.ui.updateMemoryUI(context.memory.getMemory());

    const durationMs = pickDurationMs();
    manager.start({
        name: PROGRAM_NAME,
        targetLabel,
        ram: RAM_COST,
        durationMs,
        onComplete: () => {
            const pwd = getPassword();
            const success = pwd.length < 8;
            context.ui.writeLine(formatResult(success ? pwd : null), success ? "bf-success" : "bf-fail");
            context.memory.free(RAM_COST);
            context.ui.updateMemoryUI(context.memory.getMemory());
        },
    });
    context.ui.writeLine(`Lancement de ${PROGRAM_NAME} sur ${targetLabel}... (consomme ${RAM_COST} Mo, durée estimée ${Math.round(durationMs / 1000)}s)`);
}
