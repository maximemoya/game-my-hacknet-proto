const GLYPHS = "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789<>:/\\*+-=";
const FONT_SIZE = 14;
const FRAME_MS = 50;

export function startMatrixRain(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let columns = 0;
  let drops: number[] = [];

  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    columns = Math.ceil(canvas.width / FONT_SIZE);
    drops = Array.from({ length: columns }, () => Math.random() * canvas.height / FONT_SIZE);
    ctx.fillStyle = "#020a12";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };
  resize();
  window.addEventListener("resize", resize);

  const drawFrame = () => {
    ctx.fillStyle = "rgba(2, 10, 18, 0.12)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${FONT_SIZE}px monospace`;
    for (let i = 0; i < columns; i++) {
      const glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      const y = drops[i] * FONT_SIZE;
      ctx.fillStyle = Math.random() < 0.06 ? "rgba(120, 245, 255, 0.5)" : "rgba(25, 227, 255, 0.22)";
      ctx.fillText(glyph, i * FONT_SIZE, y);
      if (y > canvas.height && Math.random() > 0.975) {
        drops[i] = 0;
      }
      drops[i]++;
    }
  };

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    drawFrame();
    return;
  }

  let last = 0;
  const loop = (t: number) => {
    if (t - last >= FRAME_MS) {
      last = t;
      drawFrame();
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
