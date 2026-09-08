// El final: la hoja de pergamino. Grecia planta su flor de lila; de ahí crece
// una lila que va poblando toda la hoja y forma "TE AMO MUCHO MUCHO GRECIA".
// Después, la carta: Grecia camina por la hoja y los párrafos aparecen a su paso.
import { PixelBuffer, hex, sprite, type RGBA } from '../engine/pixels';
import { Rng } from '../engine/rng';
import { VW, VH, SW, SH } from '../engine/stage';
import { C } from '../art/palette';
import { GRECIA, type DirSprites } from '../art/sprites';
import { ACTION, type Input } from '../engine/input';
import { story } from '../content/story';

type Phase = 'plant' | 'planting' | 'growing' | 'toLetter' | 'letter';
type Pt = [number, number];
interface Bloom { x: number; y: number; d: number; big: boolean; col: string; born: number }
interface Leaf { x: number; y: number; d: number; flip: boolean }

const PAPER = '#ecdfc4', PAPER_DARK = '#dfd0b0', PAPER_LIGHT = '#f5ecd8';
const SEED: Pt = [160, 158];
const GIRL_W = 12, GIRL_H = 23;
const SPEED_X = 40;

// Letras de 5×7 para el mensaje hecho de flores.
const GLYPHS: Record<string, string[]> = {
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
};
const MESSAGE = ['TE AMO', 'MUCHO MUCHO', 'GRECIA'];
const CELL = 4, ADV = 6 * CELL, LINE_TOPS = [14, 60, 106];

const MARKER_ROWS = [
  '.OOOOOOO.', 'OWWWWWWWO', 'OWZZZZZWO', 'OWWWWZWWO', 'OWWWWZWWO', 'OWZWWZWWO', 'OWWZZZWWO', 'OWWWWWWWO', '.OOOOOOO.', '....O....',
];

export class FinaleScene {
  private phase: Phase = 'plant';
  private t = 0;
  private readonly paper: HTMLCanvasElement;
  private readonly paper2: HTMLCanvasElement;
  private readonly marker: HTMLCanvasElement;
  private readonly flowerItem: HTMLCanvasElement;
  private readonly sprites: Record<'down' | 'right' | 'left', { idle: HTMLCanvasElement[]; walk: HTMLCanvasElement[] }>;
  private readonly shadow: HTMLCanvasElement;
  private readonly blooms: Bloom[] = [];
  private readonly leaves: Leaf[] = [];
  private readonly vines: Pt[][] = [];
  private readonly rng = new Rng(2026);
  private readonly events: string[] = [];
  private px = 130; private py = 136; private facing: 'down' | 'right' | 'left' = 'down'; private moving = false; private walkT = 0;
  private flowerPos: Pt = [0, 0];
  private camX = 0;
  private linesDone = 0;
  private readonly word: HTMLElement;
  private readonly letterBox: HTMLElement;
  private readonly paragraphs: { el: HTMLElement; x: number; shown: boolean }[] = [];
  private letterLen = 0;

