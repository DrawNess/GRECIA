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
import { bigFloret, panicle } from '../art/lilac';

type Phase = 'plant' | 'planting' | 'growing' | 'toLetter' | 'letter';
type Pt = [number, number];
// Flor del mensaje o racimito del fondo: nace cuando la oleada la alcanza.
interface Bloom { x: number; y: number; d: number; big: boolean; img: HTMLCanvasElement; born: number }
interface Leaf { x: number; y: number; d: number; flip: boolean }
interface Dew { x: number; y: number; ph: number }
// Rama: puntos ya ondulados, grosor inicial y en qué avance de la principal nace (twigs).
interface Branch { pts: Pt[]; w0: number; from: number }
// Flor flotando en el aire: las lejanas nítidas y chicas, las cercanas grandes y borrosas.
interface Floater { x: number; y: number; vx: number; vy: number; ph: number; near: boolean; img: HTMLCanvasElement }

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
const CELL = 4, ADV = 7 * CELL, LINE_TOPS = [12, 60, 108];

// La carta: primera estación y separación entre párrafos (px de mundo).
const LETTER_START = 110, LETTER_STEP = 250;

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
  private readonly branches: Branch[] = [];
  private readonly floaters: Floater[] = [];
  private readonly borderTile: HTMLCanvasElement;
  private readonly farTile: HTMLCanvasElement;
  private readonly paperSoft: HTMLCanvasElement;
  private readonly floaterImgs: HTMLCanvasElement[];
  private readonly dew: Dew[] = [];
  private readonly leafImgs: HTMLCanvasElement[];
  private readonly rng = new Rng(2026);
  private readonly events: string[] = [];
  private px = 130; private py = 136; private facing: 'down' | 'right' | 'left' = 'down'; private moving = false; private walkT = 0;
  private flowerPos: Pt = [0, 0];
  private camX = 0;
  private linesDone = 0;
  private readonly word: HTMLElement;
  private wordTimer = 0;
  private readonly letterBox: HTMLElement;
  // Cada párrafo tiene su "estación" en la hoja: se ve, centrado, cuando Grecia está cerca.
  private readonly paragraphs: { el: HTMLElement; x: number }[] = [];
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
    this.wordTimer = window.setTimeout(() => this.word.classList.add('is-shown'), 600);

    // La carta: párrafos que se colocan a lo largo de la hoja.
    this.letterBox = document.createElement('div');
    this.letterBox.className = 'letter';
    this.letterBox.hidden = true;
    root.appendChild(this.letterBox);
    story.letter.forEach((text, i) => {
      const el = document.createElement('p');
      el.className = 'letter__p' + (i === story.letter.length - 1 ? ' letter__p--sign' : '');
      el.textContent = text;
      el.style.opacity = '0';
      this.letterBox.appendChild(el);
      this.paragraphs.push({ el, x: LETTER_START + i * LETTER_STEP });
    });
    this.letterLen = LETTER_START + story.letter.length * LETTER_STEP + 40;

    // Flores de verdad, pre-dibujadas: varias tallas y giros para las letras,
    // racimitos pálidos para el fondo, hojas para las ramas.
    const artRng = new Rng(77);
    const letterFlowers: HTMLCanvasElement[] = [];
    for (const S of [2.6, 3, 3.4]) for (const rot of [0.1, 0.5, 0.9, 1.3]) letterFlowers.push(renderFlowerCanvas(artRng, S, rot));
    const fillClusters: HTMLCanvasElement[] = [];
    for (const S of [1.8, 2.1, 2.4]) for (const rot of [0.2, 0.9]) fillClusters.push(renderFlowerCanvas(artRng, S, rot, 0.42));
    this.leafImgs = [0, 1].map((f) => renderLeaf(f === 1));

    MESSAGE.forEach((line, li) => {
      const w = line.length * ADV - 2 * CELL;
      const left = Math.round((VW - w) / 2);
      [...line].forEach((ch, ci) => {
        const g = GLYPHS[ch];
        if (!g) return;
        g.forEach((row, r) => [...row].forEach((bit, c) => {
          if (bit !== '1') return;
          const x = left + ci * ADV + c * CELL + 2 + this.rng.range(-0.6, 0.6), y = LINE_TOPS[li] + r * CELL + 2 + this.rng.range(-0.6, 0.6);
          this.blooms.push({ x, y, d: Math.hypot(x - SEED[0], y - SEED[1]) * 0.9, big: true, img: this.rng.pick(letterFlowers), born: -1 });
          if (this.rng.next() < 0.12) this.dew.push({ x: Math.round(x) - 1, y: Math.round(y) - 2, ph: this.rng.range(0, 6.28) });
        }));
      });
    });
    // Las flores de abajo se dibujan después: solapan a las de arriba, como en un racimo.
    this.blooms.sort((a, b) => a.y - b.y);
    for (let i = 0; i < 140; i++) {
      const x = this.rng.range(6, VW - 6), y = this.rng.range(5, VH - 5);
      if (this.nearText(x, y) || Math.hypot(x - SEED[0], y - SEED[1]) < 22) continue;
      this.blooms.push({ x, y, d: Math.hypot(x - SEED[0], y - SEED[1]) + this.rng.range(0, 40), big: false, img: this.rng.pick(fillClusters), born: -1 });
    }
    // Ramas de madera que se abren desde el brote: curvas con ondulación,
    // y de cada una salen ramitas con hojas en las puntas.
    const ends: Pt[] = [[40, 44], [110, 22], [160, 20], [212, 22], [282, 44], [24, 118], [298, 118], [70, 154], [250, 154]];
    const curve = (a: Pt, c: Pt, b: Pt, n: number, wob: number, ph: number): Pt[] => {
      const pts: Pt[] = [];
      for (let i = 0; i <= n; i++) {
        const s = i / n, u = 1 - s;
        const x = u * u * a[0] + 2 * u * s * c[0] + s * s * b[0], y = u * u * a[1] + 2 * u * s * c[1] + s * s * b[1];
        // Tangente para ondular en perpendicular, más hacia la punta.
        const tx = 2 * u * (c[0] - a[0]) + 2 * s * (b[0] - c[0]), ty = 2 * u * (c[1] - a[1]) + 2 * s * (b[1] - c[1]);
        const tl = Math.hypot(tx, ty) || 1;
        const off = Math.sin(s * 11 + ph) * wob * s + Math.sin(s * 23 + ph * 2) * wob * 0.4 * s;
        pts.push([x - (ty / tl) * off, y + (tx / tl) * off]);
      }
      return pts;
    };
    for (const e of ends) {
      const ctrl: Pt = [(SEED[0] + e[0]) / 2 + this.rng.range(-26, 26), (SEED[1] + e[1]) / 2 + this.rng.range(-8, 8)];
      const pts = curve(SEED, ctrl, e, 160, 2.4, this.rng.range(0, 6.28));
      this.branches.push({ pts, w0: 3, from: 0 });
      for (let i = 34; i < 150; i += 26) this.leaves.push({ x: pts[i][0], y: pts[i][1], d: Math.hypot(pts[i][0] - SEED[0], pts[i][1] - SEED[1]), flip: (i / 26) % 2 === 0 });
      // Ramitas.
      const n = 2 + this.rng.int(2);
      for (let k = 0; k < n; k++) {
        const s0 = 0.3 + this.rng.range(0, 0.5), i0 = Math.round(s0 * 160);
        const a = pts[i0], t = pts[Math.min(160, i0 + 4)];
        const ang = Math.atan2(t[1] - a[1], t[0] - a[0]) + (this.rng.next() < 0.5 ? 1 : -1) * this.rng.range(0.55, 1.05);
        const len = this.rng.range(14, 26);
        const end: Pt = [a[0] + Math.cos(ang) * len, a[1] + Math.sin(ang) * len - len * 0.25];
        const c2: Pt = [(a[0] + end[0]) / 2 + this.rng.range(-4, 4), (a[1] + end[1]) / 2 - 3];
        const tp = curve(a, c2, end, 40, 1.2, this.rng.range(0, 6.28));
        this.branches.push({ pts: tp, w0: 1.6, from: s0 });
        this.leaves.push({ x: end[0], y: end[1], d: Math.hypot(end[0] - SEED[0], end[1] - SEED[1]) + 6, flip: k % 2 === 0 });
        if (this.rng.next() < 0.6) this.leaves.push({ x: tp[20][0], y: tp[20][1], d: Math.hypot(tp[20][0] - SEED[0], tp[20][1] - SEED[1]) + 4, flip: k % 2 !== 0 });
      }
    }
    // Flores en el aire y las capas de la carta.
    this.floaterImgs = [renderFlowerCanvas(artRng, 2.4, 0.3, 0.1), renderFlowerCanvas(artRng, 3.2, 0.8, 0.05), renderFlowerCanvas(artRng, 4, 0.2, 0)];
    for (let i = 0; i < 16; i++) this.floaters.push(this.newFloater(i < 5, true));
    this.borderTile = renderBorderTile(new Rng(21));
    this.farTile = renderFarTile(new Rng(22));
    const ps = document.createElement('canvas'); ps.width = SW; ps.height = SH;
    const pctx = ps.getContext('2d')!; pctx.imageSmoothingEnabled = true; pctx.drawImage(this.paper2, 0, 0, SW, SH);
    this.paperSoft = ps;
  }

  private newFloater(near: boolean, anywhere: boolean): Floater {
    const r = this.rng;
    return {
      x: anywhere ? r.range(0, VW) : (r.next() < 0.5 ? -12 : VW + 12), y: r.range(6, 150),
      vx: r.range(4, 10) * (r.next() < 0.5 ? 1 : -1) * (near ? 1.6 : 1), vy: r.range(-4, 4),
      ph: r.range(0, 6.28), near, img: near ? this.floaterImgs[2] : r.pick(this.floaterImgs.slice(0, 2)),
    };
  }

  private updateFloaters(dt: number): void {
    for (let i = 0; i < this.floaters.length; i++) {
      const f = this.floaters[i];
      f.x += f.vx * dt; f.y += (f.vy + Math.sin(this.t * 1.3 + f.ph) * 6) * dt;
      if (f.x < -30 || f.x > VW + 30 || f.y < -20 || f.y > VH + 20) this.floaters[i] = this.newFloater(f.near, false);
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
    this.updateFloaters(dt);
    if (this.phase === 'plant') {
      if (input?.take(ACTION)) {
        this.phase = 'planting'; this.t = 0;
        clearTimeout(this.wordTimer);
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
      // Un párrafo a la vez: aparece al llegar a su estación y se va al seguir.
      const gx = this.px + GIRL_W / 2;
      for (const p of this.paragraphs) {
        const d = Math.abs(gx - p.x);
        const a = Math.max(0, Math.min(1, 1 - (d - 70) / 55));
        p.el.style.opacity = a.toFixed(3);
        p.el.style.transform = `translate(-50%, ${((1 - a) * 3).toFixed(1)}px)`;
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
      // Fondo (capa borrosa): el papel y racimos pálidos lejanos que se mueven despacio.
      const pOff = -((cam % VW) + VW) % VW;
      for (let x = pOff; x < VW; x += VW) soft.drawImage(this.paperSoft, x / 4, 0);
      const farW = this.farTile.width, fOff = -(((cam * 0.5) % farW) + farW) % farW;
      for (let x = fOff; x < VW; x += farW) soft.drawImage(this.farTile, x / 4, 0, farW / 4, SH);
      // Lilas pequeñas a lo largo del camino.
      const r = new Rng(5);
      for (let i = 0; i < this.letterLen / 18; i++) {
        const wx = r.range(0, this.letterLen), wy = r.range(150, 176);
        const sx = Math.round(wx) - cam; if (sx < -4 || sx > VW + 4) continue;
        crisp.fillStyle = r.pick([C.lilacLight, C.lilac, C.lilacPale]);
        const yy = Math.round(wy);
        crisp.fillRect(sx - 1, yy, 3, 1); crisp.fillRect(sx, yy - 1, 1, 3);
        crisp.fillStyle = C.flowerCenter; crisp.fillRect(sx, yy, 1, 1);
      }
      if (this.phase === 'letter') this.drawGirl(crisp, Math.round(this.px) - cam, Math.round(this.py));
      // Flores en el aire (las nítidas) y el borde de lilas en primer plano, que corre más rápido.
      for (const f of this.floaters) if (!f.near) crisp.drawImage(f.img, Math.round(f.x - f.img.width / 2), Math.round(f.y - f.img.height / 2));
      const bw = this.borderTile.width, bOff = -(((cam * 1.25) % bw) + bw) % bw;
      for (let x = bOff; x < VW; x += bw) crisp.drawImage(this.borderTile, Math.round(x), 0);
      for (const f of this.floaters) if (f.near) { const w = f.img.width * 0.45, h = f.img.height * 0.45; haze.drawImage(f.img, f.x / 4 - w / 2, f.y / 4 - h / 2, w, h); }
      if (this.phase === 'toLetter') { crisp.globalAlpha = 1 - Math.min(1, this.t / 1.6); crisp.drawImage(this.paper, 0, 0); crisp.globalAlpha = 1; }
      return;
    }

    crisp.drawImage(this.paper, 0, 0);
    if (this.phase === 'growing') {
      // Ramas creciendo: corteza gris-marrón con veta clara y sombra, grosor
      // que se afina; las ramitas brotan cuando la principal pasa por su nudo.
      const p = Math.min(1, this.t / 4.5);
      for (const b of this.branches) {
        const prog = b.from === 0 ? p : Math.min(1, Math.max(0, (p - b.from) / 0.3));
        const n = Math.floor(prog * (b.pts.length - 1));
        for (let i = 0; i <= n; i++) {
          const s = i / (b.pts.length - 1);
          const [x, y] = b.pts[i];
          const w = Math.max(1, Math.round(b.w0 * (1 - s * 0.7)));
          const ix = Math.round(x - w / 2), iy = Math.round(y - w / 2);
          crisp.fillStyle = (i % 9 === 0) ? '#3f3329' : '#5a4a3f';
          crisp.fillRect(ix, iy, w, w);
          if (w >= 2) { crisp.fillStyle = '#8a7461'; crisp.fillRect(ix, iy, 1, 1); crisp.fillStyle = '#3f3329'; crisp.fillRect(ix + w - 1, iy + w - 1, 1, 1); }
        }
        if (b.w0 >= 3 && n > 20) { const [kx, ky] = b.pts[20]; crisp.fillStyle = '#3f3329'; crisp.fillRect(Math.round(kx) + 1, Math.round(ky), 1, 2); }
      }
      // Hojas de lila (acorazonadas) a lo largo de las ramas.
      const r = this.waveR();
      for (const l of this.leaves) {
        if (l.d > r) continue;
        const img = this.leafImgs[l.flip ? 1 : 0];
        crisp.drawImage(img, Math.round(l.x) + (l.flip ? -img.width : 1), Math.round(l.y) - 3);
      }
      // Flores: brotan con un pequeño rebote; las del mensaje, de verdad.
      for (const b of this.blooms) {
        if (b.born < 0) continue;
        const age = this.t - b.born;
        const k = age < 0.4 ? 0.25 + 0.75 * (1 - Math.pow(1 - age / 0.4, 2)) * 1.08 : 1;
        const w = b.img.width * k, h = b.img.height * k;
        crisp.drawImage(b.img, Math.round(b.x - w / 2), Math.round(b.y - h / 2), Math.round(w), Math.round(h));
      }
      // Rocío que brilla sobre las flores ya abiertas.
      for (const d of this.dew) {
        const a = Math.sin(this.t * 1.6 + d.ph);
        if (a <= 0.55 || Math.hypot(d.x - SEED[0], d.y - SEED[1]) * 0.9 > r - 8) continue;
        crisp.fillStyle = `rgba(255,255,255,${((a - 0.55) * 2).toFixed(3)})`;
        crisp.fillRect(d.x, d.y, 1, 1);
        if (a > 0.9) { crisp.fillRect(d.x - 1, d.y, 1, 1); crisp.fillRect(d.x + 1, d.y, 1, 1); crisp.fillRect(d.x, d.y - 1, 1, 1); crisp.fillRect(d.x, d.y + 1, 1, 1); }
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
    // Flores en el aire.
    for (const f of this.floaters) if (!f.near) crisp.drawImage(f.img, Math.round(f.x - f.img.width / 2), Math.round(f.y - f.img.height / 2));
    // Blur de ensueño: los bordes de la hoja se disuelven en su versión borrosa,
    // y un halo lila muy suave envuelve las flores.
    soft.drawImage(crisp.canvas, 0, 0, SW, SH);
    crisp.globalCompositeOperation = 'destination-in';
    const g = crisp.createRadialGradient(160, 92, 82, 160, 92, 178);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    crisp.fillStyle = g; crisp.fillRect(0, 0, VW, VH);
    crisp.globalCompositeOperation = 'source-over';
    if (this.phase === 'growing') {
      const hg = haze.createRadialGradient(40, 20, 4, 40, 20, 40);
      hg.addColorStop(0, `rgba(214,190,240,${(0.16 * Math.min(1, this.waveR() / 120)).toFixed(3)})`); hg.addColorStop(1, 'rgba(214,190,240,0)');
      haze.fillStyle = hg; haze.fillRect(0, 0, SW, SH);
    }
    for (const f of this.floaters) if (f.near) { const w = f.img.width * 0.45, h = f.img.height * 0.45; haze.drawImage(f.img, f.x / 4 - w / 2, f.y / 4 - h / 2, w, h); }
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

// Una flor de lila de verdad (pétalos con sombra, garganta, rocío), lista para dibujar.
function renderFlowerCanvas(rng: Rng, S: number, rot: number, k = 0): HTMLCanvasElement {
  const size = Math.ceil(S * 2.3) + 4;
  const pb = new PixelBuffer(size, size);
  bigFloret(pb, rng, size >> 1, size >> 1, S, rot, k);
  return pb.toCanvas();
}

// Borde de la carta: racimos de lila con hojas arriba y abajo, en primer plano.
function renderBorderTile(rng: Rng): HTMLCanvasElement {
  const pb = new PixelBuffer(480, VH);
  const leafAt = (x: number, y: number) => { for (let i = 0; i < 4; i++) { pb.set(x + i, y, hex(C.leaf)); pb.set(x + i, y + 1, hex(C.leafDark)); } pb.set(x + 1, y - 1, hex(C.leafLight)); };
  for (let x = 6; x < 480; x += 26 + rng.int(20)) {
    // Arriba: racimos que cuelgan hacia abajo.
    panicle(pb, rng, x, -2, 18 + rng.int(8), 12 + rng.int(6), Math.PI + rng.range(-0.3, 0.3), 2, 0.04, 44);
    leafAt(x + 6 + rng.int(6), 14 + rng.int(8));
    // Abajo: racimos que suben desde el borde, dejando ver a Grecia.
    const bx = x + 12 + rng.int(10);
    panicle(pb, rng, bx, 184, 16 + rng.int(6), 10 + rng.int(6), rng.range(-0.3, 0.3), 2, 0.04, 36);
    leafAt(bx - 8 - rng.int(4), 172 + rng.int(4));
  }
  for (let i = 0; i < 40; i++) { const x = rng.int(480), top = rng.next() < 0.5; bigFloret(pb, rng, x, top ? 4 + rng.int(10) : 168 + rng.int(10), 2.2 + rng.next(), rng.range(0, 1.5), 0.02); }
  return pb.toCanvas();
}

// Fondo de la carta: racimos grandes y pálidos que se verán borrosos y lentos.
function renderFarTile(rng: Rng): HTMLCanvasElement {
  const pb = new PixelBuffer(400, VH);
  for (let i = 0; i < 14; i++) {
    const x = rng.int(400), y = rng.next() < 0.5 ? rng.range(10, 60) : rng.range(120, 170);
    panicle(pb, rng, x, y + 20, 34 + rng.int(16), 22 + rng.int(10), rng.range(-0.5, 0.5), 2, 0.55, 60);
  }
  return pb.toCanvas();
}

// Hoja de lila: acorazonada, con vena.
function renderLeaf(flip: boolean): HTMLCanvasElement {
  const rows = flip
    ? ['..GG.', '.GGGg', 'GGGgg', '.GGGg', '..GG.']
    : ['.GG..', 'gGGG.', 'ggGGG', 'gGGG.', '.GG..'];
  return sprite(rows, { G: C.leaf, g: C.leafDark }).toCanvas();
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
