import { useEffect, useRef } from "react";

// ┌─────────────────────────────────────────────────────────────────────────┐
// │  DecryptedOverlay — canvas-based validated-data animation               │
// │  Sits as a transparent layer over the hero section.                     │
// │                                                                         │
// │  Tweak these to change the feel of the animation:                       │
// └─────────────────────────────────────────────────────────────────────────┘

// ── Density ──────────────────────────────────────────────────────────────────
const PARTICLE_COUNT  = 115;   // glyphs alive simultaneously (raise = denser)

// ── Opacity ──────────────────────────────────────────────────────────────────
const OPACITY_MIN     = 0.032; // dimmest particle (0–1)
const OPACITY_MAX     = 0.115; // brightest particle

// ── Size ─────────────────────────────────────────────────────────────────────
const FONT_MIN        = 9;     // smallest glyph (px)
const FONT_MAX        = 14;    // largest glyph (px)

// ── Speed ────────────────────────────────────────────────────────────────────
const SPEED_MIN       = 0.20;  // slowest drift (px/frame at 60fps)
const SPEED_MAX       = 0.82;  // fastest drift

// ── Cursor interaction ────────────────────────────────────────────────────────
const PARALLAX_STR    = 0.013; // parallax multiplier (lower = more subtle)
const CURSOR_RADIUS   = 85;    // px — radius of cursor influence zone

// ── Scanline sweep ────────────────────────────────────────────────────────────
const SCANLINE_EVERY  = 7000;  // ms between AI-processing sweep passes
const SCANLINE_DUR    = 2400;  // ms for one full sweep

// ── Colour ───────────────────────────────────────────────────────────────────
const RED_FRACTION    = 0.09;  // ~9 % of glyphs use the red accent colour
const COLOR_WHITE     = "#ffffff";
const COLOR_RED       = "#ff2a2a";

