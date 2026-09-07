// Escena del menú: jardín de lilas visto desde arriba, Grecia de espaldas
// bajo el árbol. Todo lo estático se pinta una sola vez en un PixelBuffer;
// por cuadro solo se dibujan pétalos, destellos, bokeh y la chica.
import { PixelBuffer, hex, type RGBA } from '../engine/pixels';
import { Rng } from '../engine/rng';
import { VW, VH, SW, SH } from '../engine/stage';
import { C } from '../art/palette';
import { GRECIA_FRAMES, SPRIG } from '../art/sprites';

const TREE = { x: 70, y: 38, r: 52 };
const GIRL = { x: 91, y: 96 };
// Zona nítida (elipse): dentro de `inner` todo es píxel; hacia `outer` se
// funde con la capa borrosa. Es el "desenfoque de ensueño" a costo cero.
const FOCUS = { x: 98, y: 90, inner: 62, outer: 152, aspect: 1.35 };

interface Petal { x: number; y: number; vx: number; vy: number; amp: number; w: number; ph: number; kind: number; col: string }
interface Bokeh { x: number; y: number; r: number; vy: number; ph: number; col: string }
interface Sparkle { x: number; y: number; w: number; ph: number }

const PETAL_COLS = [C.lilac, C.lilacLight, C.lilacPink, C.lilacPale];

export class TitleScene {
  private readonly crispStatic: HTMLCanvasElement;
  private readonly softStatic: HTMLCanvasElement;
  private readonly overlay: HTMLCanvasElement;
  private readonly girl: HTMLCanvasElement[];
  private readonly petals: Petal[] = [];
  private readonly bokeh: Bokeh[] = [];
  private readonly sparkles: Sparkle[] = [];
  private readonly rng = new Rng(7);
  private t = 0;
  readonly icon: HTMLCanvasElement;

  constructor() {
    const rng = new Rng(20250907);
    const pb = new PixelBuffer(VW, VH);
    const path = paintGround(pb, rng);
    paintGrass(pb, rng, path);
    paintShadows(pb);
    paintBush(pb, rng, 150, 20, 17);
    paintBush(pb, rng, 12, 128, 13);
    paintBouquet(pb, rng, 150, 132, 0.75);
    paintBouquet(pb, rng, 44, 150, 2.6);
    paintBouquet(pb, rng, 166, 78, 0.05);
    paintCanopy(pb, rng);

    const full = pb.toCanvas();
    this.softStatic = makeSoft(full);
    this.crispStatic = makeFocused(full);
    this.overlay = makeOverlay();
    this.girl = GRECIA_FRAMES.map((f) => f.toCanvas());
    this.icon = SPRIG.toCanvas();

    for (let i = 0; i < 26; i++) this.petals.push(this.newPetal(true));
    for (let i = 0; i < 9; i++) {
      this.bokeh.push({
        x: this.rng.range(0, SW), y: this.rng.range(0, SH), r: this.rng.range(2, 5),
        vy: this.rng.range(0.8, 2.2), ph: this.rng.range(0, 6.28),
        col: this.rng.pick(['255,242,200', '233,217,255', '255,255,255']),
      });
    }
    for (let i = 0; i < 8; i++) {
      const a = this.rng.range(0, 6.28), d = this.rng.range(6, TREE.r * 0.8);
      this.sparkles.push({
        x: Math.round(TREE.x + Math.cos(a) * d), y: Math.round(TREE.y + Math.sin(a) * d),
        w: this.rng.range(1.2, 2.2), ph: this.rng.range(0, 6.28),
      });
    }
  }

  private newPetal(anywhere: boolean): Petal {
    const r = this.rng;
    const k = r.next();
    return {
      x: r.range(6, 150),
      y: anywhere ? r.range(0, VH) : r.range(-24, -4),
      vx: r.range(2, 7), vy: r.range(8, 17),
      amp: r.range(3, 8), w: r.range(1.2, 2.6), ph: r.range(0, 6.28),
      kind: k < 0.12 ? 2 : k < 0.55 ? 0 : 1,
      col: r.pick(PETAL_COLS),
    };
  }

