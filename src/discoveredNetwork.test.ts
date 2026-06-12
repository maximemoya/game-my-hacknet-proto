import { describe, expect, it } from "vitest";
import { DiscoveredNetwork } from "./discoveredNetwork";
import { layoutRadial } from "./scanView";
import type { DiscoveredNode } from "./types";

const node = (ip: string, name = ip, passwordRequired = false): DiscoveredNode =>
    ({ ip, name, passwordRequired });

describe("DiscoveredNetwork", () => {
    it("upsertNode replaces an existing node with the same ip", () => {
        const net = new DiscoveredNetwork();
        net.upsertNode(node("10.0.0.1", "alpha"));
        net.upsertNode(node("10.0.0.1", "alpha", true));
        expect(net.getNodes()).toHaveLength(1);
        expect(net.getNodes()[0].passwordRequired).toBe(true);
    });

    it("keeps unlocked sticky across upserts without the flag", () => {
        const net = new DiscoveredNetwork();
        net.upsertNode({ ...node("10.0.0.1", "alpha", true), unlocked: true });
        net.upsertNode(node("10.0.0.1", "alpha", true));
        expect(net.getNodes()[0].unlocked).toBe(true);
        expect(net.isUnlocked("10.0.0.1")).toBe(true);
    });

    it("isUnlocked is false for unknown or never-unlocked nodes", () => {
        const net = new DiscoveredNetwork();
        net.upsertNode(node("10.0.0.1", "alpha", true));
        expect(net.isUnlocked("10.0.0.1")).toBe(false);
        expect(net.isUnlocked("10.0.0.9")).toBe(false);
    });

    it("addEdge dedupes regardless of direction and skips self-edges", () => {
        const net = new DiscoveredNetwork();
        net.addEdge("10.0.0.1", "10.0.0.2");
        net.addEdge("10.0.0.2", "10.0.0.1");
        net.addEdge("10.0.0.1", "10.0.0.1");
        expect(net.getEdges()).toHaveLength(1);
    });

    it("notifies listeners on new nodes and edges, not on duplicate edges", () => {
        const net = new DiscoveredNetwork();
        let notified = 0;
        net.onChange(() => { notified++; });
        net.upsertNode(node("10.0.0.1"));
        net.addEdge("10.0.0.1", "10.0.0.2");
        net.addEdge("10.0.0.2", "10.0.0.1");
        expect(notified).toBe(2);
    });
});

describe("layoutRadial", () => {
    it("places the root at the origin", () => {
        const nodes = [node("a"), node("b"), node("c")];
        const edges: [string, string][] = [["a", "b"], ["a", "c"]];
        const pos = layoutRadial(nodes, edges, "a");
        expect(pos.get("a")).toEqual({ x: 0, y: 0 });
    });

    it("positions every node and is deterministic", () => {
        const nodes = [node("a"), node("b"), node("c"), node("d"), node("e")];
        const edges: [string, string][] = [["a", "b"], ["a", "c"], ["b", "d"], ["c", "d"], ["e", "a"]];
        const first = layoutRadial(nodes, edges, "a");
        const second = layoutRadial(nodes, edges, "a");
        expect(first.size).toBe(nodes.length);
        for (const n of nodes) {
            expect(first.get(n.ip)).toEqual(second.get(n.ip));
        }
    });

    it("lays out disconnected components without overlap on the root", () => {
        const nodes = [node("a"), node("b"), node("x"), node("y")];
        const edges: [string, string][] = [["a", "b"], ["x", "y"]];
        const pos = layoutRadial(nodes, edges, "a");
        expect(pos.size).toBe(4);
        expect(pos.get("x")!.x).toBeGreaterThan(pos.get("a")!.x);
    });
});
