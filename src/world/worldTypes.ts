import type { Authority } from "../computer/authority/Authority";

export type FileDef = { name: string; content: string; authority?: Authority };

export type FolderDef = {
  name: string;
  authority?: Authority;
  files?: FileDef[];
};

export type KeyMachineDef = {
  name: string;
  ipSuffix: number;
  password?: string;
  passwordAuthUser?: string;
  passwordAuthAdmin?: string;
  files?: FileDef[];
  folders?: FolderDef[];
  gatewayTo?: string;
  entry?: boolean;
  owner?: boolean;
};

export type ZoneTheme = {
  machineNames: string[];
  fileTemplates: { name: string; content: string }[];
};

export type ZoneDef = {
  id: string;
  ipBase: string;
  fillerCount: [number, number];
  theme: ZoneTheme;
  keyMachines: KeyMachineDef[];
};
