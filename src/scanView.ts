import type { DiscoveredNode, I_DiscoveredNetwork } from "./types";

type Pos = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };

const SVG_NS = "http://www.w3.org/2000/svg";
const RING = 90;
const NODE_RADIUS = 12;

export function layoutRadial(
  nodes: DiscoveredNode[],
  edges: [string, string][],
  rootIp: string
): Map<string, Pos> {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.ip, []);
  for (const [a, b] of edges) {
    adj.get(a)?.push(b);
    adj.get(b)?.push(a);
  }
  for (const list of adj.values()) list.sort();

  const pos = new Map<string, Pos>();
  const visited = new Set<string>();
  const roots = [rootIp, ...nodes.map(n => n.ip)];
  let componentOffsetX = 0;

  for (const start of roots) {
    if (visited.has(start) || !adj.has(start)) continue;

    // BFS tree of this component (tree edges drive positions; extra edges drawn anyway)
    const children = new Map<string, string[]>();
    const order: string[] = [];
    visited.add(start);
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift()!;
      order.push(cur);
      children.set(cur, []);
      for (const nb of adj.get(cur)!) {
        if (!visited.has(nb)) {
          visited.add(nb);
          children.get(cur)!.push(nb);
          queue.push(nb);
        }
      }
    }

    // leaf counts bottom-up
    const leaves = new Map<string, number>();
    for (let i = order.length - 1; i >= 0; i--) {
      const kids = children.get(order[i])!;
      leaves.set(order[i], kids.length === 0 ? 1 : kids.reduce((s, k) => s + leaves.get(k)!, 0));
    }

    // angular span proportional to leaf count; node sits at span center
    const span = new Map<string, [number, number]>([[start, [0, Math.PI * 2]]]);
    const depth = new Map<string, number>([[start, 0]]);
    let maxDepth = 0;
    for (const cur of order) {
      const [a0, a1] = span.get(cur)!;
      const mid = (a0 + a1) / 2;
      const d = depth.get(cur)!;
      maxDepth = Math.max(maxDepth, d);
      pos.set(cur, {
        x: componentOffsetX + Math.cos(mid) * d * RING,
        y: Math.sin(mid) * d * RING,
      });
      let a = a0;
      const total = leaves.get(cur)!;
      for (const ch of children.get(cur)!) {
        const w = (leaves.get(ch)! / total) * (a1 - a0);
        span.set(ch, [a, a + w]);
        depth.set(ch, d + 1);
        a += w;
      }
    }
    componentOffsetX += 2 * (maxDepth + 1) * RING + RING;
  }
  return pos;
}

export interface ScanViewOptions {
  container: HTMLElement;
  discovered: I_DiscoveredNetwork;
  getCurrentIp: () => string;
  getOwnerIp: () => string;
  onNodeAction: (node: DiscoveredNode) => void;
  onScan: () => Promise<void>;
}

const MIN_ZOOM = 4; // view may be at most 4x wider than fit (zoomed out)
const MAX_ZOOM = 8; // view may be at most 8x narrower than fit (zoomed in)
const DRAG_THRESHOLD = 4;

export class ScanView {
  private dirty = true;
  private visible = false;
  private tooltip: HTMLDivElement;
  private opts: ScanViewOptions;
  // null = auto-fit to graph bounds; set once the user zooms or pans
  private view: Box | null = null;
  private fitBox: Box = { x: 0, y: 0, w: 1, h: 1 };
  private svg: SVGSVGElement | null = null;
  private positions = new Map<string, Pos>();
  private scanning = false;

  constructor(opts: ScanViewOptions) {
    this.opts = opts;
    this.tooltip = document.createElement("div");
    this.tooltip.className = "scanTooltip";
    this.tooltip.hidden = true;
    opts.discovered.onChange(() => this.markDirty());
  }

  show = (): void => {
    this.visible = true;
    if (this.dirty) this.render();
    this.focusCurrentNode();
  };

