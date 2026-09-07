// Escena del menú: un árbol de lilas enorme que llena la pantalla, visto de
// frente y desde abajo; bruma alta en luz; Grecia pequeña en el camino,
// de espaldas, caminando hacia el árbol. Lo estático se pinta una vez en
// PixelBuffers; por cuadro solo pétalos, destellos, bokeh, niebla y la chica.
import { PixelBuffer, hex, type RGBA } from '../engine/pixels';
import { Rng } from '../engine/rng';
import { VW, VH, SW, SH } from '../engine/stage';
import { C } from '../art/palette';
import { GRECIA_FRAMES, SPRIG } from '../art/sprites';

const HORIZON = 150;
const TRUNK = { x: 152, base: HORIZON + 4, top: 98 };
const GIRL = { x: 104, y: 136 };
// Zona nítida (elipse). Fuera de ella se funde con la capa borrosa: el lado
// derecho (bajo el panel) y las esquinas quedan como el fondo de la foto.
const FOCUS = { x: 105, y: 100, inner: 78, outer: 190, aspect: 1.5 };

interface Petal { x: number; y: number; vx: number; vy: number; amp: number; w: number; ph: number; kind: number; col: string }
interface Bokeh { x: number; y: number; r: number; vy: number; ph: number; col: string }
interface Sparkle { x: number; y: number; w: number; ph: number }
interface Fog { x: number; y: number; rx: number; ry: number; v: number; a: number }
interface Fly { x: number; y: number; cx: number; cy: number; ph: number; col: string }

const PETAL_COLS = [C.lilac, C.lilacLight, C.lilacMid, C.lilacPale];
type Pt = [number, number];

export class TitleScene {
  private readonly back: HTMLCanvasElement;   // todo lo que va detrás de Grecia
  private readonly front: HTMLCanvasElement;  // racimos de primer plano
  private readonly softStatic: HTMLCanvasElement;
  private readonly overlay: HTMLCanvasElement;
  private readonly girl: HTMLCanvasElement[];
  private readonly petals: Petal[] = [];
  private readonly bokeh: Bokeh[] = [];
  private readonly sparkles: Sparkle[] = [];
  private readonly fog: Fog[] = [];
  private readonly flies: Fly[] = [
    { x: 60, y: 90, cx: 60, cy: 90, ph: 0, col: C.butterfly },
    { x: 170, y: 120, cx: 170, cy: 120, ph: 2.1, col: C.butterfly2 },
  ];
  private readonly rng = new Rng(7);
  private t = 0;
  readonly icon: HTMLCanvasElement;

  constructor() {
    const rng = new Rng(20250907);
    const dew: Pt[] = [];

    const back = new PixelBuffer(VW, VH);
    paintSky(back);
    paintDistance(back, rng);
    paintGround(back, rng);
    paintCanopy(back, rng, dew);
    paintTrunk(back);
    back.ellipse(GIRL.x + 6, GIRL.y + 23, 5, 2, hex(C.shadow, 60));

    const front = new PixelBuffer(VW, VH);
    panicle(front, rng, 22, 172, 74, 46, -0.35, 3, 0, 46, dew);
    panicle(front, rng, 56, 186, 58, 36, 0.25, 3, 0, 30, dew);

    // La versión borrosa se calcula sobre la imagen completa.
    const full = new PixelBuffer(VW, VH);
    full.blit(back, 0, 0);
    full.blit(GRECIA_FRAMES[0], GIRL.x, GIRL.y);
    full.blit(front, 0, 0);
    this.softStatic = makeSoft(full.toCanvas());
    this.back = makeFocused(back.toCanvas());
    this.front = makeFocused(front.toCanvas());
    this.overlay = makeOverlay();
    this.girl = GRECIA_FRAMES.map((f) => f.toCanvas());
    this.icon = SPRIG.toCanvas();

    for (let i = 0; i < 28; i++) this.petals.push(this.newPetal(true));
    for (let i = 0; i < 8; i++) {
      this.bokeh.push({
        x: this.rng.range(0, SW), y: this.rng.range(0, SH), r: this.rng.range(2, 5),
        vy: this.rng.range(0.6, 1.8), ph: this.rng.range(0, 6.28),
        col: this.rng.pick(['255,255,255', '244,236,255', '255,246,224']),
      });
    }
    // Gotas de rocío: brillan sobre flores de primer plano.
    for (let i = 0; i < 12 && dew.length; i++) {
      const [x, y] = dew[this.rng.int(dew.length)];
      this.sparkles.push({ x, y, w: this.rng.range(0.9, 1.8), ph: this.rng.range(0, 6.28) });
    }
    // Bancos de niebla (en píxeles de la capa borrosa): densos abajo, tenues arriba.
    const bands: [number, number, number, number][] = [[34, 34, 5, 0.26], [40, 40, 5, 0.3], [45, 46, 5, 0.26], [28, 24, 4, 0.1]];
    for (const [y, rx, ry, a] of bands) {
      this.fog.push({ x: this.rng.range(0, SW), y, rx, ry, v: this.rng.range(0.6, 1.4) * (this.rng.next() < 0.5 ? 1 : -1), a });
      this.fog.push({ x: this.rng.range(0, SW), y: y + 1, rx: rx * 0.8, ry, v: this.rng.range(0.6, 1.4) * (this.rng.next() < 0.5 ? 1 : -1), a: a * 0.8 });
    }
  }