// ── Character pools ──────────────────────────────────────────────────────────
const CHARS_ENCRYPTED = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*(){}[]|<>/?!~`=+_-;:.";
const CHARS_RESOLVED  = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

// ─────────────────────────────────────────────────────────────────────────────

interface Glyph {
  x: number;
  y: number;
  vx: number;
  vy: number;
  char: string;
  resolvedChar: string;    // the "decrypted" character it settles on
  opacity: number;
  size: number;
  isRed: boolean;
  decryptStart: number;    // age (frames) at which decrypt begins
  decryptEnd: number;      // age (frames) at which scramble resumes
  scrambleEvery: number;   // change char every N frames while scrambling
  lastScramble: number;    // global frame of last char-swap
  age: number;
  maxAge: number;
}

function rng(a: number, b: number) {
  return Math.random() * (b - a) + a;
}

function pick(pool: string): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

function makeAngle(): number {
  // Diagonal and near-horizontal directions — avoids pure vertical rain look
  const degrees = [
    rng(-22, 22),     // near-horizontal rightward
    rng(32, 62),      // diagonal down-right
    rng(-62, -32),    // diagonal up-right
    rng(158, 202),    // near-horizontal leftward
  ];
  return degrees[Math.floor(Math.random() * degrees.length)] * (Math.PI / 180);
}

function spawnGlyph(w: number, h: number): Glyph {
  const a     = makeAngle();
  const speed = rng(SPEED_MIN, SPEED_MAX);
  const maxAge = Math.floor(rng(210, 480));
  const ds = Math.floor(maxAge * rng(0.18, 0.55));

  return {
    x:             rng(0, w),
    y:             rng(0, h),
    vx:            Math.cos(a) * speed,
    vy:            Math.sin(a) * speed,
    char:          pick(CHARS_ENCRYPTED),
    resolvedChar:  pick(CHARS_RESOLVED),
    opacity:       rng(OPACITY_MIN, OPACITY_MAX),
    size:          Math.floor(rng(FONT_MIN, FONT_MAX)),
    isRed:         Math.random() < RED_FRACTION,
    decryptStart:  ds,
    decryptEnd:    ds + Math.floor(rng(50, 120)),
    scrambleEvery: Math.floor(rng(4, 13)),
    lastScramble:  0,
    age:           0,
    maxAge,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export function DecryptedOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;

    // ── Mutable state stored in a ref-like object for the RAF closure ────
    let glyphs: Glyph[]                                         = [];
    let mouse       = { x: 0, y: 0, inside: false };
    let globalFrame = 0;
    let raf         = 0;
    let scanline    = { active: false, startTime: 0, lastEnd: 0 };

    // ── Resize handler ───────────────────────────────────────────────────
    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // ── Seed the field with staggered particles so it looks alive on first
    //    frame rather than all starting from age 0 simultaneously ─────────
    const { width: iw, height: ih } = canvas;
    glyphs = Array.from({ length: PARTICLE_COUNT }, () => {
      const g = spawnGlyph(iw, ih);
      g.age   = Math.floor(Math.random() * g.maxAge * 0.8); // stagger ages
      return g;
    });

    // ── Main animation loop ──────────────────────────────────────────────
    function loop(ts: number) {
      raf = requestAnimationFrame(loop);

      const cw = canvas.width;
      const ch = canvas.height;
      const gf = globalFrame++;

      // ── Scanline state machine ─────────────────────────────────────────
      if (!scanline.active && ts - scanline.lastEnd > SCANLINE_EVERY) {
        scanline.active    = true;
        scanline.startTime = ts;
      }
      let scanPhase = -1;
      if (scanline.active) {
        scanPhase = (ts - scanline.startTime) / SCANLINE_DUR;
        if (scanPhase >= 1) {
          scanline.active  = false;
          scanline.lastEnd = ts;
          scanPhase        = -1;
        }
      }

      // ── Clear ──────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, cw, ch);

      // ── Subtle parallax: shift the entire drawing by a small amount
      //    proportional to where the cursor is relative to centre ─────────
      ctx.save();
      if (mouse.inside) {
        ctx.translate(
          (mouse.x - cw / 2) * PARALLAX_STR,
          (mouse.y - ch / 2) * PARALLAX_STR,
        );
      }

      // ── Draw glyphs ────────────────────────────────────────────────────
      ctx.textBaseline = "top";

      for (let i = 0; i < glyphs.length; i++) {
        const g = glyphs[i];

        // Advance position and age
        g.x += g.vx;
        g.y += g.vy;
        g.age++;

        // Recycle if outside canvas or end of life
        if (
          g.age >= g.maxAge ||
          g.x < -60 || g.x > cw + 60 ||
          g.y < -60 || g.y > ch + 60
        ) {
          glyphs[i] = spawnGlyph(cw, ch);
          continue;
        }

        // ── Decrypt cycle ──────────────────────────────────────────────
        const isResolved = g.age >= g.decryptStart && g.age < g.decryptEnd;

        // Cursor proximity: scramble faster when inside influence zone
        const dx   = g.x - mouse.x;
        const dy   = g.y - mouse.y;
        const dist = mouse.inside ? Math.sqrt(dx * dx + dy * dy) : Infinity;
        const nearCursor = dist < CURSOR_RADIUS;
        const rate = nearCursor ? 2 : g.scrambleEvery;

        if (isResolved) {
          g.char = g.resolvedChar;
        } else if (gf - g.lastScramble >= rate) {
          g.char        = pick(CHARS_ENCRYPTED);
          g.lastScramble = gf;
        }

        // ── Fade in/out at life edges (prevents hard pops) ────────────
        const FADE_FRAMES = 24;
        let alpha = g.opacity;
        if (g.age < FADE_FRAMES)               alpha *= g.age / FADE_FRAMES;
        if (g.age > g.maxAge - FADE_FRAMES)    alpha *= (g.maxAge - g.age) / FADE_FRAMES;
        // Glyphs near cursor brighten slightly
        if (nearCursor)                         alpha = Math.min(alpha * 1.7, 0.20);

        // ── Glow: only on resolved glyphs and red accents (expensive, keep minimal)
        if (isResolved || g.isRed || nearCursor) {
          ctx.shadowColor = g.isRed ? COLOR_RED : COLOR_WHITE;
          ctx.shadowBlur  = isResolved ? 8 : nearCursor ? 5 : 3;
        } else {
          ctx.shadowBlur  = 0;
        }

        ctx.globalAlpha = alpha;
        ctx.fillStyle   = g.isRed ? COLOR_RED : COLOR_WHITE;
        ctx.font        = `${g.size}px "Fira Mono", ui-monospace, monospace`;
        ctx.fillText(g.char, g.x, g.y);
      }

      // Reset shadow before scanline (prevent bleed)
      ctx.shadowBlur  = 0;
      ctx.shadowColor = "transparent";

      // ── Scanline sweep ─────────────────────────────────────────────────
      if (scanPhase >= 0) {
        // Ease-in-out so the sweep doesn't feel mechanical
        const t  = scanPhase;
        const e  = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
        const sy = e * ch;

        // Soft ambient band
        const grad = ctx.createLinearGradient(0, sy - 90, 0, sy + 90);
        grad.addColorStop(0,   "rgba(255,42,42,0)");
        grad.addColorStop(0.5, "rgba(255,42,42,0.05)");
        grad.addColorStop(1,   "rgba(255,42,42,0)");
        ctx.globalAlpha = 1;
        ctx.fillStyle   = grad;
        ctx.fillRect(0, sy - 90, cw, 180);

        // Bright hairline
        ctx.globalAlpha = 0.16;
        ctx.fillStyle   = COLOR_RED;
        ctx.fillRect(0, sy - 0.5, cw, 1);

        // Leading glow line
        ctx.shadowColor = COLOR_RED;
        ctx.shadowBlur  = 18;
        ctx.globalAlpha = 0.08;
        ctx.fillRect(0, sy - 1, cw, 2);
        ctx.shadowBlur  = 0;
      }

      ctx.restore();
    }

    raf = requestAnimationFrame(loop);

    // ── Mouse tracking ───────────────────────────────────────────────────
    const onMouseMove = (e: MouseEvent) => {
      const r   = canvas.getBoundingClientRect();
      mouse.x   = e.clientX - r.left;
      mouse.y   = e.clientY - r.top;
      mouse.inside = true;
    };
    const onMouseLeave = () => { mouse.inside = false; };

    window.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseleave", onMouseLeave);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      // pointer-events-none ensures no UI interaction is blocked
      // z-[1] keeps it above decorative BG layers but below content (z-10)
      // animate-decrypt-reveal fades it in over 1.5 s after a 0.3 s delay
      className="pointer-events-none absolute inset-0 h-full w-full z-[1] animate-decrypt-reveal"
    />
  );
}
