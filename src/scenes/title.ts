// Escena del menú: un árbol de lilas enorme que llena la pantalla, visto de
// frente y desde abajo; bruma alta en luz; Grecia pequeña en el camino,
// de espaldas, caminando hacia el árbol. Lo estático se pinta una vez en
// PixelBuffers; por cuadro solo pétalos, destellos, bokeh, niebla y la chica.
import { PixelBuffer, hex, sprite, type RGBA } from '../engine/pixels';
import { Rng } from '../engine/rng';
import { VW, VH, SW, SH } from '../engine/stage';
import { C } from '../art/palette';
import { GRECIA, SPRIG, type DirSprites } from '../art/sprites';
import { ACTION, type Input } from '../engine/input';

const HORIZON = 150;
const TRUNK = { x: 168, base: HORIZON + 4, top: 98 };
const GIRL = { x: 138, y: 136 };
// Ventana nítida del fondo (elipse) entre el panel y el racimo de primer
// plano: tronco y Grecia. Hacia los lados el fondo se funde con la capa borrosa.
const FOCUS = { x: 155, y: 118, inner: 42, outer: 112, aspect: 0.9 };

interface Petal { x: number; y: number; vx: number; vy: number; amp: number; w: number; ph: number; kind: number; col: string }
interface Bokeh { x: number; y: number; r: number; vy: number; ph: number; col: string }
interface Sparkle { x: number; y: number; w: number; ph: number }
interface Fog { x: number; y: number; rx: number; ry: number; v: number; a: number }
interface Fly { x: number; y: number; cx: number; cy: number; ph: number; col: string }
// Flor o pétalo que vuela con el viento al empezar el juego.
interface Flyer { x: number; y: number; vx: number; vy: number; delay: number; ph: number; img: HTMLCanvasElement; near: boolean }
// Arbusto en el suelo. `baseY` decide si Grecia pasa por delante o por detrás.
type Secret = 'none' | 'butterflies' | 'birds';
interface Prop { img: HTMLCanvasElement; x: number; y: number; cx: number; baseY: number; r: number; secret: Secret; used: boolean; shake: number }
// Mariposa, pájaro o pétalo que sale de un arbusto.
interface Critter { kind: 'butterfly' | 'bird' | 'puff'; x: number; y: number; vx: number; vy: number; ph: number; t: number; life: number; col: string }
type Facing = 'up' | 'down' | 'left' | 'right';
interface Player { x: number; y: number; facing: Facing; moving: boolean; walkT: number }
interface DirCanvases { idle: HTMLCanvasElement[]; walk: HTMLCanvasElement[] }
const SPEED_X = 40, SPEED_Y = 24;  // px/s
const GIRL_W = 12, GIRL_H = 23;

const PETAL_COLS = [C.lilac, C.lilacLight, C.lilacMid, C.lilacPale];
type Pt = [number, number];