  private newPetal(anywhere: boolean): Petal {
    const r = this.rng;
    const k = r.next();
    return {
      x: r.range(0, 210),
      y: anywhere ? r.range(0, VH) : r.range(-24, -4),
      vx: r.range(1, 5), vy: r.range(7, 15),
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
      if (p.y > VH + 2 || p.x > 230) this.petals[i] = this.newPetal(false);
    }
    for (const b of this.bokeh) {
      b.y -= b.vy * dt;
      b.x += Math.sin(this.t * 0.4 + b.ph) * 0.6 * dt;
      if (b.y < -b.r) { b.y = SH + b.r; b.x = this.rng.range(0, SW); }
    }
    for (const b of this.flies) {
      // Vuelo errático y lento alrededor de un punto que deriva.
      b.cx += Math.sin(this.t * 0.23 + b.ph) * 4 * dt;
      b.cy += Math.cos(this.t * 0.17 + b.ph) * 2.5 * dt;
      b.x = b.cx + Math.sin(this.t * 1.3 + b.ph) * 9;
      b.y = b.cy + Math.sin(this.t * 2.1 + b.ph * 2) * 4 + Math.cos(this.t * 0.7) * 3;
    }
    for (const f of this.fog) {
      f.x += f.v * dt;
      if (f.x > SW + f.rx) f.x = -f.rx;
      if (f.x < -f.rx) f.x = SW + f.rx;
    }
  }

  render(crisp: CanvasRenderingContext2D, soft: CanvasRenderingContext2D, haze: CanvasRenderingContext2D): void {
    // Capa borrosa: fondo suave + luces bokeh flotando.
    soft.drawImage(this.softStatic, 0, 0);
    for (const b of this.bokeh) {
      const a = 0.08 + 0.08 * (0.5 + 0.5 * Math.sin(this.t * 0.7 + b.ph));
      soft.fillStyle = `rgba(${b.col},${a.toFixed(3)})`;
      soft.beginPath();
      soft.arc(b.x, b.y, b.r, 0, 6.2832);
      soft.fill();
    }

    // Capa nítida.
    crisp.clearRect(0, 0, VW, VH);
    crisp.drawImage(this.back, 0, 0);
    crisp.drawImage(this.girl[Math.floor(this.t / 0.75) & 1], GIRL.x, GIRL.y);
    crisp.drawImage(this.front, 0, 0);

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
      if (a <= 0.3) continue;
      crisp.fillStyle = `rgba(255,255,255,${(a * 0.95).toFixed(3)})`;
      crisp.fillRect(s.x, s.y, 1, 1);
      if (a > 0.85) {
        crisp.fillStyle = `rgba(255,255,255,${((a - 0.85) * 4).toFixed(3)})`;
        crisp.fillRect(s.x - 1, s.y, 1, 1); crisp.fillRect(s.x + 1, s.y, 1, 1);
        crisp.fillRect(s.x, s.y - 1, 1, 1); crisp.fillRect(s.x, s.y + 1, 1, 1);
      }
    }
    crisp.drawImage(this.overlay, 0, 0);