  update(dt: number): void {
    this.t += dt;
    for (let i = 0; i < this.petals.length; i++) {
      const p = this.petals[i];
      p.y += p.vy * dt;
      p.x += (p.vx + Math.cos(this.t * p.w + p.ph) * p.amp) * dt;
      if (p.y > VH + 2 || p.x > 200) this.petals[i] = this.newPetal(false);
    }
    for (const b of this.bokeh) {
      b.y -= b.vy * dt;
      b.x += Math.sin(this.t * 0.4 + b.ph) * 0.6 * dt;
      if (b.y < -b.r) { b.y = SH + b.r; b.x = this.rng.range(0, SW); }
    }
  }

  render(crisp: CanvasRenderingContext2D, soft: CanvasRenderingContext2D): void {
    // Capa borrosa: fondo suave + luces bokeh flotando.
    soft.drawImage(this.softStatic, 0, 0);
    for (const b of this.bokeh) {
      const a = 0.10 + 0.08 * (0.5 + 0.5 * Math.sin(this.t * 0.7 + b.ph));
      soft.fillStyle = `rgba(${b.col},${a.toFixed(3)})`;
      soft.beginPath();
      soft.arc(b.x, b.y, b.r, 0, 6.2832);
      soft.fill();
    }

    // Capa nítida.
    crisp.clearRect(0, 0, VW, VH);
    crisp.drawImage(this.crispStatic, 0, 0);

    const frame = Math.floor(this.t / 0.75) & 1;
    crisp.drawImage(this.girl[frame], GIRL.x, GIRL.y);

    for (const p of this.petals) {
      const x = Math.round(p.x), y = Math.round(p.y);
      crisp.fillStyle = p.col;
      if (p.kind === 0) {
        crisp.fillRect(x, y, 2, 2);
      } else if (p.kind === 1) {
        crisp.fillRect(x, y, 2, 1);
        crisp.fillRect(x + 1, y + 1, 2, 1);
      } else {
        crisp.fillRect(x - 1, y, 3, 1);
        crisp.fillRect(x, y - 1, 1, 3);
        crisp.fillStyle = C.flowerCenter;
        crisp.fillRect(x, y, 1, 1);
      }
    }

    for (const s of this.sparkles) {
      const a = Math.sin(this.t * s.w + s.ph);
      if (a <= 0.2) continue;
      crisp.fillStyle = `rgba(255,255,255,${(a * 0.9).toFixed(3)})`;
      crisp.fillRect(s.x, s.y, 1, 1);
      if (a > 0.82) {
        crisp.fillStyle = `rgba(255,255,255,${((a - 0.82) * 3).toFixed(3)})`;
        crisp.fillRect(s.x - 1, s.y, 1, 1); crisp.fillRect(s.x + 1, s.y, 1, 1);
        crisp.fillRect(s.x, s.y - 1, 1, 1); crisp.fillRect(s.x, s.y + 1, 1, 1);
      }
    }

    crisp.drawImage(this.overlay, 0, 0);
  }
}

// ───────────────────────── pintura estática ─────────────────────────

type Pt = [number, number];