  // center the view on the current computer at normal (fit-level) zoom
  private focusCurrentNode = (): void => {
    const p = this.positions.get(this.opts.getCurrentIp());
    if (!p || !this.svg) return;
    const { w, h } = this.fitBox;
    this.view = { x: p.x - w / 2, y: p.y - h / 2, w, h };
    this.applyViewBox(this.svg);
  };

  hide = (): void => {
    this.visible = false;
  };

  markDirty = (): void => {
    this.dirty = true;
    if (this.visible) this.render();
  };

  private render = (): void => {
    this.dirty = false;
    const { container, discovered, getCurrentIp, getOwnerIp } = this.opts;
    container.innerHTML = "";
    this.tooltip.hidden = true;
    container.appendChild(this.tooltip);

    const nodes = discovered.getNodes();
    const edges = discovered.getEdges();
    const pos = layoutRadial(nodes, edges, getOwnerIp());
    this.positions = pos;

    const xs = [...pos.values()].map(p => p.x);
    const ys = [...pos.values()].map(p => p.y);
    const pad = 60;
    const minX = Math.min(0, ...xs) - pad;
    const minY = Math.min(0, ...ys) - pad;
    const width = Math.max(0, ...xs) + pad - minX;
    const height = Math.max(0, ...ys) + pad - minY;

    this.fitBox = { x: minX, y: minY, w: width, h: height };

    const svg = document.createElementNS(SVG_NS, "svg");
    this.svg = svg;
    this.applyViewBox(svg);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    this.attachViewControls(svg);

    for (const [a, b] of edges) {
      const pa = pos.get(a);
      const pb = pos.get(b);
      if (!pa || !pb) continue;
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("class", "scanEdge");
      line.setAttribute("x1", String(pa.x));
      line.setAttribute("y1", String(pa.y));
      line.setAttribute("x2", String(pb.x));
      line.setAttribute("y2", String(pb.y));
      svg.appendChild(line);
    }

    const currentIp = getCurrentIp();
    for (const node of nodes) {
      const p = pos.get(node.ip);
      if (!p) continue;
      const g = document.createElementNS(SVG_NS, "g");
      let cls = "scanNode";
      if (node.passwordRequired) cls += node.unlocked ? " unlocked" : " locked";
      if (node.ip === currentIp) cls += " current";
      g.setAttribute("class", cls);
      g.setAttribute("transform", `translate(${p.x}, ${p.y})`);

      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("r", String(NODE_RADIUS));
      g.appendChild(circle);

      if (node.passwordRequired) {
        const lock = document.createElementNS(SVG_NS, "text");
        lock.setAttribute("class", "nodeLock");
        lock.setAttribute("dy", "4");
        lock.textContent = "⚿";
        g.appendChild(lock);
      }

      const name = document.createElementNS(SVG_NS, "text");
      name.setAttribute("class", "nodeName");
      name.setAttribute("dy", "-19");
      name.textContent = node.name;
      g.appendChild(name);

      const ip = document.createElementNS(SVG_NS, "text");
      ip.setAttribute("class", "nodeIp");
      ip.setAttribute("dy", "27");
      ip.textContent = node.ip;
      g.appendChild(ip);

      g.addEventListener("click", () => this.opts.onNodeAction(node));
      g.addEventListener("mouseenter", (ev) => this.showTooltip(node, ev));
      g.addEventListener("mousemove", (ev) => this.moveTooltip(ev));
      g.addEventListener("mouseleave", () => { this.tooltip.hidden = true; });

      svg.appendChild(g);
    }

    container.appendChild(svg);

    const scanBtn = document.createElement("button");
    scanBtn.type = "button";
    scanBtn.className = "scanBtn";
    scanBtn.textContent = this.scanning ? "SCANNING…" : "SCAN";
    scanBtn.disabled = this.scanning;
    scanBtn.title = "scan network from current node";
    scanBtn.addEventListener("click", () => void this.runScan());
    container.appendChild(scanBtn);

    if (nodes.length <= 1) {
      const hint = document.createElement("div");
      hint.className = "scanHint";
      hint.textContent = "run 'scan' to map the network";
      container.appendChild(hint);
    }
  };