    // Capa de niebla: bancos que derivan + rayos de luz desde arriba a la izquierda.
    haze.clearRect(0, 0, SW, SH);
    for (const f of this.fog) {
      const g = haze.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.rx);
      g.addColorStop(0, `rgba(252,250,255,${f.a.toFixed(3)})`);
      g.addColorStop(1, 'rgba(252,250,255,0)');
      haze.fillStyle = g;
      haze.save();
      haze.translate(f.x, f.y);
      haze.scale(1, f.ry / f.rx);
      haze.translate(-f.x, -f.y);
      haze.fillRect(f.x - f.rx, f.y - f.rx, f.rx * 2, f.rx * 2);
      haze.restore();
    }
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 0.35);
    haze.fillStyle = `rgba(255,246,200,${(0.08 + 0.05 * pulse).toFixed(3)})`;
    haze.beginPath(); haze.moveTo(-4, -2); haze.lineTo(14, -2); haze.lineTo(56, 45); haze.lineTo(30, 45); haze.closePath(); haze.fill();
    haze.fillStyle = `rgba(255,246,200,${(0.06 + 0.05 * (1 - pulse)).toFixed(3)})`;
    haze.beginPath(); haze.moveTo(18, -2); haze.lineTo(26, -2); haze.lineTo(70, 45); haze.lineTo(58, 45); haze.closePath(); haze.fill();

    // Mariposas.
    for (const b of this.flies) {
      const x = Math.round(b.x), y = Math.round(b.y);
      const open = Math.sin(this.t * 9 + b.ph) > 0;
      crisp.fillStyle = b.col;
      if (open) { crisp.fillRect(x - 1, y, 3, 1); crisp.fillRect(x - 1, y - 1, 1, 1); crisp.fillRect(x + 1, y - 1, 1, 1); }
      else { crisp.fillRect(x, y - 1, 1, 2); }
    }
  }
}

// ───────────────────────── utilidades de color ─────────────────────────

// Mezcla un color hacia la bruma: k = 0 cerca … 1 muy lejos.
function fogged(c: string, k: number): RGBA {
  const a = hex(c), f = hex(C.mist);
  return [a[0] + (f[0] - a[0]) * k, a[1] + (f[1] - a[1]) * k, a[2] + (f[2] - a[2]) * k, 255];
}

// ───────────────────────── fondo ─────────────────────────

// Degradado vertical con tramado de tablero: cielo pixel art sin bandas duras.
function paintSky(pb: PixelBuffer): void {
  // Muchos escalones intermedios y tramado solo en la franja central de cada
  // uno: la textura de tablero casi no se nota.
  const base = [C.skyTop, C.skyMid, C.skyLow, C.skyHorizon].map((c) => hex(c));
  const stops: RGBA[] = [];
  for (let i = 0; i < base.length - 1; i++) {
    for (let j = 0; j < 4; j++) {
      const f = j / 4, a = base[i], b = base[i + 1];
      stops.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, 255]);
    }
  }
  stops.push(base[base.length - 1]);
  for (let y = 0; y < VH; y++) {
    const t = Math.min(stops.length - 1.001, (y / HORIZON) * (stops.length - 1));
    const i = Math.floor(t), f = t - i;
    for (let x = 0; x < VW; x++) {
      const p = (x + y) & 1 ? 0.4 : 0.6;
      pb.set(x, y, f > p ? stops[i + 1] : stops[i]);
    }
  }
}

// Árboles lejanos perdidos en la bruma, para dar profundidad.
function paintDistance(pb: PixelBuffer, rng: Rng): void {
  const trees: [number, number, number][] = [[40, 118, 0.8], [250, 112, 0.82], [300, 126, 0.86], [200, 128, 0.88]];
  for (const [x, y, k] of trees) {
    pb.rect(x - 1, y, 3, HORIZON - y + 2, fogged(C.trunkDark, k));
    for (let i = 0; i < 7; i++) {
      const a = rng.range(0, 6.28), d = rng.range(0, 14);
      pb.circle(x + Math.cos(a) * d, y - 8 + Math.sin(a) * d * 0.7, 7 + rng.int(6), fogged(C.lilacMid, k));
    }
  }
}

