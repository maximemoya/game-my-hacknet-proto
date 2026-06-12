export type CommandHelpEntry = {
  summary: string;
  usage: string;
  details?: string[];
};

export const commandHelp: Record<string, CommandHelpEntry> = {
  help: {
    summary: "affiche la liste des commandes",
    usage: "help",
    details: ["Tape '<commande> help' pour le detail d'une commande."],
  },
  ls: {
    summary: "liste les fichiers et dossiers du dossier courant",
    usage: "ls",
  },
  pwd: {
    summary: "affiche le chemin du dossier courant",
    usage: "pwd",
  },
  cd: {
    summary: "change de dossier",
    usage: "cd <dossier> | cd ../",
    details: ["cd ../ remonte au dossier parent."],
  },
  cat: {
    summary: "affiche le contenu d'un fichier",
    usage: "cat <fichier>",
  },
  grep: {
    summary: "cherche un texte dans le dossier courant et ses sous-dossiers",
    usage: "grep <texte>",
  },
  echo: {
    summary: "affiche un texte",
    usage: "echo <texte>",
  },
  scan: {
    summary: "scanne le reseau et liste les machines accessibles",
    usage: "scan",
    details: ["Affiche ip, nom, auth (OPEN/LOCKED) et liens de chaque machine."],
  },
  connect: {
    summary: "se connecte a une machine du reseau",
    usage: "connect <ip> <name> <?password> | connect <scanIndex> <?password>",
    details: ["Lance 'scan' d'abord. <scanIndex> est le numero [n] du scan."],
  },
  disconnect: {
    summary: "se deconnecte et revient sur ta machine",
    usage: "disconnect",
  },
  changeAuth: {
    summary: "change ton niveau d'autorite sur la machine courante",
    usage: "changeAuth <admin | user | guest> <?password>",
    details: ["Les niveaux user et admin demandent souvent un mot de passe."],
  },
  run: {
    summary: "lance un programme",
    usage: "run <programme> [args]",
    details: [
      "Sans argument: liste les programmes installes (comme 'prog-list').",
      "run <programme> help affiche l'aide du programme.",
    ],
  },
  "prog-list": {
    summary: "liste les programmes installes",
    usage: "prog-list",
    details: ["Les programmes se lancent avec 'run <programme>'."],
  },
  mem: {
    summary: "affiche la memoire utilisee",
    usage: "mem",
  },
  rm: {
    summary: "supprime un fichier ou un dossier vide",
    usage: "rm <fichier_ou_dossier>",
  },
  whoami: {
    summary: "affiche ton niveau d'autorite courant",
    usage: "whoami",
  },
  who: {
    summary: "liste les utilisateurs connectes sur la machine",
    usage: "who",
  },
  clear: {
    summary: "efface l'ecran",
    usage: "clear",
  },
  save: {
    summary: "sauvegarde (en cours de developpement)",
    usage: "save",
  },
  load: {
    summary: "charge une sauvegarde (en cours de developpement)",
    usage: "load",
  },
  reset: {
    summary: "remet le jeu a zero (FS par defaut, IndexedDB nettoyee)",
    usage: "reset",
  },
};

// Commands where a literal "help" argument must reach the command itself.
export const HELP_SUFFIX_EXEMPT = ["echo"];

export function getHelpFor(name: string, args: string[]): string[] | null {
  if (args.length !== 1 || args[0] !== "help") return null;
  if (HELP_SUFFIX_EXEMPT.includes(name)) return null;
  const entry = commandHelp[name];
  if (!entry) return null;
  return [
    `${name}: ${entry.summary}`,
    `Usage: ${entry.usage}`,
    ...(entry.details ?? []),
  ];
}