function paintGround(pb: PixelBuffer, rng: Rng): Pt[] {
  pb.rect(0, 0, VW, VH, hex(C.grass));
  // Manchas suaves de tres verdes: variación sin parecer camuflaje.
  const greens = [C.grassLight, C.grass, C.grassDark];
  for (let i = 0; i < 70; i++) {
    pb.circle(rng.int(VW), rng.int(VH), 6 + rng.int(16), hex(rng.pick(greens), 40 + rng.int(70)));
  }
  pb.quantize(greens.map((g) => hex(g)));

  // Camino curvo desde abajo hacia el árbol (más angosto al alejarse).
  const P0: Pt = [112, 190], P1: Pt = [112, 122], P2: Pt = [84, 66];
  const pts: Pt[] = [];
  for (let t = 0; t <= 1; t += 0.02) {
    const u = 1 - t;
    pts.push([u * u * P0[0] + 2 * u * t * P1[0] + t * t * P2[0], u * u * P0[1] + 2 * u * t * P1[1] + t * t * P2[1]]);
  }
  const radius = (t: number) => 13 - 4 * t;
  pts.forEach(([x, y], i) => pb.circle(x, y, radius(i / pts.length) + 1, hex(C.pathDark)));
  pts.forEach(([x, y], i) => pb.circle(x, y, radius(i / pts.length), hex(C.path)));
  // Borde irregular y piedritas.
  pts.forEach(([x, y], i) => {
    const r = radius(i / pts.length);
    for (let k = 0; k < 3; k++) {
      const a = rng.range(0, 6.28);
      pb.set(Math.round(x + Math.cos(a) * (r + 1.5)), Math.round(y + Math.sin(a) * (r + 1.5)), hex(rng.next() < 0.5 ? C.path : C.grassDark));
      const b = rng.range(0, 6.28), d = rng.range(0, r - 1);
      const px = Math.round(x + Math.cos(b) * d), py = Math.round(y + Math.sin(b) * d);
      if (rng.next() < 0.35) pb.rect(px, py, 2, 1, hex(rng.next() < 0.6 ? C.pathLight : C.pebble));
    }
  });
  return pts;
}

function nearPath(path: Pt[], x: number, y: number, margin: number): boolean {
  for (const [px, py] of path) {
    const dx = px - x, dy = py - y;
    if (dx * dx + dy * dy < margin * margin) return true;
  }
  return false;
}

function paintGrass(pb: PixelBuffer, rng: Rng, path: Pt[]): void {
  // Matas de pasto.
  for (let i = 0; i < 130; i++) {
    const x = rng.int(VW), y = rng.int(VH);
    if (nearPath(path, x, y, 14)) continue;
    const col = hex(rng.pick([C.grassDeep, C.grassDark, C.grassDark, C.grassPale]));
    if (rng.next() < 0.5) { pb.set(x, y, col); pb.set(x + 2, y, col); pb.set(x + 1, y + 1, col); }
    else { pb.set(x + 1, y, col); pb.set(x, y + 1, col); pb.set(x + 2, y + 1, col); }
  }
  // Tréboles blancos.
  for (let i = 0; i < 14; i++) {
    const x = rng.int(VW), y = rng.int(VH);
    if (nearPath(path, x, y, 12)) continue;
    pb.set(x, y, hex(C.pebbleLight)); pb.set(x + 1, y + 1, hex(C.grassPale));
  }
  // Pétalos caídos, más densos cerca del árbol.
  for (let i = 0; i < 110; i++) {
    const a = rng.range(0, 6.28), d = rng.range(10, 100) * (0.6 + rng.next() * 0.6);
    const x = Math.round(TREE.x + Math.cos(a) * d), y = Math.round(TREE.y + 12 + Math.sin(a) * d * 0.8);
    const col = hex(rng.pick(PETAL_COLS));
    pb.set(x, y, col);
    if (rng.next() < 0.4) pb.set(x + 1, y, col);
  }
}

function paintShadows(pb: PixelBuffer): void {
  pb.ellipse(TREE.x + 10, TREE.y + 18, 58, 38, hex(C.shadow, 48));
  pb.ellipse(GIRL.x + 9, GIRL.y + 27, 8, 3, hex(C.shadow, 70));
}

function flower(pb: PixelBuffer, x: number, y: number, col: RGBA, center: RGBA, cross: boolean): void {
  if (cross) {
    pb.set(x - 1, y - 1, col); pb.set(x + 1, y - 1, col); pb.set(x - 1, y + 1, col); pb.set(x + 1, y + 1, col);
  } else {
    pb.set(x - 1, y, col); pb.set(x + 1, y, col); pb.set(x, y - 1, col); pb.set(x, y + 1, col);
  }
  pb.set(x, y, center);
}