  constructor(root: HTMLElement) {
    this.paper = makePaper(new Rng(11)).toCanvas();
    this.paper2 = makePaper(new Rng(12)).toCanvas();
    this.marker = sprite(MARKER_ROWS, { O: C.lilacDark, W: C.white, Z: C.lilacDeep }).toCanvas();
    this.flowerItem = renderFlower().toCanvas();
    const conv = (d: DirSprites) => ({ idle: d.idle.map((f) => f.toCanvas()), walk: d.walk.map((f) => f.toCanvas()) });
    const right = conv(GRECIA.side);
    this.sprites = { down: conv(GRECIA.front), right, left: { idle: right.idle.map(flipX), walk: right.walk.map(flipX) } };
    const sh = new PixelBuffer(GIRL_W, 4); sh.ellipse(6, 2, 5, 1, hex('#7a6a50', 70)); this.shadow = sh.toCanvas();

    // La palabra del centro.
    this.word = document.createElement('div');
    this.word.className = 'finale-word';
    this.word.textContent = story.plantWord;
    root.appendChild(this.word);
    setTimeout(() => this.word.classList.add('is-shown'), 600);

    // La carta: párrafos que se colocan a lo largo de la hoja.
    this.letterBox = document.createElement('div');
    this.letterBox.className = 'letter';
    this.letterBox.hidden = true;
    root.appendChild(this.letterBox);
    story.letter.forEach((text, i) => {
      const el = document.createElement('p');
      el.className = 'letter__p' + (i === story.letter.length - 1 ? ' letter__p--sign' : '');
      el.textContent = text;
      this.letterBox.appendChild(el);
      this.paragraphs.push({ el, x: 60 + i * 300, shown: false });
    });
    this.letterLen = 60 + story.letter.length * 300 + 40;

    // Objetivos de las flores: letras del mensaje + relleno pálido.
    MESSAGE.forEach((line, li) => {
      const w = line.length * ADV - CELL;
      const left = Math.round((VW - w) / 2);
      [...line].forEach((ch, ci) => {
        const g = GLYPHS[ch];
        if (!g) return;
        g.forEach((row, r) => [...row].forEach((bit, c) => {
          if (bit !== '1') return;
          const x = left + ci * ADV + c * CELL + 2, y = LINE_TOPS[li] + r * CELL + 2;
          this.blooms.push({ x, y, d: Math.hypot(x - SEED[0], y - SEED[1]) * 0.9 + li * 0, big: true, col: this.rng.pick([C.lilac, C.lilacMid, C.lilacDark, C.bud]), born: -1 });
        }));
      });
    });
    for (let i = 0; i < 170; i++) {
      const x = this.rng.range(4, VW - 4), y = this.rng.range(4, VH - 4);
      if (this.nearText(x, y)) continue;
      this.blooms.push({ x, y, d: Math.hypot(x - SEED[0], y - SEED[1]) + this.rng.range(0, 30), big: false, col: this.rng.pick([C.lilacPale, C.lilacLight, C.lilacLight]), born: -1 });
    }
    // Ramas que se abren desde el brote por toda la hoja.
    const ends: Pt[] = [[24, 30], [80, 12], [160, 6], [240, 12], [296, 30], [14, 100], [306, 104], [60, 150], [260, 150]];
    for (const e of ends) {
      const ctrl: Pt = [(SEED[0] + e[0]) / 2 + this.rng.range(-30, 30), (SEED[1] + e[1]) / 2 + this.rng.range(-10, 10)];
      const pts: Pt[] = [];
      for (let i = 0; i <= 40; i++) { const s = i / 40, u = 1 - s; pts.push([u * u * SEED[0] + 2 * u * s * ctrl[0] + s * s * e[0], u * u * SEED[1] + 2 * u * s * ctrl[1] + s * s * e[1]]); }
      this.vines.push(pts);
      for (let i = 6; i < 40; i += 5) this.leaves.push({ x: pts[i][0], y: pts[i][1], d: Math.hypot(pts[i][0] - SEED[0], pts[i][1] - SEED[1]), flip: i % 2 === 0 });
    }
  }

  private nearText(x: number, y: number): boolean {
    for (let li = 0; li < MESSAGE.length; li++) {
      const w = MESSAGE[li].length * ADV - CELL, left = (VW - w) / 2;
      if (x > left - 6 && x < left + w + 6 && y > LINE_TOPS[li] - 6 && y < LINE_TOPS[li] + 7 * CELL + 6) return true;
    }
    return false;
  }

  takeEvents(): string[] { return this.events.splice(0); }
  nameTag(): null { return null; }
  ambience(): { day: number; night: number; storm: number } { return { day: 0, night: 0, storm: 0 }; }

  update(dt: number, input?: Input): void {
    this.t += dt;
    if (this.phase === 'plant') {
      if (input?.take(ACTION)) {
        this.phase = 'planting'; this.t = 0;
        this.word.classList.remove('is-shown');
        setTimeout(() => this.word.remove(), 1600);
        this.events.push('sfx:twinkle');
      }
    } else if (this.phase === 'planting') {
      const k = Math.min(1, this.t / 1.1);
      this.flowerPos = [this.px + 8 + (SEED[0] - 2 - (this.px + 8)) * k, this.py + 9 + (SEED[1] - 12 - (this.py + 9)) * k - Math.sin(k * Math.PI) * 14];
      if (this.t > 1.5) { this.phase = 'growing'; this.t = 0; }
    } else if (this.phase === 'growing') {
      const r = this.waveR();
      for (const b of this.blooms) if (b.born < 0 && b.d <= r) b.born = this.t;
      const done = MESSAGE.filter((_, li) => this.blooms.every((b) => !b.big || b.born >= 0 || b.y < LINE_TOPS[li] || b.y > LINE_TOPS[li] + 30) && this.blooms.some((b) => b.big && b.y >= LINE_TOPS[li] && b.y <= LINE_TOPS[li] + 30 && b.born >= 0)).length;
      if (done > this.linesDone) { this.linesDone = done; this.events.push('sfx:twinkle'); }
      if (this.t > 12.5) { this.phase = 'toLetter'; this.t = 0; }
    } else if (this.phase === 'toLetter') {
      if (this.t > 1.6) {
        this.phase = 'letter'; this.t = 0;
        this.px = 20; this.py = 138; this.facing = 'right'; this.camX = 0;
        this.letterBox.hidden = false;
      }
    } else if (this.phase === 'letter' && input) {
      const [ax] = input.axis;
      this.moving = ax !== 0;
      if (this.moving) {
        const mult = input.running ? 1.6 : 1;
        this.walkT += dt * mult;
        this.facing = ax > 0 ? 'right' : 'left';
        this.px = Math.max(4, Math.min(this.letterLen - GIRL_W, this.px + ax * SPEED_X * mult * dt));
      } else this.walkT = 0;
      const target = Math.min(this.letterLen - VW, Math.max(0, this.px + GIRL_W / 2 - VW / 2));
      this.camX += (target - this.camX) * (1 - Math.exp(-5 * dt));
      for (const p of this.paragraphs) {
        const sx = p.x - this.camX;
        p.el.style.left = `calc(${sx.toFixed(1)} * var(--u))`;
        if (!p.shown && sx < VW - 40) { p.shown = true; p.el.classList.add('is-shown'); }
      }
    }
  }

