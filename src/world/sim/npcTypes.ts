export type Npc = {
  id: string;
  name: string;
  homeIp: string;
  zoneId: string;
};

export type NpcSession = {
  npcId: string;
  npcName: string;
  machineIp: string;
  sinceTick: number;
};

export type SimEvent = {
  kind: "connect" | "disconnect" | "file";
  npcName: string;
  machineName: string;
  machineIp: string;
  zoneId: string;
  tick: number;
  text: string;
};