// Racimo de lilas: base sombreada + florecitas encima.
function puff(pb: PixelBuffer, rng: Rng, x: number, y: number, r: number, dense = 2.2): void {
  pb.circle(x + 1, y + 2, r, hex(C.lilacDeep));
  pb.circle(x, y, r, hex(C.lilac));
  // Luz arriba a la izquierda, en manchas pequeñas (no un disco plano).
  const hl = Math.max(1, Math.round(r * 0.4));
  for (let i = 0; i < 3; i++) {
    pb.circle(x - Math.round(r * 0.3) + rng.int(3) - 1, y - Math.round(r * 0.35) + rng.int(3) - 1, Math.max(1, hl - rng.int(2)), hex(C.lilacLight));
  }
  const n = Math.round(r * dense);
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, 6.28), d = Math.sqrt(rng.next()) * (r - 1);
    const fx = Math.round(x + Math.cos(a) * d), fy = Math.round(y + Math.sin(a) * d);
    const up = fy < y;
    const shade = up ? rng.pick([C.lilacLight, C.lilacPale, C.lilacLight, C.lilacPink]) : rng.pick([C.lilac, C.lilacDark, C.lilacPink, C.lilacDeep]);
    const center = rng.next() < 0.16 ? C.flowerCenter : up ? C.lilacPale : C.lilacLight;
    flower(pb, fx, fy, hex(shade), hex(center), rng.next() < 0.35);
  }
}

function paintBush(pb: PixelBuffer, rng: Rng, x: number, y: number, r: number): void {
  pb.ellipse(x + 3, y + 5, r + 2, Math.round(r * 0.7), hex(C.shadow, 40));
  pb.circle(x + 2, y + 3, r, hex(C.leafDark));
  pb.circle(x, y, r - 1, hex(C.leaf));
  for (let i = 0; i < 4; i++) {
    const a = rng.range(0, 6.28), d = rng.range(0, r * 0.5);
    puff(pb, rng, Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), Math.round(r * 0.45));
  }
}

function paintCanopy(pb: PixelBuffer, rng: Rng): void {
  const { x, y, r } = TREE;
  // Hojas debajo de los racimos.
  for (let i = 0; i < 26; i++) {
    const a = rng.range(0, 6.28), d = Math.sqrt(rng.next()) * r * 0.9;
    pb.circle(x + Math.cos(a) * d, y + Math.sin(a) * d, 8 + rng.int(9), hex(rng.pick([C.leafDark, C.leaf, C.leaf])));
  }
  for (let i = 0; i < 12; i++) {
    const a = rng.range(0, 6.28), d = Math.sqrt(rng.next()) * r * 0.8;
    pb.circle(x + Math.cos(a) * d, y + Math.sin(a) * d, 3 + rng.int(4), hex(C.leafLight));
  }
  // Racimos de lila, más grandes al centro.
  const puffs: [number, number, number][] = [];
  for (let i = 0; i < 34; i++) {
    const a = rng.range(0, 6.28), d = Math.sqrt(rng.next()) * r * 0.78;
    const rr = Math.round(6 + rng.next() * 7 * (1 - d / r) + 2);
    puffs.push([Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), rr]);
  }
  // Racimos pequeños en el borde para romper la silueta redonda.
  for (let i = 0; i < 14; i++) {
    const a = rng.range(0, 6.28), d = rng.range(r * 0.7, r * 0.95);
    puffs.push([Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), 4 + rng.int(4)]);
  }
  // Vista 3/4 desde arriba: lo que está más abajo en pantalla está más cerca
  // de la cámara, así que se dibuja al final y tapa lo de arriba.
  puffs.sort((p, q) => p[1] - q[1]);
  for (const [px, py, pr] of puffs) puff(pb, rng, px, py, pr, 1.8);
  // Hojitas asomando entre las flores.
  for (let i = 0; i < 40; i++) {
    const a = rng.range(0, 6.28), d = Math.sqrt(rng.next()) * r * 0.85;
    const lx = Math.round(x + Math.cos(a) * d), ly = Math.round(y + Math.sin(a) * d);
    const col = hex(rng.pick([C.leaf, C.leafLight]));
    pb.set(lx, ly, col); pb.set(lx + 1, ly, col);
  }
}