  private waveR(): number { return Math.max(0, (this.t - 0.6) * 34); }

  render(crisp: CanvasRenderingContext2D, soft: CanvasRenderingContext2D, haze: CanvasRenderingContext2D): void {
    soft.fillStyle = PAPER; soft.fillRect(0, 0, SW, SH);
    haze.clearRect(0, 0, SW, SH);
    crisp.clearRect(0, 0, VW, VH);
    const cam = Math.round(this.camX);

    if (this.phase === 'letter' || this.phase === 'toLetter') {
      // La hoja de la carta: el papel se repite a lo largo.
      for (let x = -((cam % VW) + VW) % VW; x < VW; x += VW) crisp.drawImage(this.paper2, x, 0);
      // Lilas pequeñas a lo largo del camino.
      const r = new Rng(5);
      for (let i = 0; i < this.letterLen / 18; i++) {
        const wx = r.range(0, this.letterLen), wy = r.range(150, 176);
        const sx = Math.round(wx) - cam; if (sx < -4 || sx > VW + 4) continue;
        drawFloret(crisp, sx, Math.round(wy), r.pick([C.lilacLight, C.lilac, C.lilacPale]), false);
      }
      if (this.phase === 'letter') this.drawGirl(crisp, Math.round(this.px) - cam, Math.round(this.py));
      if (this.phase === 'toLetter') { crisp.globalAlpha = 1 - Math.min(1, this.t / 1.6); crisp.drawImage(this.paper, 0, 0); crisp.globalAlpha = 1; }
      return;
    }

    crisp.drawImage(this.paper, 0, 0);
    if (this.phase === 'growing') {
      // Ramas creciendo.
      const p = Math.min(1, this.t / 4.5);
      crisp.fillStyle = '#5f7f4a';
      for (const v of this.vines) {
        const n = Math.floor(p * (v.length - 1));
        for (let i = 0; i <= n; i++) { const [x, y] = v[i]; crisp.fillRect(Math.round(x), Math.round(y), i < 12 ? 2 : 1, i < 12 ? 2 : 1); }
      }
      // Hojas.
      const r = this.waveR();
      for (const l of this.leaves) {
        if (l.d > r) continue;
        const x = Math.round(l.x), y = Math.round(l.y);
        crisp.fillStyle = '#7fbb79'; crisp.fillRect(x + (l.flip ? -3 : 1), y - 1, 3, 2); crisp.fillStyle = '#5f9b62'; crisp.fillRect(x + (l.flip ? -2 : 2), y, 1, 1);
      }
      // Flores: las del mensaje grandes y densas; las del fondo pálidas.
      for (const b of this.blooms) {
        if (b.born < 0) continue;
        const age = this.t - b.born;
        drawFloret(crisp, Math.round(b.x), Math.round(b.y), b.col, b.big, age);
      }
    }
    // El brote y la tierra.
    if (this.phase !== 'plant') {
      crisp.fillStyle = '#8a6a4a'; crisp.beginPath(); crisp.ellipse(SEED[0], SEED[1] + 1, 7, 2, 0, 0, 6.2832); crisp.fill();
      crisp.fillStyle = '#a88a68'; crisp.fillRect(SEED[0] - 3, SEED[1] - 1, 6, 1);
    }
    if (this.phase === 'growing' && this.t < 4) {
      const h = Math.min(1, this.t / 1.2) * 14;
      crisp.fillStyle = '#5f7f4a'; crisp.fillRect(SEED[0] - 1, Math.round(SEED[1] - 2 - h), 2, Math.round(h));
    }
    // Grecia y la flor.
    this.drawGirl(crisp, Math.round(this.px), Math.round(this.py));
    if (this.phase === 'plant') {
      crisp.drawImage(this.flowerItem, this.px + 8, this.py + 9);
      crisp.drawImage(this.marker, this.px + 1, this.py - 14 + Math.round(Math.sin(this.t * 4) * 1.2));
    } else if (this.phase === 'planting') {
      crisp.drawImage(this.flowerItem, Math.round(this.flowerPos[0]), Math.round(this.flowerPos[1]));
    } else if (this.phase === 'growing' && this.t < 0.8) {
      crisp.drawImage(this.flowerItem, SEED[0] - 2, SEED[1] - 12);
    }
    // Chispas al plantar.
    if (this.phase === 'planting' && this.t > 1.05) {
      const r = new Rng(3);
      for (let i = 0; i < 10; i++) {
        const a = r.range(0, 6.28), d = (this.t - 1.05) * 40 * r.range(0.5, 1);
        crisp.fillStyle = `rgba(255,246,200,${Math.max(0, 1 - (this.t - 1.05) / 0.45).toFixed(3)})`;
        crisp.fillRect(Math.round(SEED[0] + Math.cos(a) * d), Math.round(SEED[1] - 6 + Math.sin(a) * d * 0.6), 1, 1);
      }
    }
  }