export class TitleScene {
  private readonly back: HTMLCanvasElement;      // fondo con la ventana de enfoque
  private readonly backFull: HTMLCanvasElement;  // fondo nítido completo (modo juego)
  private readonly trunk: HTMLCanvasElement;     // tronco aparte: Grecia pasa delante o detrás
  private readonly front: HTMLCanvasElement;  // racimo de primer plano, nítido
  private readonly frontSoft: HTMLCanvasElement; // flores fuera de foco (capa haze)
  private readonly softStatic: HTMLCanvasElement;
  private readonly overlay: HTMLCanvasElement;
  private readonly sprites: Record<Facing, DirCanvases>;
  private readonly girlShadow: HTMLCanvasElement;
  private readonly player: Player = { x: GIRL.x, y: GIRL.y, facing: 'up', moving: false, walkT: 0 };
  private mode: 'menu' | 'game' = 'menu';
  private focus = 1; // 1 = ventana de enfoque + niebla del menú · 0 = todo nítido (juego)
  private readonly props: Prop[] = [];
  private readonly marker: HTMLCanvasElement;
  private critters: Critter[] = [];
  private nearProp: Prop | null = null;
  private gameT = 0;      // segundos desde que empezó el juego
  private frontAlpha = 1; // opacidad del racimo estático del frente
  private flyers: Flyer[] = [];
  private readonly petals: Petal[] = [];
  private readonly bokeh: Bokeh[] = [];
  private readonly sparkles: Sparkle[] = [];
  private readonly fog: Fog[] = [];
  private readonly flies: Fly[] = [
    { x: 150, y: 92, cx: 150, cy: 92, ph: 0, col: C.butterfly },
    { x: 180, y: 120, cx: 180, cy: 120, ph: 2.1, col: C.butterfly2 },
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
    const trunk = new PixelBuffer(VW, VH);
    paintTrunk(trunk);
    for (const [cx, baseY, r] of BUSHES) {
      const img = renderBush(rng, r);
      const v = rng.next();
      this.props.push({
        img: img.toCanvas(), x: cx - (img.w >> 1), y: baseY - img.h + 3, cx, baseY, r,
        secret: v < 0.42 ? 'none' : v < 0.74 ? 'butterflies' : 'birds', used: false, shake: 0,
      });
    }
    this.marker = sprite(MARKER_ROWS, { O: C.lilacDark, W: C.white, Z: C.lilacDeep }).toCanvas();

    const front = new PixelBuffer(VW, VH);
    paintForeground(front, rng, dew);
    const edge = new PixelBuffer(VW, VH);
    paintForegroundBlur(edge, rng);

    // La versión borrosa se calcula sobre la imagen completa.
    const full = new PixelBuffer(VW, VH);
    full.blit(back, 0, 0);
    for (const pr of this.props) if (pr.baseY <= TRUNK.base + 1) full.blit(PixelBuffer_from(pr.img), pr.x, pr.y);
    full.blit(trunk, 0, 0);
    for (const pr of this.props) if (pr.baseY > TRUNK.base + 1) full.blit(PixelBuffer_from(pr.img), pr.x, pr.y);
    full.blit(front, 0, 0);
    this.softStatic = makeSoft(full.toCanvas());
    this.backFull = back.toCanvas();
    this.back = makeFocused(this.backFull);
    this.trunk = trunk.toCanvas();
    this.front = front.toCanvas();
    this.frontSoft = downsample(edge.toCanvas());
    this.overlay = makeOverlay();
    this.icon = SPRIG.toCanvas();

    const toCanvases = (d: DirSprites): DirCanvases => ({ idle: d.idle.map((f) => f.toCanvas()), walk: d.walk.map((f) => f.toCanvas()) });
    const right = toCanvases(GRECIA.side);
    this.sprites = { up: toCanvases(GRECIA.back), down: toCanvases(GRECIA.front), right, left: { idle: right.idle.map(flipX), walk: right.walk.map(flipX) } };
    const sh = new PixelBuffer(GIRL_W, 4);
    sh.ellipse(6, 2, 5, 1, hex(C.shadow, 60));
    this.girlShadow = sh.toCanvas();

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
      x: r.range(20, 200),
      y: anywhere ? r.range(0, VH) : r.range(-24, -4),
      vx: r.range(1, 5), vy: r.range(7, 15),
      amp: r.range(3, 8), w: r.range(1.2, 2.6), ph: r.range(0, 6.28),
      kind: k < 0.12 ? 2 : k < 0.55 ? 0 : 1,
      col: r.pick(PETAL_COLS),
    };
  }

  /** Tras el menú: se despeja la escena y Grecia pasa a controlarse con el teclado. */
  startGame(): void {
    if (this.mode === 'game') return;
    this.mode = 'game';
    this.spawnFlyers();
  }

  // El racimo del frente se deshace en flores y pétalos que el viento lleva
  // hacia la izquierda, por delante de nosotros. Las más cercanas van borrosas.
  private spawnFlyers(): void {
    const rng = new Rng(4242);
    const florets = [5, 6, 7, 8, 10, 12, 14].flatMap((S) => [0.2, 0.9].map((rot) => renderFloret(rng, S, rot)));
    const petals = PETAL_COLS.flatMap((c) => [renderPetal(c, 0), renderPetal(c, 1)]);
    const weights = FG_MASS.map(([, , r]) => r * r);
    const totalW = weights.reduce((a, b) => a + b, 0);
    const pickMass = () => {
      let u = rng.next() * totalW;
      for (let i = 0; i < FG_MASS.length; i++) { u -= weights[i]; if (u <= 0) return FG_MASS[i]; }
      return FG_MASS[FG_MASS.length - 1];
    };
    const spawn = (img: HTMLCanvasElement, near: boolean, speed: number) => {
      const [mx, my, r] = pickMass();
      const a = rng.range(0, 6.28), d = Math.sqrt(rng.next()) * r;
      const x = mx + Math.cos(a) * d, y = my + Math.sin(a) * d;
      this.flyers.push({
        x, y, img, near,
        vx: -(speed + rng.range(0, 90)), vy: -rng.range(10, 55),
        // Se desprenden primero las del borde izquierdo, luego el resto.
        delay: 0.4 + rng.range(0, 0.9) + Math.max(0, (x - 200) / 120) * 0.6,
        ph: rng.range(0, 6.28),
      });
    };
    for (let i = 0; i < 64; i++) spawn(rng.pick(florets), false, 80);
    for (let i = 0; i < 12; i++) spawn(florets[florets.length - 1 - rng.int(4)], true, 140);
    for (let i = 0; i < 110; i++) spawn(rng.pick(petals), false, 60);
  }

  private girlFrame(): HTMLCanvasElement {
    const set = this.sprites[this.player.facing];
    if (this.player.moving) return set.walk[Math.floor(this.player.walkT / 0.16) & 1];
    return set.idle[Math.floor(this.t / 0.75) % set.idle.length];
  }

  private movePlayer(dt: number, input: Input): void {
    const p = this.player;
    const [ax, ay] = input.axis;
    p.moving = ax !== 0 || ay !== 0;
    if (!p.moving) { p.walkT = 0; return; }
    p.walkT += dt;
    p.facing = ax !== 0 ? (ax > 0 ? 'right' : 'left') : ay > 0 ? 'down' : 'up';
    const clampX = (x: number) => Math.min(VW - GIRL_W + 2, Math.max(-2, x));
    const clampY = (y: number) => Math.min(VH - GIRL_H, Math.max(HORIZON - GIRL_H + 2, y));
    // La huella del tronco en el suelo bloquea el paso; se intenta cada eje por separado.
    const blocked = (x: number, y: number) => {
      const fx = x + GIRL_W / 2, fy = y + GIRL_H - 1;
      return fx > TRUNK.x - 10 && fx < TRUNK.x + 10 && fy > TRUNK.base - 4 && fy < TRUNK.base + 5;
    };
    const nx = clampX(p.x + ax * SPEED_X * dt), ny = clampY(p.y + ay * SPEED_Y * dt);
    if (!blocked(nx, ny)) { p.x = nx; p.y = ny; }
    else if (!blocked(nx, p.y)) p.x = nx;
    else if (!blocked(p.x, ny)) p.y = ny;
  }

  private findNearProp(): Prop | null {
    const fx = this.player.x + GIRL_W / 2, fy = this.player.y + GIRL_H - 1;
    let best: Prop | null = null, bestD = Infinity;
    for (const pr of this.props) {
      const dx = Math.abs(fx - pr.cx), dy = Math.abs(fy - pr.baseY);
      if (dx > pr.r + 9 || dy > 12) continue;
      const d = dx + dy * 2;
      if (d < bestD) { bestD = d; best = pr; }
    }
    return best;
  }

  // J sobre un arbusto: se sacude y suelta lo que esconde (una sola vez).
  private poke(pr: Prop): void {
    pr.shake = 0.5;
    const r = this.rng;
    const top = pr.baseY - pr.r * 2;
    for (let i = 0; i < 4; i++) {
      this.critters.push({ kind: 'puff', x: pr.cx + r.range(-pr.r, pr.r), y: top + r.range(0, pr.r), vx: r.range(-22, 22), vy: r.range(-40, -15), ph: 0, t: 0, life: 1.2, col: r.pick(PETAL_COLS) });
    }
    if (pr.used || pr.secret === 'none') return;
    pr.used = true;
    const away = this.player.x + GIRL_W / 2 < pr.cx ? 1 : -1;
    if (pr.secret === 'butterflies') {
      const n = 4 + r.int(4);
      for (let i = 0; i < n; i++) {
        this.critters.push({ kind: 'butterfly', x: pr.cx + r.range(-pr.r * 0.6, pr.r * 0.6), y: top + r.range(0, pr.r * 0.8), vx: r.range(-14, 14) + away * 6, vy: r.range(-22, -8), ph: r.range(0, 6.28), t: -r.range(0, 0.5), life: r.range(5, 8), col: r.pick([C.butterfly, C.butterfly2, '#f7d6e6', C.lilacLight]) });
      }
    } else {
      const n = 3 + r.int(3);
      for (let i = 0; i < n; i++) {
        this.critters.push({ kind: 'bird', x: pr.cx + r.range(-pr.r * 0.5, pr.r * 0.5), y: top + r.range(0, pr.r * 0.6), vx: away * r.range(45, 85) + r.range(-10, 10), vy: -r.range(70, 110), ph: r.range(0, 6.28), t: -r.range(0, 0.35), life: 6, col: r.pick(['#6e5c57', '#5a4c48', '#7d6a62']) });
      }
    }
  }

  private updateCritters(dt: number): void {
    for (let i = this.critters.length - 1; i >= 0; i--) {
      const c = this.critters[i];
      c.t += dt;
      if (c.t < 0) continue; // sale con un pequeño retraso
      if (c.kind === 'puff') {
        c.vy += 70 * dt;
        c.x += c.vx * dt; c.y += c.vy * dt;
      } else if (c.kind === 'butterfly') {
        c.vy += (-14 - c.vy) * 0.4 * dt; // termina subiendo despacio
        c.x += (c.vx + Math.sin(c.t * 4.2 + c.ph) * 22) * dt;
        c.y += (c.vy + Math.cos(c.t * 2.6 + c.ph) * 14) * dt;
      } else {
        c.vy += (-28 - c.vy) * 0.9 * dt; // arranque fuerte, luego planea
        c.x += c.vx * dt;
        c.y += (c.vy + Math.sin(c.t * 6 + c.ph) * 6) * dt;
      }
      if (c.t > c.life || c.y < -12 || c.x < -12 || c.x > VW + 12) this.critters.splice(i, 1);
    }
  }

  update(dt: number, input?: Input): void {
    this.t += dt;
    if (this.mode === 'game') {
      this.gameT += dt;
      if (this.focus > 0) this.focus = Math.max(0, this.focus - dt / 1.8);
      this.frontAlpha = Math.max(0, Math.min(1, 1 - (this.gameT - 0.55) / 0.9));
      if (input) {
        this.movePlayer(dt, input);
        this.nearProp = this.findNearProp();
        if (input.take(ACTION) && this.nearProp) this.poke(this.nearProp);
      }
      for (const pr of this.props) if (pr.shake > 0) pr.shake = Math.max(0, pr.shake - dt);
      this.updateCritters(dt);
      for (let i = this.flyers.length - 1; i >= 0; i--) {
        const f = this.flyers[i];
        const age = this.gameT - f.delay;
        if (age <= 0) continue;
        const k = Math.min(1, age / 0.6); // arranque suave
        f.x += f.vx * k * k * dt;
        f.y += (f.vy * k + Math.sin(this.t * 3 + f.ph) * 28) * dt;
        if (f.x < -40 || f.y < -40) this.flyers.splice(i, 1);
      }
    }
    for (let i = 0; i < this.petals.length; i++) {
      const p = this.petals[i];
      p.y += p.vy * dt;
      p.x += (p.vx + Math.cos(this.t * p.w + p.ph) * p.amp) * dt;
      if (p.y > VH + 2 || p.x > 215) this.petals[i] = this.newPetal(false);
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
    if (this.focus < 1) {
      crisp.globalAlpha = 1 - this.focus;
      crisp.drawImage(this.backFull, 0, 0);
      crisp.globalAlpha = 1;
    }

    // Todo lo que pisa el suelo se dibuja de atrás hacia adelante según su base.
    const p = this.player;
    const gx = Math.round(p.x), gy = Math.round(p.y);
    const img = this.girlFrame();
    type Drawable = { baseY: number; draw: () => void };
    const items: Drawable[] = [
      { baseY: TRUNK.base + 1, draw: () => crisp.drawImage(this.trunk, 0, 0) },
      { baseY: p.y + GIRL_H - 1, draw: () => { crisp.drawImage(this.girlShadow, gx, gy + GIRL_H - 2); crisp.drawImage(img, gx, gy); } },
    ];
    for (const pr of this.props) {
      // En el menú los arbustos fuera de la ventana de enfoque se funden con el fondo borroso.
      const alpha = this.focus > 0 ? 1 - this.focus * (1 - focusAt(pr.cx, pr.baseY)) : 1;
      const sx = pr.shake > 0 ? Math.round(Math.sin(pr.shake * 40) * 1.5) : 0;
      items.push({ baseY: pr.baseY, draw: () => {
        if (alpha <= 0) return;
        crisp.globalAlpha = alpha;
        crisp.drawImage(pr.img, pr.x + sx, pr.y);
        crisp.globalAlpha = 1;
      } });
    }
    items.sort((a, b) => a.baseY - b.baseY);
    for (const it of items) it.draw();

    if (this.nearProp && this.mode === 'game') {
      const m = this.nearProp;
      crisp.drawImage(this.marker, m.cx - 4, m.baseY - m.r * 2 - 14 + Math.round(Math.sin(this.t * 4) * 1.2));
    }
    for (const c of this.critters) {
      if (c.t < 0) continue;
      const x = Math.round(c.x), y = Math.round(c.y);
      crisp.fillStyle = c.col;
      if (c.kind === 'puff') {
        crisp.globalAlpha = Math.max(0, 1 - c.t / c.life);
        crisp.fillRect(x, y, 2, 2);
        crisp.globalAlpha = 1;
      } else if (c.kind === 'butterfly') {
        if (c.t > c.life - 1) crisp.globalAlpha = c.life - c.t;
        if (Math.sin(c.t * 9 + c.ph) > 0) { crisp.fillRect(x - 1, y, 3, 1); crisp.fillRect(x - 1, y - 1, 1, 1); crisp.fillRect(x + 1, y - 1, 1, 1); }
        else crisp.fillRect(x, y - 1, 1, 2);
        crisp.globalAlpha = 1;
      } else {
        // Pájaro: cuerpo y alas que baten.
        const up = Math.sin(c.t * 11 + c.ph) > 0;
        crisp.fillRect(x - 1, y, 3, 1);
        crisp.fillStyle = '#e9dfd6';
        crisp.fillRect(x, y, 1, 1);
        crisp.fillStyle = c.col;
        crisp.fillRect(x - 2, up ? y - 1 : y + 1, 1, 1); crisp.fillRect(x + 2, up ? y - 1 : y + 1, 1, 1);
        crisp.fillRect(x + (c.vx > 0 ? 2 : -2), y, 1, 1);
      }
    }

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

    if (this.frontAlpha > 0) {
      crisp.globalAlpha = this.frontAlpha;
      crisp.drawImage(this.front, 0, 0);
      crisp.globalAlpha = 1;
    }
    for (const f of this.flyers) {
      if (f.near || this.gameT < f.delay) continue;
      crisp.drawImage(f.img, Math.round(f.x - f.img.width / 2), Math.round(f.y - f.img.height / 2));
    }

    for (const s of this.sparkles) {
      const a = Math.sin(this.t * s.w + s.ph) * this.frontAlpha;
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
    if (this.frontAlpha > 0) {
      haze.globalAlpha = this.frontAlpha;
      haze.drawImage(this.frontSoft, 0, 0);
      haze.globalAlpha = 1;
    }
    // Flores que pasan muy cerca de la cámara: grandes y borrosas.
    for (const f of this.flyers) {
      if (!f.near || this.gameT < f.delay) continue;
      const w = f.img.width * 0.45, h = f.img.height * 0.45;
      haze.drawImage(f.img, f.x / 4 - w / 2, f.y / 4 - h / 2, w, h);
    }
    const fogK = 0.4 + 0.6 * this.focus;
    for (const f of this.fog) {
      const g = haze.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.rx);
      g.addColorStop(0, `rgba(252,250,255,${(f.a * fogK).toFixed(3)})`);
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

// Ciudad al fondo, casi disuelta en la neblina: dos filas de edificios;
// la de atrás más alta y más tenue. La bruma es más densa cerca del suelo.
function paintCity(pb: PixelBuffer, rng: Rng): void {
  const rows: [number, number, number, number][] = [[0.9, 26, 70, 0.02], [0.82, 14, 44, 0.05]]; // [niebla, alto mín, alto máx, prob. ventana]
  for (const [k0, hMin, hMax, win] of rows) {
    let x = -8 + rng.int(6);
    while (x < VW + 4) {
      const w = 9 + rng.int(18), h = hMin + rng.int(hMax - hMin);
      const top = HORIZON - h;
      const tone = rng.pick([C.lilacDeep, C.canopyShade, C.trunkDark]);
      for (let y = top; y < HORIZON; y++) {
        const k = Math.min(0.96, k0 + ((y - top) / h) * 0.09);
        pb.hline(x, x + w - 1, y, fogged(tone, k));
        // Ventanas: puntos apenas más oscuros, en rejilla.
        if (y > top + 2 && (y - top) % 3 === 0) {
          for (let wx = x + 2; wx < x + w - 1; wx += 3) {
            if (rng.next() < win * 8) pb.set(wx, y, fogged(C.lilacDeep, k - 0.06));
          }
        }
      }
      // Azotea: cornisa un poco más clara y, a veces, una antena.
      pb.hline(x, x + w - 1, top, fogged(C.lilacLight, k0 - 0.05));
      if (rng.next() < 0.3) pb.rect(x + 1 + rng.int(Math.max(1, w - 2)), top - 2 - rng.int(4), 1, 4, fogged(tone, k0));
      x += w + rng.int(3);
    }
  }
}

// Árboles lejanos perdidos en la bruma, para dar profundidad.
function paintDistance(pb: PixelBuffer, rng: Rng): void {
  paintCity(pb, rng);
  const trees: [number, number, number][] = [[60, 118, 0.8], [118, 124, 0.86], [205, 120, 0.84]];
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
  const path: Pt[] = [[104, VH + 2], [156, VH + 2], [TRUNK.x + 5, TRUNK.base], [TRUNK.x - 9, TRUNK.base]];
  pb.poly(path, fogged(C.pathDark, 0.15));
  pb.poly([[110, VH + 2], [150, VH + 2], [TRUNK.x + 3, TRUNK.base + 1], [TRUNK.x - 7, TRUNK.base + 1]], fogged(C.path, 0.15));
  for (let i = 0; i < 26; i++) {
    const t = rng.next(), y = VH - t * (VH - TRUNK.base - 1);
    const cx = 130 + (TRUNK.x - 2 - 130) * t, half = (20 - 14 * t);
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
  const branches: [Pt, Pt][] = [[[TRUNK.x - 2, 104], [112, 66]], [[TRUNK.x - 1, 100], [156, 44]], [[TRUNK.x + 2, 104], [231, 62]], [[TRUNK.x + 3, 110], [248, 104]]];
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

// ───────────────────────── arbustos e interacción ─────────────────────────

// [centro x, base y, radio]. Evitan el camino y la base del tronco.
const BUSHES: [number, number, number][] = [
  [16, 176, 11], [52, 163, 9], [86, 173, 10], [30, 156, 7], [122, 156, 7],
  [196, 175, 11], [232, 161, 9], [268, 177, 12], [300, 159, 8], [250, 153, 7], [178, 178, 8],
];

// Burbuja con la J que aparece sobre el arbusto cercano.
const MARKER_ROWS = [
  '.OOOOOOO.',
  'OWWWWWWWO',
  'OWZZZZZWO',
  'OWWWWZWWO',
  'OWWWWZWWO',
  'OWZWWZWWO',
  'OWWZZZWWO',
  'OWWWWWWWO',
  '.OOOOOOO.',
  '....O....',
];

// Arbusto de lila: follaje redondo con dos a cuatro racimos pequeños encima.
function renderBush(rng: Rng, r: number): PixelBuffer {
  const w = r * 2 + 12, h = r * 2 + 10;
  const pb = new PixelBuffer(w, h);
  const cx = w >> 1, cy = h - 5 - r;
  pb.ellipse(cx, h - 3, r + 2, 2, hex(C.shadow, 60));
  pb.circle(cx + 1, cy + 2, r, hex(C.leafDark));
  pb.circle(cx, cy, r - 1, hex(C.leaf));
  pb.circle(cx - Math.round(r * 0.35), cy - Math.round(r * 0.35), Math.max(1, Math.round(r * 0.4)), hex(C.leafLight));
  for (let i = 0; i < r * 2; i++) {
    const a = rng.range(0, 6.28), d = Math.sqrt(rng.next()) * (r - 1);
    pb.set(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), hex(rng.pick([C.leafDark, C.leafLight])));
  }
  const n = 2 + rng.int(3);
  for (let i = 0; i < n; i++) {
    const px = cx + Math.round(rng.range(-r * 0.6, r * 0.6)), py = cy + Math.round(rng.range(-r * 0.1, r * 0.4));
    panicle(pb, rng, px, py, Math.round(r * 0.9) + 3, Math.round(r * 0.6) + 3, rng.range(-0.5, 0.5), r >= 10 ? 2 : 1, 0.04, Math.round(r * 2.2));
  }
  return pb;
}

// Valor de la máscara de enfoque en un punto (1 nítido … 0 borroso).
function focusAt(x: number, y: number): number {
  const dx = (x - FOCUS.x) / FOCUS.aspect, dy = y - FOCUS.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  return Math.max(0, Math.min(1, (FOCUS.outer - d) / (FOCUS.outer - FOCUS.inner)));
}

function PixelBuffer_from(c: HTMLCanvasElement): PixelBuffer {
  const pb = new PixelBuffer(c.width, c.height);
  pb.data.set(c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data);
  return pb;
}

// ───────────────────────── primer plano: la foto ─────────────────────────

interface Tone { light: string; mid: string; dark: string; deep: string }
const TONE_LILAC: Tone = { light: '#ebe3f9', mid: '#c9b6ec', dark: '#a893dc', deep: '#8a72c4' };
const TONE_PINK: Tone = { light: '#f1e6f8', mid: '#d4bceb', dark: '#b89ad8', deep: '#9776bf' };
// Luz desde arriba a la izquierda.
const LIGHT: Pt = [-0.707, -0.707];
// Círculos que definen el volumen del racimo de primer plano.
const FG_MASS: [number, number, number][] = [[275, 105, 46], [300, 60, 38], [258, 150, 36], [300, 150, 40], [270, 30, 30], [318, 105, 34], [236, 120, 22]];

// Sprites sueltos para el viento.
function renderFloret(rng: Rng, S: number, rot: number): HTMLCanvasElement {
  const size = Math.ceil(S * 2.3) + 4;
  const pb = new PixelBuffer(size, size);
  bigFloret(pb, rng, size >> 1, size >> 1, S, rot, 0.04);
  return pb.toCanvas();
}
function renderPetal(col: string, kind: number): HTMLCanvasElement {
  const pb = new PixelBuffer(3, 2);
  const c = hex(col);
  if (kind === 0) { pb.rect(0, 0, 2, 2, c); }
  else { pb.rect(0, 0, 2, 1, c); pb.rect(1, 1, 2, 1, c); }
  return pb.toCanvas();
}

// Pétalo: elipse alargada que se afina hacia la punta, rotada `ang`.
// `lit` (-1..1) = cuánto mira hacia la luz. `solid` pinta silueta plana.
function petal(pb: PixelBuffer, cx: number, cy: number, S: number, ang: number, tone: Tone, lit: number, k: number, solid?: RGBA): void {
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
      if (e > 0.68) {
        col = lit > 0.15 ? tone.light : lit < -0.3 ? tone.dark : chk ? tone.light : tone.mid;
      } else if (Math.abs(v) < rb * 0.22 && u < ra * 0.35) {
        col = u < -ra * 0.3 ? tone.deep : chk ? tone.dark : tone.mid;
      } else if (lit > 0.4) {
        col = chk && e > 0.4 ? tone.light : tone.mid;
      } else if (lit < -0.3) {
        col = chk ? tone.mid : tone.dark;
      } else {
        col = tone.mid;
      }
      pb.set(x, y, fogged(col, k));
    }
  }
}

function dewDrop(pb: PixelBuffer, x: number, y: number, r: number, k: number): void {
  pb.circle(x, y, r, [255, 255, 255, 105]);
  pb.set(x + r, y + r - 1, fogged(C.lilacDeep, k).map((c, i) => (i === 3 ? 120 : c)) as RGBA);
  pb.set(x - 1, y - 1, [255, 255, 255, 235]);
}

// Flor de lila grande: 4 pétalos (los iluminados encima), garganta oscura,
// punto amarillo y, si es grande, una gota de rocío.
function bigFloret(pb: PixelBuffer, rng: Rng, cx: number, cy: number, S: number, rot: number, k: number, dew?: Pt[]): void {
  const tone = rng.next() < 0.3 ? TONE_PINK : TONE_LILAC;
  const petals = [0, 1, 2, 3].map((i) => {
    const ang = rot + (i * Math.PI) / 2;
    return { ang, lit: -(Math.cos(ang) * -LIGHT[0] + Math.sin(ang) * -LIGHT[1]) };
  });
  petals.sort((a, b) => a.lit - b.lit);
  // Silueta oscura un píxel más grande: separa esta flor de las de atrás.
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

// Capullo: óvalo pequeño rosa-lila, más claro en la punta.
function budBig(pb: PixelBuffer, x: number, y: number, ang: number, len: number, k: number): void {
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

function paintForeground(pb: PixelBuffer, rng: Rng, dew: Pt[]): void {
  // Sombra entre flores: solo donde el racimo es denso (más chica que las flores).
  const mass = FG_MASS;
  for (const [x, y, r] of mass) pb.circle(x, y, r - 7, fogged(C.lilacDeep, 0.1));
  // Relleno denso de flores medianas, de atrás (más brumosas) hacia adelante.
  // Muestreo ponderado por área para que los círculos grandes no queden ralos.
  const weights = mass.map(([, , r]) => r * r);
  const totalW = weights.reduce((a, b) => a + b, 0);
  const pickMass = () => {
    let u = rng.next() * totalW;
    for (let i = 0; i < mass.length; i++) { u -= weights[i]; if (u <= 0) return mass[i]; }
    return mass[mass.length - 1];
  };
  const fill: [number, number, number][] = [];
  for (let i = 0; i < 170; i++) {
    const [x, y, r] = pickMass();
    const a = rng.range(0, 6.28), d = Math.sqrt(rng.next()) * (r - 3);
    fill.push([Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), 5 + rng.int(4)]);
  }
  fill.sort((a, b) => a[2] - b[2]);
  fill.forEach(([x, y, S], i) => bigFloret(pb, rng, x, y, S, rng.range(0, 1.57), 0.22 - 0.16 * (i / fill.length)));
  // Flores grandes, de atrás hacia adelante (la protagonista al final).
  const big: [number, number, number, number][] = [
    [218, 68, 8, 0.5], [240, 32, 9, 0.1], [222, 104, 9, 0.7], [286, 30, 10, -0.6], [250, 68, 11, 0.4],
    [316, 112, 12, -0.2], [268, 176, 12, 0.3], [236, 140, 12, -0.3], [308, 176, 11, 0.9], [300, 70, 13, 0.6],
    [292, 152, 14, 0.9], [270, 108, 17, 0.15],
  ];
  for (const [x, y, S, rot] of big) bigFloret(pb, rng, x, y, S, rot, 0.04, dew);
  // Capullos: racimito abajo a la izquierda y en el borde superior derecho.
  const budSpots: [number, number, number][] = [
    [224, 156, -0.9], [230, 166, -0.6], [219, 170, -1.2], [236, 174, -0.4], [214, 148, -1.4], [242, 164, -0.2],
    [306, 12, 0.8], [316, 22, 1.1], [298, 8, 0.4], [214, 128, -1.0],
  ];
  for (const [x, y, a] of budSpots) budBig(pb, x, y, a, 5 + rng.int(3), 0.06);
  // Tallitos entre los capullos.
  for (const [x, y] of [[226, 160], [232, 170], [220, 174]] as Pt[]) {
    pb.set(x, y, fogged(C.leafDark, 0.1)); pb.set(x + 1, y + 1, fogged(C.leafDark, 0.1)); pb.set(x + 2, y + 2, fogged(C.leaf, 0.1));
  }
}

// Flores fuera de foco: se dibujan nítidas aquí y se reducen a 80×45 para la
// capa `haze`, que las estira con suavizado (borroso de verdad, sin costo).
function paintForegroundBlur(pb: PixelBuffer, rng: Rng): void {
  const blurry: [number, number, number, number, number][] = [
    [204, 56, 10, 0.3, 0.3], [192, 98, 11, -0.4, 0.3], [206, 138, 10, 0.6, 0.25], [198, 172, 9, 0.1, 0.3],
    [226, 10, 9, -0.2, 0.35], [40, 164, 12, 0.5, 0.65], [16, 26, 11, -0.3, 0.7], [300, 40, 16, 0.2, 0.2],
  ];
  for (const [x, y, S, rot, k] of blurry) bigFloret(pb, rng, x, y, S, rot, k);
  for (const [x, y, a] of [[208, 118, -1.1], [200, 152, -0.8], [212, 32, 0.6]] as [number, number, number][]) budBig(pb, x, y, a, 6, 0.3);
}

function flipX(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

function downsample(layer: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = SW; c.height = SH;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(layer, 0, 0, SW, SH);
  return c;
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
  // Aclarado bajo el panel del menú (izquierda).
  const l = ctx.createLinearGradient(150, 0, 0, 0);
  l.addColorStop(0, 'rgba(250,247,255,0)');
  l.addColorStop(1, 'rgba(250,247,255,0.45)');
  ctx.fillStyle = l;
  ctx.fillRect(0, 0, VW, VH);
  return c;
}
