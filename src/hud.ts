const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const SYSLOG_POOL = [
  "relay 7 handshake OK",
  "purging buffer sector 4C",
  "anomaly scan: negative",
  "uplink drift +0.003 rad",
  "coolant loop nominal",
  "packet burst from node KX-9",
  "checksum sweep: 0 errors",
  "antenna array realigned",
  "ghost signal discarded",
  "deep relay ping 412ms",
  "cache defrag complete",
  "solar wind interference low",
  "auth daemon heartbeat OK",
  "routing table synced",
  "long-range probe idle",
  "entropy pool refilled",
  "sector map delta applied",
  "cryo bay sensors green",
  "noise floor -97 dBm",
  "watchdog timer reset",
];

const SYSLOG_MAX_LINES = 30;
const SIGNAL_GLYPHS = "▁▂▃▄▅▆▇█";

export function startHud(): void {
  const radar = document.getElementById("radar") as HTMLCanvasElement | null;
  const telemetry = document.getElementById("telemetry");
  const syslog = document.getElementById("syslog");
  const spark = document.getElementById("spark") as HTMLCanvasElement | null;

  if (radar) startRadar(radar);
  if (telemetry) startTelemetry(telemetry);
  if (syslog) startSyslog(syslog);
  if (spark) startSparkline(spark);
}

function startRadar(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const size = canvas.width;
  const center = size / 2;
  let angle = 0;
  let blips: { x: number; y: number; age: number }[] = [];

  const drawFrame = () => {
    ctx.clearRect(0, 0, size, size);

    ctx.strokeStyle = "rgba(25, 227, 255, 0.25)";
    ctx.lineWidth = 1;
    for (const r of [0.33, 0.66, 0.98]) {
      ctx.beginPath();
      ctx.arc(center, center, center * r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, center); ctx.lineTo(size, center);
    ctx.moveTo(center, 0); ctx.lineTo(center, size);
    ctx.stroke();

    const grad = ctx.createConicGradient ?
      (() => {
        const g = ctx.createConicGradient(angle, center, center);
        g.addColorStop(0, "rgba(25, 227, 255, 0.55)");
        g.addColorStop(0.12, "rgba(25, 227, 255, 0)");
        g.addColorStop(1, "rgba(25, 227, 255, 0)");
        return g;
      })() : "rgba(25, 227, 255, 0.3)";
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, center * 0.98, angle, angle + 0.6);
    ctx.closePath();
    ctx.fill();

    if (Math.random() < 0.02 && blips.length < 4) {
      const r = (0.2 + Math.random() * 0.7) * center;
      const a = Math.random() * Math.PI * 2;
      blips.push({ x: center + r * Math.cos(a), y: center + r * Math.sin(a), age: 1 });
    }
    blips = blips.filter(b => b.age > 0.02);
    for (const b of blips) {
      ctx.fillStyle = `rgba(120, 245, 255, ${b.age})`;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2, 0, Math.PI * 2);
      ctx.fill();
      b.age *= 0.97;
    }

    angle += 0.025;
  };

  if (REDUCED_MOTION) {
    drawFrame();
    return;
  }
  const loop = () => {
    drawFrame();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function startTelemetry(el: HTMLElement): void {
  let x = 412.7, y = -88.2, z = 1043.9;

  const render = () => {
    const now = new Date();
    const stardate = `SD ${now.getFullYear() - 1700}.${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    const bars = Array.from({ length: 5 }, () =>
      SIGNAL_GLYPHS[2 + Math.floor(Math.random() * 6)]).join("");
    el.textContent = `${stardate}  SIG ${bars}\nSECTOR X:${x.toFixed(1)} Y:${y.toFixed(1)} Z:${z.toFixed(1)}`;
    x += (Math.random() - 0.5) * 0.4;
    y += (Math.random() - 0.5) * 0.4;
    z += 0.1 + Math.random() * 0.2;
  };

  render();
  if (!REDUCED_MOTION) setInterval(render, 1000);
}

function startSyslog(el: HTMLElement): void {
  const append = () => {
    const line = document.createElement("div");
    line.textContent = `[${new Date().toTimeString().slice(0, 8)}] ${SYSLOG_POOL[Math.floor(Math.random() * SYSLOG_POOL.length)]}`;
    el.appendChild(line);
    while (el.children.length > SYSLOG_MAX_LINES) {
      el.removeChild(el.firstChild!);
    }
  };

  for (let i = 0; i < 8; i++) append();
  if (REDUCED_MOTION) return;

  const schedule = () => {
    setTimeout(() => {
      append();
      schedule();
    }, 1500 + Math.random() * 2500);
  };
  schedule();
}

function startSparkline(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const barCount = 40;
  const data = Array.from({ length: barCount }, () => Math.random() * 0.5);

  const drawFrame = () => {
    data.shift();
    const prev = data[data.length - 1];
    data.push(Math.min(1, Math.max(0.05, prev + (Math.random() - 0.5) * 0.35)));

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const barW = canvas.width / barCount;
    for (let i = 0; i < barCount; i++) {
      const h = data[i] * canvas.height;
      ctx.fillStyle = i === barCount - 1 ? "rgba(120, 245, 255, 0.9)" : "rgba(25, 227, 255, 0.45)";
      ctx.fillRect(i * barW, canvas.height - h, barW - 1, h);
    }
  };

  drawFrame();
  if (!REDUCED_MOTION) setInterval(drawFrame, 250);
}

const NETFEED_MAX_LINES = 8;

export function pushNetFeedLine(text: string): void {
  const el = document.getElementById("netfeed");
  if (!el) return;
  const line = document.createElement("div");
  line.textContent = `[${new Date().toTimeString().slice(0, 8)}] ${text}`;
  el.appendChild(line);
  while (el.children.length > NETFEED_MAX_LINES) {
    el.removeChild(el.firstChild!);
  }
}
