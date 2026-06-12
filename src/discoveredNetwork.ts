import type { DiscoveredNode, I_DiscoveredNetwork } from "./types";

export class DiscoveredNetwork implements I_DiscoveredNetwork {
  private nodes = new Map<string, DiscoveredNode>();
  private edges = new Set<string>();
  private listeners: (() => void)[] = [];

  onChange = (cb: () => void): void => {
    this.listeners.push(cb);
  };

  private notify = (): void => {
    for (const cb of this.listeners) cb();
  };

  upsertNode = (node: DiscoveredNode): void => {
    // unlocked is sticky: once the player has unlocked a node, a later
    // upsert without the flag (e.g. from scan) must not reset it
    const prev = this.nodes.get(node.ip);
    this.nodes.set(node.ip, { ...node, unlocked: node.unlocked || prev?.unlocked || false });
    this.notify();
  };

  isUnlocked = (ip: string): boolean => this.nodes.get(ip)?.unlocked ?? false;

  addEdge = (ipA: string, ipB: string): void => {
    if (ipA === ipB) return;
    const key = [ipA, ipB].sort().join("|");
    if (this.edges.has(key)) return;
    this.edges.add(key);
    this.notify();
  };

  getNodes = (): DiscoveredNode[] => [...this.nodes.values()];

  getEdges = (): [string, string][] =>
    [...this.edges].map(key => key.split("|") as [string, string]);
}