function paintGround(pb: PixelBuffer, rng: Rng): void {
  // El suelo se aclara hacia el horizonte (más bruma).
  for (let y = HORIZON; y < VH; y++) {
    const k = 0.55 * (1 - (y - HORIZON) / (VH - HORIZON));
    pb.hline(0, VW - 1, y, fogged(C.groundDark, k));
  }
  for (let i = 0; i < 40; i++) {
    const y = rng.range(HORIZON, VH);
    const k = 0.5 * (1 - (y - HORIZON) / (VH - HORIZON));
    pb.ellipse(rng.int(VW), y, 6 + rng.int(14), 2 + rng.int(3), fogged(rng.pick([C.ground, C.groundLight]), k));
  }
  // Camino que viene de abajo a la izquierda hacia la base del tronco.
  const path: Pt[] = [[84, VH + 2], [136, VH + 2], [TRUNK.x + 5, TRUNK.base], [TRUNK.x - 9, TRUNK.base]];
  pb.poly(path, fogged(C.pathDark, 0.15));
  pb.poly([[90, VH + 2], [130, VH + 2], [TRUNK.x + 3, TRUNK.base + 1], [TRUNK.x - 7, TRUNK.base + 1]], fogged(C.path, 0.15));
  for (let i = 0; i < 26; i++) {
    const t = rng.next(), y = VH - t * (VH - TRUNK.base - 1);
    const cx = 110 + (TRUNK.x - 2 - 110) * t, half = (20 - 14 * t);
    const x = Math.round(cx + rng.range(-half, half));
    pb.rect(x, Math.round(y), rng.next() < 0.5 ? 2 : 1, 1, fogged(rng.next() < 0.6 ? C.pathLight : C.pebble, 0.2));
  }
  // Matas de pasto y pétalos caídos.
  for (let i = 0; i < 70; i++) {
    const x = rng.int(VW), y = HORIZON + 2 + rng.int(VH - HORIZON - 2);
    const col = fogged(rng.pick([C.leaf, C.leafLight, C.groundLight]), 0.3);
    pb.set(x, y, col); pb.set(x + 2, y, col); pb.set(x + 1, y + 1, col);
  }
  for (let i = 0; i < 60; i++) {
    const x = rng.int(VW), y = HORIZON + rng.int(VH - HORIZON);
    pb.set(x, y, hex(rng.pick(PETAL_COLS)));
  }
}

// ───────────────────────── árbol ─────────────────────────

function paintTrunk(pb: PixelBuffer): void {
  // Raíces y base.
  pb.ellipse(TRUNK.x, TRUNK.base + 2, 13, 2, hex(C.shadow, 70));
  pb.ellipse(TRUNK.x, TRUNK.base + 1, 10, 2, fogged(C.trunkDark, 0.12));
  for (const [dx, len] of [[-9, 3], [-5, 4], [4, 4], [9, 3]] as [number, number][]) {
    pb.rect(TRUNK.x + dx, TRUNK.base - 1, len, 2, fogged(C.trunk, 0.12));
  }
  // Tronco: ancho abajo, estrecho arriba, con luz a la izquierda.
  for (let y = TRUNK.base; y >= TRUNK.top; y--) {
    const t = (TRUNK.base - y) / (TRUNK.base - TRUNK.top);
    const half = Math.round(8 - 4.5 * t);
    const cx = TRUNK.x + Math.round(Math.sin(t * 2.2) * 3);
    pb.hline(cx - half, cx + half, y, fogged(C.trunkDark, 0.12));
    pb.hline(cx - half + 1, cx + half - 3, y, fogged(C.trunk, 0.12));
    pb.hline(cx - half + 2, cx - half + 3, y, fogged(C.trunkLight, 0.12));
  }
  // Ramas principales que se pierden entre las flores.
  const branches: [Pt, Pt][] = [[[TRUNK.x - 2, 104], [96, 66]], [[TRUNK.x - 1, 100], [140, 44]], [[TRUNK.x + 2, 104], [215, 62]], [[TRUNK.x + 3, 110], [232, 104]]];
  for (const [a, b] of branches) {
    for (let t = 0; t <= 1; t += 0.03) {
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      pb.circle(x, y, Math.max(1, Math.round(3.5 - 2.5 * t)), fogged(C.trunkDark, 0.12 + 0.2 * t));
      if (t < 0.7) pb.set(Math.round(x) - 1, Math.round(y) - 1, fogged(C.trunk, 0.12));
    }
  }
}