  private runScan = async (): Promise<void> => {
    if (this.scanning) return;
    this.scanning = true;
    this.markDirty();
    try {
      await this.opts.onScan();
    } finally {
      this.scanning = false;
      this.markDirty();
    }
  };

  private applyViewBox = (svg: SVGSVGElement): void => {
    const b = this.view ?? this.fitBox;
    svg.setAttribute("viewBox", `${b.x} ${b.y} ${b.w} ${b.h}`);
  };

  private clientToWorld = (svg: SVGSVGElement, clientX: number, clientY: number): Pos => {
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  private attachViewControls = (svg: SVGSVGElement): void => {
    svg.addEventListener(
      "wheel",
      (ev) => {
        ev.preventDefault();
        const cur = this.view ?? this.fitBox;
        const factor = Math.pow(1.0015, ev.deltaY);
        const w = Math.min(this.fitBox.w * MIN_ZOOM, Math.max(this.fitBox.w / MAX_ZOOM, cur.w * factor));
        const scale = w / cur.w;
        const m = this.clientToWorld(svg, ev.clientX, ev.clientY);
        this.view = {
          x: m.x - (m.x - cur.x) * scale,
          y: m.y - (m.y - cur.y) * scale,
          w,
          h: cur.h * scale,
        };
        this.applyViewBox(svg);
      },
      { passive: false }
    );

    let dragging = false;
    let dragMoved = false;
    let down = { x: 0, y: 0 };
    let last = { x: 0, y: 0 };

    svg.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      dragging = true;
      dragMoved = false;
      down = last = { x: ev.clientX, y: ev.clientY };
    });

    svg.addEventListener("pointermove", (ev) => {
      if (!dragging) return;
      if (!dragMoved) {
        if (Math.hypot(ev.clientX - down.x, ev.clientY - down.y) <= DRAG_THRESHOLD) return;
        dragMoved = true;
        // capture only once panning starts, so plain clicks still reach the nodes
        svg.setPointerCapture(ev.pointerId);
        svg.classList.add("panning");
        this.tooltip.hidden = true;
      }
      const a = this.clientToWorld(svg, last.x, last.y);
      const b = this.clientToWorld(svg, ev.clientX, ev.clientY);
      const cur = this.view ?? this.fitBox;
      this.view = { x: cur.x - (b.x - a.x), y: cur.y - (b.y - a.y), w: cur.w, h: cur.h };
      this.applyViewBox(svg);
      last = { x: ev.clientX, y: ev.clientY };
    });

    const endDrag = (): void => {
      dragging = false;
      svg.classList.remove("panning");
    };
    svg.addEventListener("pointerup", endDrag);
    svg.addEventListener("pointercancel", endDrag);

    // swallow the click that follows a pan so node actions don't fire
    svg.addEventListener(
      "click",
      (ev) => {
        if (dragMoved) {
          ev.stopPropagation();
          dragMoved = false;
        }
      },
      true
    );

    svg.addEventListener("dblclick", (ev) => {
      if ((ev.target as Element).closest(".scanNode")) return;
      this.view = null;
      this.applyViewBox(svg);
    });
  };

  private showTooltip = (node: DiscoveredNode, ev: MouseEvent): void => {
    this.tooltip.textContent = `${node.name}\n${node.ip}\nauth: ${node.passwordRequired ? (node.unlocked ? "UNLOCKED" : "LOCKED") : "OPEN"}`;
    this.tooltip.hidden = false;
    this.moveTooltip(ev);
  };

  private moveTooltip = (ev: MouseEvent): void => {
    const rect = this.opts.container.getBoundingClientRect();
    this.tooltip.style.left = `${ev.clientX - rect.left + 14}px`;
    this.tooltip.style.top = `${ev.clientY - rect.top + 14}px`;
  };
}
