import type { ZoneDef } from "./worldTypes";

export const WORLD_SEED = 1337;

export const ZONES: ZoneDef[] = [
  {
    id: "home",
    ipBase: "192.168.0",
    fillerCount: [4, 6],
    theme: {
      machineNames: ["bob-pc", "fry-box", "mey-laptop", "dan-srv", "printer", "nas-box", "cam-front", "pi-zero"],
      fileTemplates: [
        { name: "notes.txt", content: "penser a changer le mot de passe du wifi" },
        { name: "todo.txt", content: "acheter cable ethernet\nsauvegarder les photos" },
        { name: "boot.log", content: "[OK] system started\n[OK] network up" },
      ],
    },
    keyMachines: [
      {
        name: "wax",
        ipSuffix: 42,
        owner: true,
        password: "",
        passwordAuthUser: "user",
        passwordAuthAdmin: "admin",
        files: [
          {
            name: "tutorial.txt",
            content: [
              "=== TUTORIEL ===",
              "",
              "Bienvenue. Tu es sur ta machine, 'wax'. Le but : explorer le reseau,",
              "t'introduire sur des machines et monter en autorite pour lire leurs secrets.",
              "",
              "1. LES BASES",
              "   help                  liste toutes les commandes",
              "   <commande> help       detail d'une commande (ex: scan help)",
              "   ls, cat <fichier>     lister et lire les fichiers (ex: cat readme_network.txt)",
              "   cd <dossier>, cd ../  naviguer dans les dossiers",
              "",
              "2. LE RESEAU",
              "   scan                  liste les machines accessibles depuis ici",
              "   connect <ip> <name>   se connecter (ajoute le mot de passe si LOCKED)",
              "   disconnect            revenir sur ta machine",
              "",
              "3. LES PROGRAMMES",
              "   prog-list             liste les programmes installes (RAM, description)",
              "   run <programme>       lance un programme ('run' seul liste aussi)",
              "   run <programme> help  detail d'un programme",
              "   mem                   memoire utilisee (les programmes consomment de la RAM)",
              "   Une machine LOCKED ? run brute-force-small-password <ip> <name>",
              "",
              "4. L'AUTORITE",
              "   Sur chaque machine tu es guest, user ou admin (whoami pour verifier).",
              "   Certains fichiers et dossiers demandent un niveau superieur.",
              "   changeAuth <user|admin> <?password> pour monter en autorite.",
              "   Pas le mot de passe ? run brute-force-small-password auth <user|admin>",
              "",
              "5. DIVERS",
              "   who                   utilisateurs connectes sur la machine",
              "   grep <texte>          cherche un texte dans les fichiers",
              "   reset                 remet le jeu a zero",
              "",
              "Piste de depart : lis readme_network.txt puis lance scan.",
            ].join("\n"),
          },
          { name: "f1admin.txt", content: "le contenu du fichier admin", authority: "admin" },
          { name: "f1user.txt", content: "le contenu du fichier user", authority: "user" },
          { name: "f1guest.txt", content: "le contenu du fichier guest", authority: "guest" },
          { name: "readme_network.txt", content: "memo: le routeur du quartier 'gw-home' (192.168.0.1) accepte le mot de passe 'quartier-libre'. de la, on atteint le reseau du quartier." },
        ],
        folders: [
          {
            name: "intro",
            files: [
              { name: "readme.txt", content: "un nouveau contenu" },
              { name: "secret.txt", content: "code Bob => bob", authority: "admin" },
            ],
          },
          { name: "folderAdmin", authority: "admin" },
          { name: "folderUser", authority: "user" },
          { name: "folderGuest", authority: "guest" },
        ],
      },
      {
        name: "gw-home",
        ipSuffix: 1,
        password: "quartier-libre",
        gatewayTo: "suburb",
        files: [{ name: "routes.cfg", content: "uplink => 10.20.30.1 (cafe-router)" }],
      },
    ],
  },
  {
    id: "suburb",
    ipBase: "10.20.30",
    fillerCount: [7, 9],
    theme: {
      machineNames: ["biblio-pc1", "biblio-pc2", "shop-pos", "kiosk", "school-lab", "mairie-srv", "garage-pc", "radio-node", "atm-04", "cyber-cafe"],
      fileTemplates: [
        { name: "mail.txt", content: "re: reunion de quartier jeudi 18h, salle B" },
        { name: "caisse.log", content: "ticket #2231 ... 12.50 EUR\nticket #2232 ... 4.00 EUR" },
        { name: "agenda.txt", content: "lundi: livraison\nmardi: inventaire" },
      ],
    },
    keyMachines: [
      {
        name: "cafe-router",
        ipSuffix: 1,
        entry: true,
        files: [{ name: "welcome.txt", content: "hotspot du cafe - usage public" }],
      },
      {
        name: "biblio-srv",
        ipSuffix: 10,
        files: [
          { name: "mail_admin.txt", content: "IT: la passerelle AuroraCorp 'corp-uplink' (10.20.30.254) a ete reconfiguree, mot de passe 'aurora-gate-7'. merci de ne pas diffuser." },
        ],
      },
      {
        name: "corp-uplink",
        ipSuffix: 254,
        password: "aurora-gate-7",
        gatewayTo: "corp",
        files: [{ name: "uplink.cfg", content: "tunnel => 172.16.40.1 (aur-entry)" }],
      },
    ],
  },
  {
    id: "corp",
    ipBase: "172.16.40",
    fillerCount: [7, 9],
    theme: {
      machineNames: ["aur-ws-01", "aur-ws-02", "aur-ws-03", "aur-print", "aur-mail2", "aur-build", "aur-hr", "aur-dev1", "aur-dev2", "aur-backup"],
      fileTemplates: [
        { name: "standup.txt", content: "hier: refacto module paie\naujourd'hui: revue de code" },
        { name: "build.log", content: "[BUILD] aurora-core v2.4.1 ... OK (312s)" },
        { name: "memo_rh.txt", content: "rappel: badges obligatoires en zone serveur" },
      ],
    },
    keyMachines: [
      {
        name: "aur-entry",
        ipSuffix: 1,
        entry: true,
        files: [{ name: "motd.txt", content: "AuroraCorp - acces reserve au personnel" }],
      },
      {
        name: "aur-mail",
        ipSuffix: 25,
        files: [
          { name: "ticket_4112.txt", content: "ticket #4112: acces datacenter Helios via 'dc-uplink' (172.16.40.254). mot de passe temporaire 'helios-cooling-9', a changer avant vendredi." },
          { name: "direction.txt", content: "note interne direction: le projet Obsidian est confidentiel.", authority: "admin" },
        ],
      },
      {
        name: "dc-uplink",
        ipSuffix: 254,
        password: "helios-cooling-9",
        gatewayTo: "datacenter",
        files: [{ name: "uplink.cfg", content: "tunnel => 10.99.0.1 (dc-entry)" }],
      },
    ],
  },
  {
    id: "datacenter",
    ipBase: "10.99.0",
    fillerCount: [6, 8],
    theme: {
      machineNames: ["dc-rack-a1", "dc-rack-a2", "dc-rack-b1", "dc-cool-ctl", "dc-power-ctl", "dc-mon", "dc-tape", "dc-fw"],
      fileTemplates: [
        { name: "sensors.log", content: "temp rack A: 21.4C\ntemp rack B: 22.1C" },
        { name: "uptime.log", content: "up 412 days, load 0.42" },
        { name: "maint.txt", content: "maintenance planifiee dimanche 03:00" },
      ],
    },
    keyMachines: [
      {
        name: "dc-entry",
        ipSuffix: 1,
        entry: true,
        files: [
          { name: "motd.txt", content: "Helios Datacenter - zone restreinte" },
          { name: "maint_note.txt", content: "pour la maintenance du coffre 'dc-vault' (10.99.0.99): mot de passe 'obsidian'" },
        ],
      },
      {
        name: "dc-vault",
        ipSuffix: 99,
        password: "obsidian",
        passwordAuthAdmin: "root-obsidian",
        files: [
          { name: "vault_readme.txt", content: "coffre numerique - acces admin requis pour le contenu" },
          { name: "obsidian.dat", content: "PROJET OBSIDIAN - vous avez atteint le bout du reseau. felicitations.", authority: "admin" },
        ],
      },
    ],
  },
];