  private drawGirl(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const set = this.sprites[this.facing];
    let img: HTMLCanvasElement, bob = 0;
    if (this.moving) { const i = Math.floor(this.walkT / 0.13) % set.walk.length; img = set.walk[i]; bob = i & 1 ? -1 : 0; }
    else img = set.idle[Math.floor(this.t / 0.75) % set.idle.length];
    ctx.drawImage(this.shadow, x, y + GIRL_H - 2);
    ctx.drawImage(img, x, y + bob);
  }
}

// Flor de lila: grande (5×5 con centro) para las letras; chica (3×3) para el fondo.
function drawFloret(ctx: CanvasRenderingContext2D, x: number, y: number, col: string, big: boolean, age = 9): void {
  const k = Math.min(1, age / 0.35);
  ctx.fillStyle = col;
  if (big) {
    if (k < 0.34) { ctx.fillRect(x, y, 1, 1); return; }
    if (k < 0.67) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); return; }
    ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x, y - 2, 1, 5); ctx.fillRect(x - 1, y - 1, 3, 3);
    ctx.fillStyle = C.lilacPale; ctx.fillRect(x - 1, y - 1, 1, 1);
    ctx.fillStyle = C.flowerCenter; ctx.fillRect(x, y, 1, 1);
  } else {
    if (k < 0.5) { ctx.fillRect(x, y, 1, 1); return; }
    ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
    ctx.fillStyle = C.flowerCenter; ctx.fillRect(x, y, 1, 1);
  }
}

// Papel: beige con fibras, motas y bordes apenas más oscuros.
function makePaper(rng: Rng): PixelBuffer {
  const pb = new PixelBuffer(VW, VH);
  pb.rect(0, 0, VW, VH, hex(PAPER));
  for (let i = 0; i < 2600; i++) pb.set(rng.int(VW), rng.int(VH), hex(rng.next() < 0.5 ? PAPER_DARK : PAPER_LIGHT, 120));
  for (let i = 0; i < 260; i++) { const x = rng.int(VW), y = rng.int(VH), l = 2 + rng.int(5); pb.rect(x, y, l, 1, hex(rng.next() < 0.5 ? PAPER_DARK : PAPER_LIGHT, 90)); }
  for (let y = 0; y < VH; y++) for (let x = 0; x < VW; x++) {
    const dx = Math.min(x, VW - 1 - x), dy = Math.min(y, VH - 1 - y), d = Math.min(dx, dy);
    if (d < 22) pb.set(x, y, hex('#cbb894', Math.round(60 * (1 - d / 22))));
  }
  return pb;
}

function renderFlower(): PixelBuffer {
  const pb = new PixelBuffer(5, 6);
  pb.rect(2, 3, 1, 3, hex(C.leafDark));
  pb.set(2, 0, hex(C.lilacLight)); pb.set(1, 1, hex(C.lilac)); pb.set(3, 1, hex(C.lilac)); pb.set(2, 1, hex(C.lilacPale));
  pb.set(0, 2, hex(C.lilacLight)); pb.set(4, 2, hex(C.lilacLight)); pb.set(1, 2, hex(C.lilacDeep)); pb.set(3, 2, hex(C.lilacDeep)); pb.set(2, 2, hex(C.flowerCenter));
  return pb;
}

function flipX(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.translate(src.width, 0); ctx.scale(-1, 1); ctx.drawImage(src, 0, 0);
  return c;
}

export type { RGBA };
