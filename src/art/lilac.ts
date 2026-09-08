// Flores de lila: el mismo dibujo en todo el juego (menú, arbustos, el final).
import { PixelBuffer, hex, type RGBA } from '../engine/pixels';
import { Rng } from '../engine/rng';
import { C } from './palette';

export type Pt = [number, number];

export const LIGHT: Pt = [-0.707, -0.707];

export const TONE_PINK: Tone = { light: '#f1e6f8', mid: '#d4bceb', dark: '#b89ad8', deep: '#9776bf' };

export const TONE_LILAC: Tone = { light: '#ebe3f9', mid: '#c9b6ec', dark: '#a893dc', deep: '#8a72c4' };

export interface Tone { light: string; mid: string; dark: string; deep: string }

// Mezcla un color hacia la bruma: k = 0 cerca … 1 muy lejos.
export function fogged(c: string, k: number): RGBA {
  return mix(c, C.mist, k);
}

export function mix(c1: string, c2: string, k: number): RGBA {
  const a = hex(c1), f = hex(c2);
  return [a[0] + (f[0] - a[0]) * k, a[1] + (f[1] - a[1]) * k, a[2] + (f[2] - a[2]) * k, 255];
}

export function floret(pb: PixelBuffer, x: number, y: number, s: number, k: number, light: number, rng: Rng): void {
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

export function bud(pb: PixelBuffer, x: number, y: number, k: number): void {
  pb.set(x, y, fogged(C.bud, k)); pb.set(x + 1, y, fogged(C.bud, k));
  pb.set(x, y + 1, fogged(C.budDark, k)); pb.set(x + 1, y + 1, fogged(C.budDark, k));
}

// Racimo (panícula): cono desde la base (x, y) hacia la punta.
export function panicle(pb: PixelBuffer, rng: Rng, x: number, y: number, h: number, w: number, tilt: number, s: number, k: number, count: number, dew?: Pt[]): void {
  const ax = Math.sin(tilt), ay = -Math.cos(tilt);
  const px = Math.cos(tilt), py = Math.sin(tilt);
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

// Pétalo: elipse alargada que se afina hacia la punta, rotada `ang`.
export function petal(pb: PixelBuffer, cx: number, cy: number, S: number, ang: number, tone: Tone, lit: number, k: number, solid?: RGBA): void {
  const ra = S * 0.5, rb0 = S * 0.31;
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const ox = cx + dx * S * 0.58, oy = cy + dy * S * 0.58;
  const R = Math.ceil(ra + 1);
  for (let y = Math.floor(oy - R); y <= Math.ceil(oy + R); y++) {
    for (let x = Math.floor(ox - R); x <= Math.ceil(ox + R); x++) {
      const px = x + 0.5 - ox, py = y + 0.5 - oy;
      const u = px * dx + py * dy;
      const v = -px * dy + py * dx;
      const rb = rb0 * (1 - 0.38 * Math.max(0, u) / ra);
      const e = (u * u) / (ra * ra) + (v * v) / (rb * rb);
      if (e > 1) continue;
      if (solid) { pb.set(x, y, solid); continue; }
      const chk = (x + y) & 1;
      let col: string;
      if (e > 0.68) col = lit > 0.15 ? tone.light : lit < -0.3 ? tone.dark : chk ? tone.light : tone.mid;
      else if (Math.abs(v) < rb * 0.22 && u < ra * 0.35) col = u < -ra * 0.3 ? tone.deep : chk ? tone.dark : tone.mid;
      else if (lit > 0.4) col = chk && e > 0.4 ? tone.light : tone.mid;
      else if (lit < -0.3) col = chk ? tone.mid : tone.dark;
      else col = tone.mid;
      pb.set(x, y, fogged(col, k));
    }
  }
}

export function dewDrop(pb: PixelBuffer, x: number, y: number, r: number, k: number): void {
  pb.circle(x, y, r, [255, 255, 255, 105]);
  const rim = fogged(C.lilacDeep, k);
  pb.set(x + r, y + r - 1, [rim[0], rim[1], rim[2], 120]);
  pb.set(x - 1, y - 1, [255, 255, 255, 235]);
}

export function bigFloret(pb: PixelBuffer, rng: Rng, cx: number, cy: number, S: number, rot: number, k: number, dew?: Pt[]): void {
  const tone = rng.next() < 0.3 ? TONE_PINK : TONE_LILAC;
  const petals = [0, 1, 2, 3].map((i) => {
    const ang = rot + (i * Math.PI) / 2;
    return { ang, lit: -(Math.cos(ang) * -LIGHT[0] + Math.sin(ang) * -LIGHT[1]) };
  });
  petals.sort((a, b) => a.lit - b.lit);
  const outline = fogged(tone.deep, k);
  for (const p of petals) petal(pb, cx + 1, cy + 1, S + 1.2, p.ang, tone, p.lit, k, [outline[0], outline[1], outline[2], 150]);
  for (const p of petals) petal(pb, cx, cy, S, p.ang, tone, p.lit, k);
  pb.circle(cx, cy, Math.max(1, Math.round(S * 0.11)), fogged(C.lilacDeep, k));
  pb.set(cx, cy, fogged(C.flowerCenter, k));
  if (S >= 11) pb.set(cx + 1, cy, fogged(C.flowerCenter, k));
  if (S >= 9 && rng.next() < 0.75) {
    const p = petals[3];
    const x = Math.round(cx + Math.cos(p.ang) * S * 0.62), y = Math.round(cy + Math.sin(p.ang) * S * 0.62);
    dewDrop(pb, x, y, S >= 13 ? 2 : 1, k);
    dew?.push([x - 1, y - 1]);
  }
}

export function budBig(pb: PixelBuffer, x: number, y: number, ang: number, len: number, k: number): void {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const ra = len / 2, rb = Math.max(1.2, len * 0.28);
  for (let j = -Math.ceil(ra); j <= Math.ceil(ra); j++) {
    for (let i = -Math.ceil(ra); i <= Math.ceil(ra); i++) {
      const u = i * dx + j * dy, v = -i * dy + j * dx;
      if ((u * u) / (ra * ra) + (v * v) / (rb * rb) > 1) continue;
      const shadow = v > 0.3 || u < -ra * 0.5;
      pb.set(x + i, y + j, fogged(u > ra * 0.55 ? C.lilacLight : shadow ? C.budDark : C.bud, k));
    }
  }
}