// Una flor de lila: cuatro pétalos redondos y un punto central.
// s = 1 → 3×3 · s = 2 → 7×7 · s = 3 → 11×11. `light` 0..1 = qué tan iluminada.
function floret(pb: PixelBuffer, x: number, y: number, s: number, k: number, light: number, rng: Rng): void {
  const d = s, pr = s - 1;
  const shades = light > 0.66 ? [C.lilacPale, C.lilacLight, C.lilac]
    : light > 0.33 ? [C.lilacLight, C.lilac, C.lilacMid]
    : [C.lilac, C.lilacMid, C.lilacDark];
  const petals: [number, number, number][] = [[0, -d, 0], [-d, 0, 1], [d, 0, 1], [0, d, 2]];
  for (const [dx, dy, si] of petals) {
    const col = fogged(shades[si], k);
    if (pr === 0) pb.set(x + dx, y + dy, col);
    else pb.circle(x + dx, y + dy, pr, col);
  }
  pb.set(x, y, fogged(rng.next() < 0.55 ? C.flowerCenter : C.lilacDeep, k));
  if (s >= 2 && light > 0.5) pb.set(x - 1, y - d, fogged(C.lilacPale, k));
}

function bud(pb: PixelBuffer, x: number, y: number, k: number): void {
  pb.set(x, y, fogged(C.bud, k)); pb.set(x + 1, y, fogged(C.bud, k));
  pb.set(x, y + 1, fogged(C.budDark, k)); pb.set(x + 1, y + 1, fogged(C.budDark, k));
}

// Racimo (panícula): cono desde la base (x, y) hacia la punta, largo h,
// ancho w, inclinado `tilt` radianes (0 = apunta hacia arriba).
function panicle(pb: PixelBuffer, rng: Rng, x: number, y: number, h: number, w: number, tilt: number, s: number, k: number, count: number, dew?: Pt[]): void {
  const ax = Math.sin(tilt), ay = -Math.cos(tilt);
  const px = Math.cos(tilt), py = Math.sin(tilt);
  // Masa de sombra detrás de las flores para que no se vea el cielo entre ellas.
  const mx = x + ax * h * 0.42, my = y + ay * h * 0.42;
  pb.ellipse(mx + 1, my + 2, Math.round(w * 0.42), Math.round(h * 0.4), fogged(C.canopyShade, k));
  pb.ellipse(mx, my, Math.round(w * 0.4), Math.round(h * 0.38), fogged(C.lilacDeep, k * 0.7 + 0.15));
  for (let i = 0; i < count; i++) {
    const a = rng.next();
    const half = (w / 2) * Math.sqrt(1 - a) * (0.8 + 0.2 * (1 - a));
    const off = (rng.next() * 2 - 1) * half;
    const fx = Math.round(x + ax * a * h + px * off), fy = Math.round(y + ay * a * h + py * off);
    const light = Math.min(1, Math.max(0, 0.5 - off / w + (a - 0.5) * 0.5 + rng.range(-0.15, 0.15)));
    if (a > 0.74 && rng.next() < 0.45) {
      bud(pb, fx, fy, k);
    } else {
      floret(pb, fx, fy, s, k, light, rng);
      if (dew && s >= 2 && light > 0.6 && rng.next() < 0.25) dew.push([fx - 1, fy - s]);
    }
  }
}