// Ramo: racimo de lilas envuelto en papel kraft con un lazo.
function paintBouquet(pb: PixelBuffer, rng: Rng, cx: number, cy: number, angle: number): void {
  const dx = Math.cos(angle), dy = Math.sin(angle), px = -dy, py = dx;
  const L = 15, wBase = 6, wTip = 2.5;
  const P = (t: number, s: number): Pt => [cx + dx * t + px * s, cy + dy * t + py * s];
  pb.ellipse(cx + dx * 6 + 2, cy + dy * 6 + 3, 9, 4, hex(C.shadow, 55));
  pb.poly([P(1, wBase), P(1, -wBase), P(L, -wTip), P(L, wTip)], hex(C.paperDark));
  pb.poly([P(2, wBase - 1.5), P(2, -wBase + 1.5), P(L - 1, -wTip + 1), P(L - 1, wTip - 1)], hex(C.paper));
  pb.poly([P(3, -1), P(3, -3.2), P(L - 2, -1.4), P(L - 2, -0.4)], hex(C.paperLight));
  pb.poly([P(4, wBase - 1), P(4, -wBase + 1), P(6, -wBase + 1.4), P(6, wBase - 1.4)], hex(C.ribbonDark));
  pb.poly([P(4.5, wBase - 2), P(4.5, -wBase + 2), P(5.5, -wBase + 2), P(5.5, wBase - 2)], hex(C.ribbon));
  puff(pb, rng, Math.round(cx - dx), Math.round(cy - dy), 7, 2.6);
  // Un par de hojas asomando del ramo.
  for (let i = 0; i < 3; i++) {
    const a = rng.range(0, 6.28);
    const lx = Math.round(cx - dx + Math.cos(a) * 7), ly = Math.round(cy - dy + Math.sin(a) * 7);
    pb.set(lx, ly, hex(C.leaf)); pb.set(lx + 1, ly, hex(C.leafLight));
  }
}

// ───────────────────────── capas derivadas ─────────────────────────

function makeSoft(full: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = SW; c.height = SH;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(full, 0, 0, SW, SH);
  // Luz cálida desde arriba a la izquierda.
  const g = ctx.createRadialGradient(14, 4, 2, 14, 4, 60);
  g.addColorStop(0, 'rgba(255,238,196,0.34)');
  g.addColorStop(1, 'rgba(255,238,196,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SW, SH);
  return c;
}

function makeFocused(full: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = VW; c.height = VH;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(full, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.translate(FOCUS.x, FOCUS.y);
  ctx.scale(FOCUS.aspect, 1);
  const g = ctx.createRadialGradient(0, 0, FOCUS.inner, 0, 0, FOCUS.outer);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-500, -500, 1000, 1000);
  return c;
}

function makeOverlay(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = VW; c.height = VH;
  const ctx = c.getContext('2d')!;
  // Viñeta.
  const v = ctx.createRadialGradient(130, 90, 80, 130, 90, 235);
  v.addColorStop(0, 'rgba(45,30,60,0)');
  v.addColorStop(1, 'rgba(45,30,60,0.42)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, VW, VH);
  // Aclarado suave bajo el panel del menú.
  const l = ctx.createLinearGradient(165, 0, VW, 0);
  l.addColorStop(0, 'rgba(252,248,243,0)');
  l.addColorStop(1, 'rgba(252,248,243,0.40)');
  ctx.fillStyle = l;
  ctx.fillRect(0, 0, VW, VH);
  return c;
}