function paintCanopy(pb: PixelBuffer, rng: Rng, dew: Pt[]): void {
  // Masa base: hojas y sombra lila para que la copa se sienta densa.
  for (let i = 0; i < 70; i++) {
    const x = rng.range(-20, VW + 20), y = rng.range(-30, 112);
    const edge = y > 95 ? (y - 95) / 17 : 0;
    if (rng.next() < edge) continue;
    const r = 9 + rng.int(14);
    pb.circle(x, y, r, fogged(rng.pick([C.lilacMid, C.canopyShade, C.canopyBase, C.lilacMid]), 0.42));
    // Moteado: rompe la silueta plana del disco.
    for (let j = 0; j < r * 3; j++) {
      const a = rng.range(0, 6.28), d = Math.sqrt(rng.next()) * r;
      pb.set(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), fogged(rng.pick([C.lilacLight, C.lilacDark, C.leaf]), 0.45));
    }
  }
  for (let i = 0; i < 90; i++) {
    const x = rng.range(-10, VW + 10), y = rng.range(-10, 110);
    const col = fogged(rng.pick([C.leafDark, C.leaf, C.leafLight]), 0.3);
    pb.set(x, y, col); pb.set(x + 1, y, col); pb.set(x, y + 1, col); pb.set(x + 1, y + 1, col); pb.set(x + 1, y - 1, col);
  }
  // Racimos lejanos (pequeños, brumosos).
  for (let i = 0; i < 46; i++) {
    const x = rng.range(-10, VW + 10), y = rng.range(6, 108);
    panicle(pb, rng, x, y, rng.range(14, 22), rng.range(10, 16), rng.range(-0.9, 0.9), 1, 0.5, 34);
  }
  // Racimos medios.
  for (let i = 0; i < 44; i++) {
    const x = rng.range(-6, VW + 6), y = rng.range(10, 116);
    panicle(pb, rng, x, y, rng.range(22, 34), rng.range(14, 22), rng.range(-0.8, 0.8), rng.next() < 0.4 ? 2 : 1, 0.25, 50);
  }
  // Racimos cercanos: grandes, con flores de 4 pétalos bien visibles.
  const near: [number, number, number][] = [
    [24, 96, -0.5], [62, 72, -0.2], [98, 50, 0.1], [128, 84, -0.1], [160, 60, 0.3], [186, 96, 0.4], [214, 74, 0.5],
    [84, 108, -0.3], [246, 100, 0.6], [150, 24, 0.0], [40, 40, -0.6], [200, 30, 0.35], [280, 70, 0.5], [300, 110, 0.7],
  ];
  for (const [x, y, tilt] of near) {
    panicle(pb, rng, x, y, rng.range(36, 48), rng.range(24, 32), tilt, 2, 0.06, 70, dew);
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
  // Velo de bruma y luz cálida desde arriba a la izquierda.
  ctx.fillStyle = 'rgba(250,247,252,0.16)';
  ctx.fillRect(0, 0, SW, SH);
  const g = ctx.createRadialGradient(9, 1, 1, 9, 1, 66);
  g.addColorStop(0, 'rgba(255,240,180,0.6)');
  g.addColorStop(0.35, 'rgba(255,244,200,0.28)');
  g.addColorStop(1, 'rgba(255,244,200,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SW, SH);
  return c;
}

function makeFocused(layer: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = VW; c.height = VH;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(layer, 0, 0);
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
  // Luz de sol cálida desde arriba a la izquierda (nada oscuro: es de día).
  const v = ctx.createRadialGradient(30, 0, 10, 30, 0, 260);
  v.addColorStop(0, 'rgba(255,240,190,0.28)');
  v.addColorStop(0.4, 'rgba(255,244,210,0.10)');
  v.addColorStop(1, 'rgba(255,244,210,0)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, VW, VH);
  // Aclarado bajo el panel del menú.
  const l = ctx.createLinearGradient(170, 0, VW, 0);
  l.addColorStop(0, 'rgba(250,247,255,0)');
  l.addColorStop(1, 'rgba(250,247,255,0.45)');
  ctx.fillStyle = l;
  ctx.fillRect(0, 0, VW, VH);
  return c;
}
