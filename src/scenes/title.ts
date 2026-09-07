// Escena principal: el jardín de lilas. Empieza como menú (una pantalla, con
// ventana de enfoque y bruma) y, tras el nombre, se abre en un paseo de
// cuatro pantallas con cámara y parallax. Lo estático se pinta una vez en
// PixelBuffers; por cuadro solo se componen capas y se dibujan los sprites.
import { PixelBuffer, hex, sprite, type RGBA } from '../engine/pixels';
import { Rng } from '../engine/rng';
import { VW, VH, SW, SH } from '../engine/stage';
import { C } from '../art/palette';
import { GRECIA, GRECIA_SEATED, HIM_SEATED, SPRIG, type DirSprites } from '../art/sprites';
import { ACTION, type Input } from '../engine/input';

export const WORLD_W = 1440;
const HORIZON = 150;
// De día junto al árbol; al caminar a la derecha cae la noche.
const NIGHT_FROM = 340, NIGHT_TO = 660;
const nightAt = (x: number) => { const t = Math.min(1, Math.max(0, (x - NIGHT_FROM) / (NIGHT_TO - NIGHT_FROM))); return t * t * (3 - 2 * t); };
// La esquina verde: pared, puerta y ventana de su casa, y la calle que dobla.
// x0..x1 pavimento · wallX0..wallX1 la pared · house su casa · streetX0..x1 la calle que entra
const STREET = { x0: 600, wallX0: 612, wallX1: 986, house: 996, streetX0: 1040, x1: 1096, wallTop: 92, pole: 1064 };
const BENCH = { x: 1190, baseY: 165 };
const PAR_FAR = 0.2, PAR_MID = 0.45;
const FAR_W = Math.ceil(VW + PAR_FAR * (WORLD_W - VW));
const MID_W = Math.ceil(VW + PAR_MID * (WORLD_W - VW));
const MAIN_TREE = { x: 168, base: HORIZON + 4, top: 98 };
const GIRL_START = { x: 138, y: 136 };
// Ventana nítida del menú (elipse) entre el panel y el racimo de primer plano.
const FOCUS = { x: 155, y: 118, inner: 42, outer: 112, aspect: 0.9 };
const SPEED_X = 40, SPEED_Y = 24; // px/s
const GIRL_W = 12, GIRL_H = 23;

type Pt = [number, number];
interface Petal { x: number; y: number; vx: number; vy: number; amp: number; w: number; ph: number; kind: number; col: string }
interface Bokeh { x: number; y: number; r: number; vy: number; ph: number; col: string }
interface Sparkle { x: number; y: number; w: number; ph: number }
interface Fog { x: number; y: number; rx: number; ry: number; v: number; a: number }
interface Fly { x: number; y: number; cx: number; cy: number; ph: number; col: string }
// Flor o pétalo que vuela con el viento al empezar el juego.
interface Flyer { x: number; y: number; vx: number; vy: number; delay: number; ph: number; img: HTMLCanvasElement; near: boolean }
// Objeto en el suelo (coordenadas de mundo). `baseY` decide el orden de dibujo.
type Secret = 'none' | 'butterflies' | 'birds';
type PropKind = 'bush' | 'trunk' | 'lamp' | 'bench' | 'gate';
interface Prop { kind: PropKind; img: HTMLCanvasElement; x: number; y: number; cx: number; baseY: number; r: number; secret: Secret; used: boolean; shake: number; solid?: { hw: number; depth: number } }
// Mariposa, pájaro o pétalo que sale de un arbusto (coordenadas de mundo).
interface Critter { kind: 'butterfly' | 'bird' | 'puff'; x: number; y: number; vx: number; vy: number; ph: number; t: number; life: number; col: string }
type Facing = 'up' | 'down' | 'left' | 'right';
interface Player { x: number; y: number; facing: Facing; moving: boolean; walkT: number; sitting: boolean }
// Luz nocturna (mundo): farol o ventana; brilla según lo oscuro que esté ahí.
interface Light { x: number; y: number; r: number; col: string; a: number }
interface Star { x: number; y: number; ph: number }
interface DirCanvases { idle: HTMLCanvasElement[]; walk: HTMLCanvasElement[] }

const PETAL_COLS = [C.lilac, C.lilacLight, C.lilacMid, C.lilacPale];

export class TitleScene {
  // Capas estáticas (de atrás hacia adelante).
  private readonly sky: HTMLCanvasElement;      // pantalla, no se mueve
  private readonly skyDusk: HTMLCanvasElement;
  private readonly skyNight: HTMLCanvasElement;
  private readonly far: HTMLCanvasElement;      // ciudad en la neblina (parallax 0.2)
  private readonly farNight: HTMLCanvasElement; // la misma ciudad con ventanas encendidas
  private readonly mid: HTMLCanvasElement;      // árboles lejanos (parallax 0.45)
  private readonly world: HTMLCanvasElement;    // suelo, paseo y copas (1:1)
  private readonly menuBack: HTMLCanvasElement; // composición del menú con ventana de enfoque
  private readonly softStatic: HTMLCanvasElement;
  private readonly front: HTMLCanvasElement;     // racimo de la foto, nítido (pantalla)
  private readonly frontSoft: HTMLCanvasElement; // flores fuera de foco (capa haze)
  private readonly overlay: HTMLCanvasElement;
  private readonly frame: CanvasRenderingContext2D; // composición viva de cada cuadro
  private readonly sprites: Record<Facing, DirCanvases>;
  private readonly girlShadow: HTMLCanvasElement;
  private readonly marker: HTMLCanvasElement;
  private readonly seated: HTMLCanvasElement;
  private readonly lights: Light[] = [];
  // Luz roja de la cámara de la caseta (parpadea).
  private readonly cameraLed: Pt = [STREET.house + 1, HORIZON - 27];
  private readonly stars: Star[] = [];
  readonly icon: HTMLCanvasElement;

  private readonly props: Prop[] = [];
  private readonly player: Player = { x: GIRL_START.x, y: GIRL_START.y, facing: 'up', moving: false, walkT: 0, sitting: false };
  private camX = 0;
  private mode: 'menu' | 'game' = 'menu';
  private focus = 1;      // 1 = menú (enfoque + niebla) · 0 = juego (todo nítido)
  private gameT = 0;
  private frontAlpha = 1;
  private nearProp: Prop | null = null;
  private flyers: Flyer[] = [];
  private critters: Critter[] = [];
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

  constructor() {
    const rng = new Rng(20250907);
    const dew: Pt[] = [];

    // ── Capas ──
    const sky = new PixelBuffer(VW, VH);
    paintSky(sky, [C.skyTop, C.skyMid, C.skyLow, C.skyHorizon]);
    this.sky = sky.toCanvas();
    const dusk = new PixelBuffer(VW, VH);
    paintSky(dusk, [C.duskTop, C.duskMid, C.duskLow, C.duskHorizon]);
    this.skyDusk = dusk.toCanvas();
    const night = new PixelBuffer(VW, VH);
    paintSky(night, [C.nightTop, C.nightMid, C.nightLow, C.nightHorizon]);
    paintNightSky(night, rng);
    this.skyNight = night.toCanvas();
    for (let i = 0; i < 14; i++) this.stars.push({ x: rng.int(VW), y: rng.int(90), ph: rng.range(0, 6.28) });

    const citySeed = rng.int(1e9);
    const far = new PixelBuffer(FAR_W, VH);
    paintCity(far, new Rng(citySeed), FAR_W, false);
    this.far = far.toCanvas();
    const farN = new PixelBuffer(FAR_W, VH);
    paintCity(farN, new Rng(citySeed), FAR_W, true);
    this.farNight = farN.toCanvas();

    const mid = new PixelBuffer(MID_W, VH);
    paintDistantTrees(mid, rng, MID_W);
    this.mid = mid.toCanvas();

    const world = new PixelBuffer(WORLD_W, VH);
    paintGround(world, rng);
    paintStreet(world, rng);
    paintCanopyAt(world, rng, dew, 160, 40, 200, 82, 1);
    paintCanopyAt(world, rng, dew, 500, 70, 66, 44, 0.62);
    paintCanopyAt(world, rng, dew, 1128, 64, 72, 48, 0.66);
    // Luz de los faroles sobre el suelo, ya horneada (la noche no cambia).
    for (const lx of LAMPS) {
      const n = nightAt(lx);
      if (n > 0.05) world.ellipse(lx, 172, 26, 7, [255, 225, 160, Math.round(70 * n)]);
    }
    this.world = world.toCanvas();

    // ── Objetos ──
    this.addTrunk(rng, MAIN_TREE.x, MAIN_TREE.base, MAIN_TREE.top, 8, [[[-2, 104], [112, 66]], [[-1, 100], [156, 44]], [[2, 104], [231, 62]], [[3, 110], [248, 104]]], 10);
    this.addTrunk(rng, 500, 153, 112, 4.5, [[[-1, 118], [470, 94]], [[1, 114], [506, 86]], [[2, 118], [532, 98]]], 6);
    this.addTrunk(rng, 1128, 153, 108, 5, [[[-1, 114], [1092, 88]], [[0, 110], [1134, 78]], [[2, 114], [1166, 92]]], 7);
    // Faroles al borde del pasto, sin estorbar la vereda. De noche, encendidos.
    for (const x of LAMPS) {
      this.addProp('lamp', renderLamp(nightAt(x)), x, 164, 3, { hw: 2, depth: 3 });
      this.lights.push({ x, y: 164 - 39, r: 12, col: '255,225,160', a: 0.5 * nightAt(x) });
    }
    // Poste de la calle que entra, luz del portal y ventana de su casa.
    this.lights.push({ x: STREET.pole + 5, y: 120, r: 7, col: '255,225,160', a: 0.45 });
    this.lights.push({ x: STREET.house + 10, y: HORIZON - 23, r: 5, col: '255,225,160', a: 0.32 });
    this.lights.push({ x: STREET.house + 27, y: HORIZON - 15, r: 6, col: '255,220,150', a: 0.3 });
    // La banca grande, con él sentado mirando hacia donde llegará ella.
    this.addProp('bench', renderBench(HIM_SEATED), BENCH.x, BENCH.baseY, 26, { hw: 23, depth: 3 });
    this.addProp('gate', renderGate(rng), 1412, 160, 16, { hw: 15, depth: 4 });
    this.seated = GRECIA_SEATED.toCanvas();
    for (const [cx, baseY, r] of bushSpots(rng, this.props)) {
      const v = rng.next();
      this.addProp('bush', renderBush(rng, r).toCanvas(), cx, baseY, r, undefined, v < 0.42 ? 'none' : v < 0.74 ? 'butterflies' : 'birds');
    }
    this.marker = sprite(MARKER_ROWS, { O: C.lilacDark, W: C.white, Z: C.lilacDeep }).toCanvas();

    // ── Grecia ──
    const toCanvases = (d: DirSprites): DirCanvases => ({ idle: d.idle.map((f) => f.toCanvas()), walk: d.walk.map((f) => f.toCanvas()) });
    const right = toCanvases(GRECIA.side);
    this.sprites = { up: toCanvases(GRECIA.back), down: toCanvases(GRECIA.front), right, left: { idle: right.idle.map(flipX), walk: right.walk.map(flipX) } };
    const sh = new PixelBuffer(GIRL_W, 4);
    sh.ellipse(6, 2, 5, 1, hex(C.shadow, 60));
    this.girlShadow = sh.toCanvas();

    // ── Primer plano (la foto) ──
    const front = new PixelBuffer(VW, VH);
    paintForeground(front, rng, dew);
    const edge = new PixelBuffer(VW, VH);
    paintForegroundBlur(edge, rng);
    this.front = front.toCanvas();
    this.frontSoft = downsample(edge.toCanvas());

    // ── Composiciones del menú ──
    const frame = document.createElement('canvas');
    frame.width = VW; frame.height = VH;
    this.frame = frame.getContext('2d')!;
    this.frame.imageSmoothingEnabled = false;
    this.compose(this.frame, false);
    this.menuBack = makeFocused(frame);
    this.compose(this.frame, true);
    this.frame.drawImage(this.front, 0, 0);
    this.softStatic = makeSoft(frame);
    this.overlay = makeOverlay();
    this.icon = SPRIG.toCanvas();

    // ── Ambiente ──
    for (let i = 0; i < 28; i++) this.petals.push(this.newPetal(true));
    for (let i = 0; i < 8; i++) {
      this.bokeh.push({
        x: this.rng.range(0, SW), y: this.rng.range(0, SH), r: this.rng.range(2, 5),
        vy: this.rng.range(0.6, 1.8), ph: this.rng.range(0, 6.28),
        col: this.rng.pick(['255,255,255', '244,236,255', '255,246,224']),
      });
    }
    for (let i = 0; i < 12 && dew.length; i++) {
      const [x, y] = dew[this.rng.int(dew.length)];
      this.sparkles.push({ x, y, w: this.rng.range(0.9, 1.8), ph: this.rng.range(0, 6.28) });
    }
    const bands: [number, number, number, number][] = [[34, 34, 5, 0.26], [40, 40, 5, 0.3], [45, 46, 5, 0.26], [28, 24, 4, 0.1]];
    for (const [y, rx, ry, a] of bands) {
      this.fog.push({ x: this.rng.range(0, SW), y, rx, ry, v: this.rng.range(0.6, 1.4) * (this.rng.next() < 0.5 ? 1 : -1), a });
      this.fog.push({ x: this.rng.range(0, SW), y: y + 1, rx: rx * 0.8, ry, v: this.rng.range(0.6, 1.4) * (this.rng.next() < 0.5 ? 1 : -1), a: a * 0.8 });
    }
  }

  private addProp(kind: PropKind, img: HTMLCanvasElement, cx: number, baseY: number, r: number, solid?: { hw: number; depth: number }, secret: Secret = 'none'): Prop {
    const pr: Prop = { kind, img, x: cx - (img.width >> 1), y: baseY - img.height + 3, cx, baseY, r, secret, used: false, shake: 0, solid };
    this.props.push(pr);
    return pr;
  }

  private addTrunk(rng: Rng, x: number, base: number, top: number, halfBase: number, branches: [Pt, Pt][], hw: number): void {
    const tmp = new PixelBuffer(WORLD_W, VH);
    paintTrunkAt(tmp, x, base, top, halfBase, branches.map(([a, b]) => [[x + a[0], a[1]], b] as [Pt, Pt]));
    const crop = cropToContent(tmp);
    const pr = this.addProp('trunk', crop.pb.toCanvas(), x, base, hw, { hw, depth: 4 });
    pr.x = crop.x; pr.y = crop.y;
    void rng;
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
    const spawn = (img: HTMLCanvasElement, near: boolean, speed: number) => {
      const [mx, my, r] = pickMass(rng);
      const a = rng.range(0, 6.28), d = Math.sqrt(rng.next()) * r;
      const x = mx + Math.cos(a) * d, y = my + Math.sin(a) * d;
      this.flyers.push({
        x, y, img, near,
        vx: -(speed + rng.range(0, 90)), vy: -rng.range(10, 55),
        delay: 0.4 + rng.range(0, 0.9) + Math.max(0, (x - 200) / 120) * 0.6,
        ph: rng.range(0, 6.28),
      });
    };
    for (let i = 0; i < 64; i++) spawn(rng.pick(florets), false, 80);
    for (let i = 0; i < 12; i++) spawn(florets[florets.length - 1 - rng.int(4)], true, 140);
    for (let i = 0; i < 110; i++) spawn(rng.pick(petals), false, 60);
  }

  private newPetal(anywhere: boolean): Petal {
    const r = this.rng;
    const k = r.next();
    return {
      x: r.range(0, VW), y: anywhere ? r.range(0, VH) : r.range(-24, -4),
      vx: r.range(1, 5), vy: r.range(7, 15),
      amp: r.range(3, 8), w: r.range(1.2, 2.6), ph: r.range(0, 6.28),
      kind: k < 0.12 ? 2 : k < 0.55 ? 0 : 1,
      col: r.pick(PETAL_COLS),
    };
  }

  // ───────────── jugador e interacción ─────────────

  private girlFrame(): { img: HTMLCanvasElement; bob: number } {
    const set = this.sprites[this.player.facing];
    if (this.player.moving) {
      const i = Math.floor(this.player.walkT / 0.13) % set.walk.length;
      return { img: set.walk[i], bob: i & 1 ? -1 : 0 };
    }
    return { img: set.idle[Math.floor(this.t / 0.75) % set.idle.length], bob: 0 };
  }

  private blocked(x: number, y: number): boolean {
    const fx = x + GIRL_W / 2, fy = y + GIRL_H - 1;
    for (const pr of this.props) {
      if (!pr.solid) continue;
      if (Math.abs(fx - pr.cx) < pr.solid.hw && fy > pr.baseY - pr.solid.depth && fy < pr.baseY + pr.solid.depth + 1) return true;
    }
    return false;
  }

  private movePlayer(dt: number, input: Input): void {
    const p = this.player;
    const [ax, ay] = input.axis;
    if (p.sitting) {
      // Cualquier flecha la levanta de la banca.
      if (ax === 0 && ay === 0) return;
      p.sitting = false;
      p.y = BENCH.baseY + 4 - GIRL_H + 1;
    }
    p.moving = ax !== 0 || ay !== 0;
    if (!p.moving) { p.walkT = 0; return; }
    p.walkT += dt;
    p.facing = ax !== 0 ? (ax > 0 ? 'right' : 'left') : ay > 0 ? 'down' : 'up';
    const nx = Math.min(WORLD_W - GIRL_W + 2, Math.max(-2, p.x + ax * SPEED_X * dt));
    const ny = Math.min(VH - GIRL_H, Math.max(HORIZON - GIRL_H + 2, p.y + ay * SPEED_Y * dt));
    if (!this.blocked(nx, ny)) { p.x = nx; p.y = ny; }
    else if (!this.blocked(nx, p.y)) p.x = nx;
    else if (!this.blocked(p.x, ny)) p.y = ny;
  }

  private findNearProp(): Prop | null {
    const fx = this.player.x + GIRL_W / 2, fy = this.player.y + GIRL_H - 1;
    let best: Prop | null = null, bestD = Infinity;
    for (const pr of this.props) {
      if (pr.kind !== 'bush' && pr.kind !== 'bench') continue;
      const dx = Math.abs(fx - pr.cx), dy = Math.abs(fy - pr.baseY);
      if (dx > pr.r + 9 || dy > 14) continue;
      // La banca tiene prioridad sobre los arbustos de alrededor.
      const d = dx + dy * 2 - (pr.kind === 'bench' ? 100 : 0);
      if (d < bestD) { bestD = d; best = pr; }
    }
    return best;
  }

  // J junto a la banca: Grecia se sienta a su lado y se miran.
  private sit(): void {
    const p = this.player;
    p.sitting = true; p.moving = false; p.walkT = 0; p.facing = 'right';
    p.x = BENCH.x - 22 + 8; p.y = BENCH.baseY - 25;
  }

  // J sobre un arbusto: se sacude y suelta lo que esconde (una sola vez).
  private poke(pr: Prop): void {
    if (pr.kind === 'bench') { this.sit(); return; }
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
      if (c.t < 0) continue;
      if (c.kind === 'puff') {
        c.vy += 70 * dt;
        c.x += c.vx * dt; c.y += c.vy * dt;
      } else if (c.kind === 'butterfly') {
        c.vy += (-14 - c.vy) * 0.4 * dt;
        c.x += (c.vx + Math.sin(c.t * 4.2 + c.ph) * 22) * dt;
        c.y += (c.vy + Math.cos(c.t * 2.6 + c.ph) * 14) * dt;
      } else {
        c.vy += (-28 - c.vy) * 0.9 * dt;
        c.x += c.vx * dt;
        c.y += (c.vy + Math.sin(c.t * 6 + c.ph) * 6) * dt;
      }
      if (c.t > c.life || c.y < -12 || c.x < -12 || c.x > WORLD_W + 12) this.critters.splice(i, 1);
    }
  }

  // ───────────── actualización ─────────────

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
        const k = Math.min(1, age / 0.6);
        f.x += f.vx * k * k * dt;
        f.y += (f.vy * k + Math.sin(this.t * 3 + f.ph) * 28) * dt;
        if (f.x < -40 || f.y < -40) this.flyers.splice(i, 1);
      }
      // Cámara: sigue a Grecia con suavidad, sin salirse del mundo.
      const target = Math.min(WORLD_W - VW, Math.max(0, this.player.x + GIRL_W / 2 - VW / 2));
      this.camX += (target - this.camX) * (1 - Math.exp(-5 * dt));
    }
    for (let i = 0; i < this.petals.length; i++) {
      const p = this.petals[i];
      p.y += p.vy * dt;
      p.x += (p.vx + Math.cos(this.t * p.w + p.ph) * p.amp) * dt;
      if (p.y > VH + 2 || p.x > VW + 4) this.petals[i] = this.newPetal(false);
    }
    for (const b of this.bokeh) {
      b.y -= b.vy * dt;
      b.x += Math.sin(this.t * 0.4 + b.ph) * 0.6 * dt;
      if (b.y < -b.r) { b.y = SH + b.r; b.x = this.rng.range(0, SW); }
    }
    for (const b of this.flies) {
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

  // ───────────── dibujo ─────────────

  // Compone cielo, parallax, suelo y objetos (con Grecia opcional) según la cámara.
  private compose(ctx: CanvasRenderingContext2D, withPlayer: boolean): void {
    const cam = Math.round(this.camX);
    const n = nightAt(this.camX + VW / 2);
    ctx.clearRect(0, 0, VW, VH);
    ctx.drawImage(this.sky, 0, 0);
    if (n > 0) {
      ctx.globalAlpha = Math.min(1, 2.4 * n * (1 - n));
      ctx.drawImage(this.skyDusk, 0, 0);
      ctx.globalAlpha = n * n;
      ctx.drawImage(this.skyNight, 0, 0);
      ctx.globalAlpha = 1;
    }
    const farX = -Math.round(this.camX * PAR_FAR);
    ctx.drawImage(this.far, farX, 0);
    if (n > 0) { ctx.globalAlpha = n; ctx.drawImage(this.farNight, farX, 0); ctx.globalAlpha = 1; }
    ctx.drawImage(this.mid, -Math.round(this.camX * PAR_MID), 0);
    ctx.drawImage(this.world, -cam, 0);

    type Drawable = { baseY: number; draw: () => void };
    const items: Drawable[] = [];
    for (const pr of this.props) {
      const sx = pr.x - cam;
      if (sx > VW || sx + pr.img.width < 0) continue;
      const shake = pr.shake > 0 ? Math.round(Math.sin(pr.shake * 40) * 1.5) : 0;
      items.push({ baseY: pr.baseY, draw: () => ctx.drawImage(pr.img, sx + shake, pr.y) });
    }
    if (withPlayer) {
      const p = this.player;
      if (p.sitting) {
        items.push({ baseY: BENCH.baseY + 0.5, draw: () => ctx.drawImage(this.seated, Math.round(p.x) - cam, Math.round(p.y)) });
      } else {
        const { img, bob } = this.girlFrame();
        const gx = Math.round(p.x) - cam, gy = Math.round(p.y) + bob;
        items.push({ baseY: p.y + GIRL_H - 1, draw: () => { ctx.drawImage(this.girlShadow, gx, gy - bob + GIRL_H - 2); ctx.drawImage(img, gx, gy); } });
      }
    }
    items.sort((a, b) => a.baseY - b.baseY);
    for (const it of items) it.draw();
  }

  render(crisp: CanvasRenderingContext2D, soft: CanvasRenderingContext2D, haze: CanvasRenderingContext2D): void {
    const cam = Math.round(this.camX);

    // Capa borrosa: fondo suave + luces bokeh flotando (solo se ve en el menú).
    soft.drawImage(this.softStatic, 0, 0);
    if (this.focus > 0) {
      for (const b of this.bokeh) {
        const a = 0.08 + 0.08 * (0.5 + 0.5 * Math.sin(this.t * 0.7 + b.ph));
        soft.fillStyle = `rgba(${b.col},${a.toFixed(3)})`;
        soft.beginPath();
        soft.arc(b.x, b.y, b.r, 0, 6.2832);
        soft.fill();
      }
    }

    // Capa nítida: en el menú, la composición enmascarada; en el juego, la viva.
    crisp.clearRect(0, 0, VW, VH);
    if (this.focus > 0) {
      crisp.drawImage(this.menuBack, 0, 0);
      const { img, bob } = this.girlFrame();
      const gx = Math.round(this.player.x) - cam, gy = Math.round(this.player.y) + bob;
      crisp.drawImage(this.girlShadow, gx, gy - bob + GIRL_H - 2);
      crisp.drawImage(img, gx, gy);
    }
    if (this.focus < 1) {
      this.compose(this.frame, true);
      crisp.globalAlpha = 1 - this.focus;
      crisp.drawImage(this.frame.canvas, 0, 0);
      crisp.globalAlpha = 1;
    }

    if (this.nearProp && this.mode === 'game' && !this.player.sitting) {
      const m = this.nearProp;
      crisp.drawImage(this.marker, m.cx - cam - 4, m.baseY - m.r * 2 - 14 + Math.round(Math.sin(this.t * 4) * 1.2));
    }
    for (const c of this.critters) {
      if (c.t < 0) continue;
      const x = Math.round(c.x) - cam, y = Math.round(c.y);
      crisp.fillStyle = c.col;
      if (c.kind === 'puff') {
        crisp.globalAlpha = Math.max(0, 1 - c.t / c.life);
        crisp.fillRect(x, y, 2, 2);
        crisp.globalAlpha = 1;
      } else if (c.kind === 'butterfly') {
        if (c.t > c.life - 1) crisp.globalAlpha = c.life - c.t;
        drawButterfly(crisp, x, y, Math.sin(c.t * 9 + c.ph) > 0);
        crisp.globalAlpha = 1;
      } else {
        const up = Math.sin(c.t * 11 + c.ph) > 0;
        crisp.fillRect(x - 1, y, 3, 1);
        crisp.fillStyle = '#e9dfd6';
        crisp.fillRect(x, y, 1, 1);
        crisp.fillStyle = c.col;
        crisp.fillRect(x - 2, up ? y - 1 : y + 1, 1, 1); crisp.fillRect(x + 2, up ? y - 1 : y + 1, 1, 1);
        crisp.fillRect(x + (c.vx > 0 ? 2 : -2), y, 1, 1);
      }
    }
    for (const b of this.flies) {
      crisp.fillStyle = b.col;
      drawButterfly(crisp, Math.round(b.x) - cam, Math.round(b.y), Math.sin(this.t * 9 + b.ph) > 0);
    }
    if ((this.t % 1.6) < 0.18) {
      crisp.fillStyle = '#ff5a5a';
      crisp.fillRect(this.cameraLed[0] - cam, this.cameraLed[1], 1, 1);
    }

    // Pétalos ambientales (pantalla), racimo del frente y flores al viento.
    for (const p of this.petals) {
      const x = Math.round(p.x), y = Math.round(p.y);
      crisp.fillStyle = p.col;
      if (p.kind === 0) crisp.fillRect(x, y, 2, 2);
      else if (p.kind === 1) { crisp.fillRect(x, y, 2, 1); crisp.fillRect(x + 1, y + 1, 2, 1); }
      else { crisp.fillRect(x - 1, y, 3, 1); crisp.fillRect(x, y - 1, 1, 3); crisp.fillStyle = C.flowerCenter; crisp.fillRect(x, y, 1, 1); }
    }
    if (this.frontAlpha > 0) {
      crisp.globalAlpha = this.frontAlpha;
      crisp.drawImage(this.front, 0, 0);
      crisp.globalAlpha = 1;
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
    }
    for (const f of this.flyers) {
      if (f.near || this.gameT < f.delay) continue;
      crisp.drawImage(f.img, Math.round(f.x - f.img.width / 2), Math.round(f.y - f.img.height / 2));
    }
    // Estrellas que parpadean cuando ya es de noche.
    const night = nightAt(this.camX + VW / 2);
    if (night > 0.3) {
      for (const st of this.stars) {
        const a = (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(this.t * 1.7 + st.ph))) * (night - 0.3) / 0.7;
        crisp.fillStyle = `rgba(255,248,230,${a.toFixed(3)})`;
        crisp.fillRect(st.x, st.y, 1, 1);
      }
    }
    crisp.globalAlpha = 1 - night * 0.8;
    crisp.drawImage(this.overlay, 0, 0);
    crisp.globalAlpha = 1;

    // Capa de niebla: flores fuera de foco, bancos de bruma y rayos de sol.
    haze.clearRect(0, 0, SW, SH);
    // La noche cae de izquierda a derecha según la posición en el mundo.
    if (nightAt(this.camX + VW) > 0) {
      const g = haze.createLinearGradient((NIGHT_FROM - cam) / 4, 0, (NIGHT_TO - cam) / 4, 0);
      g.addColorStop(0, 'rgba(26,22,66,0)');
      g.addColorStop(1, 'rgba(26,22,66,0.5)');
      haze.fillStyle = g;
      haze.fillRect(0, 0, SW, SH);
    }
    // Faroles y ventana encendidos.
    for (const l of this.lights) {
      if (l.a <= 0.02) continue;
      const sx = (l.x - cam) / 4, sy = l.y / 4, r = l.r / 4 + 1;
      if (sx < -r || sx > SW + r) continue;
      const g = haze.createRadialGradient(sx, sy, 0, sx, sy, r * 3);
      g.addColorStop(0, `rgba(${l.col},${l.a.toFixed(3)})`);
      g.addColorStop(0.4, `rgba(${l.col},${(l.a * 0.35).toFixed(3)})`);
      g.addColorStop(1, `rgba(${l.col},0)`);
      haze.fillStyle = g;
      haze.fillRect(sx - r * 3, sy - r * 3, r * 6, r * 6);
    }
    if (this.frontAlpha > 0) {
      haze.globalAlpha = this.frontAlpha;
      haze.drawImage(this.frontSoft, 0, 0);
      haze.globalAlpha = 1;
    }
    for (const f of this.flyers) {
      if (!f.near || this.gameT < f.delay) continue;
      const w = f.img.width * 0.45, h = f.img.height * 0.45;
      haze.drawImage(f.img, f.x / 4 - w / 2, f.y / 4 - h / 2, w, h);
    }
    const fogK = (0.4 + 0.6 * this.focus) * (1 - 0.7 * night);
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
    haze.globalAlpha = 1 - night;
    haze.fillStyle = `rgba(255,246,200,${(0.08 + 0.05 * pulse).toFixed(3)})`;
    haze.beginPath(); haze.moveTo(-4, -2); haze.lineTo(14, -2); haze.lineTo(56, 45); haze.lineTo(30, 45); haze.closePath(); haze.fill();
    haze.fillStyle = `rgba(255,246,200,${(0.06 + 0.05 * (1 - pulse)).toFixed(3)})`;
    haze.beginPath(); haze.moveTo(18, -2); haze.lineTo(26, -2); haze.lineTo(70, 45); haze.lineTo(58, 45); haze.closePath(); haze.fill();
    haze.globalAlpha = 1;
  }
}

function drawButterfly(ctx: CanvasRenderingContext2D, x: number, y: number, open: boolean): void {
  if (open) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x - 1, y - 1, 1, 1); ctx.fillRect(x + 1, y - 1, 1, 1); }
  else ctx.fillRect(x, y - 1, 1, 2);
}

// ───────────────────────── utilidades de color ─────────────────────────

// Mezcla un color hacia la bruma: k = 0 cerca … 1 muy lejos.
function fogged(c: string, k: number): RGBA {
  return mix(c, C.mist, k);
}
function mix(c1: string, c2: string, k: number): RGBA {
  const a = hex(c1), f = hex(c2);
  return [a[0] + (f[0] - a[0]) * k, a[1] + (f[1] - a[1]) * k, a[2] + (f[2] - a[2]) * k, 255];
}

// ───────────────────────── fondo ─────────────────────────

// Degradado vertical con tramado fino: cielo pixel art sin bandas duras.
function paintSky(pb: PixelBuffer, colors: readonly string[]): void {
  const base = colors.map((c) => hex(c));
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

// Luna y estrellas fijas sobre el cielo nocturno.
function paintNightSky(pb: PixelBuffer, rng: Rng): void {
  for (let i = 0; i < 70; i++) {
    const x = rng.int(VW), y = rng.int(100);
    pb.set(x, y, hex(C.star, 120 + rng.int(120)));
  }
  pb.circle(268, 28, 9, hex('#f6f1e3'));
  pb.circle(264, 26, 8, hex(C.nightTop));
  pb.circle(264, 26, 8, hex(C.nightMid, 200));
}

// Ciudad al fondo, casi disuelta en la neblina: dos filas de edificios;
// la de atrás más alta y más tenue. De noche, siluetas con ventanas encendidas.
function paintCity(pb: PixelBuffer, rng: Rng, width: number, night: boolean): void {
  const rows: [number, number, number, number][] = [[0.9, 26, 70, 0.02], [0.82, 14, 44, 0.05]];
  for (const [k0, hMin, hMax, win] of rows) {
    let x = -8 + rng.int(6);
    while (x < width + 4) {
      const w = 9 + rng.int(18), h = hMin + rng.int(hMax - hMin);
      const top = HORIZON - h;
      const tone = rng.pick([C.lilacDeep, C.canopyShade, C.trunkDark]);
      for (let y = top; y < HORIZON; y++) {
        const k = Math.min(0.96, k0 + ((y - top) / h) * 0.09);
        pb.hline(x, x + w - 1, y, night ? mix(C.nightMid, C.nightHorizon, k * 0.8) : fogged(tone, k));
        if (y > top + 2 && (y - top) % 3 === 0) {
          for (let wx = x + 2; wx < x + w - 1; wx += 3) {
            if (rng.next() < win * 8) pb.set(wx, y, night ? hex(C.windowLight, 90 + Math.round(120 * (1 - k))) : fogged(C.lilacDeep, k - 0.06));
          }
        }
      }
      pb.hline(x, x + w - 1, top, night ? mix(C.nightLow, C.nightHorizon, k0) : fogged(C.lilacLight, k0 - 0.05));
      if (rng.next() < 0.3) pb.rect(x + 1 + rng.int(Math.max(1, w - 2)), top - 2 - rng.int(4), 1, 4, fogged(tone, k0));
      x += w + rng.int(3);
    }
  }
}

// Árboles lejanos perdidos en la bruma.
function paintDistantTrees(pb: PixelBuffer, rng: Rng, width: number): void {
  for (let x = 30 + rng.int(40); x < width; x += 70 + rng.int(90)) {
    const y = 112 + rng.int(18), k = 0.78 + rng.next() * 0.1;
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
    pb.hline(0, WORLD_W - 1, y, fogged(C.groundDark, k));
  }
  for (let i = 0; i < 40 * (WORLD_W / VW); i++) {
    const y = rng.range(HORIZON, VH);
    const k = 0.5 * (1 - (y - HORIZON) / (VH - HORIZON));
    pb.ellipse(rng.int(WORLD_W), y, 6 + rng.int(14), 2 + rng.int(3), fogged(rng.pick([C.ground, C.groundLight]), k));
  }
  // El paseo: una vereda que cruza todo el mundo.
  const top = 167, bottom = 178;
  pb.rect(0, top, WORLD_W, bottom - top + 1, fogged(C.pathDark, 0.12));
  pb.rect(0, top + 1, WORLD_W, bottom - top - 1, fogged(C.path, 0.12));
  for (let i = 0; i < WORLD_W / 3; i++) {
    const x = rng.int(WORLD_W), y = top + 1 + rng.int(bottom - top - 1);
    pb.rect(x, y, rng.next() < 0.5 ? 2 : 1, 1, fogged(rng.next() < 0.6 ? C.pathLight : C.pebble, 0.15));
  }
  for (let x = 0; x < WORLD_W; x++) {
    if (rng.next() < 0.35) pb.set(x, top - 1, fogged(C.pathDark, 0.2));
    if (rng.next() < 0.35) pb.set(x, bottom + 1, fogged(C.pathDark, 0.2));
  }
  // Senda curva que sube de la vereda a la base del árbol grande.
  const T = MAIN_TREE;
  pb.poly([[118, top + 1], [150, top + 1], [T.x + 5, T.base], [T.x - 9, T.base]], fogged(C.pathDark, 0.15));
  pb.poly([[122, top + 1], [146, top + 1], [T.x + 3, T.base + 1], [T.x - 7, T.base + 1]], fogged(C.path, 0.15));
  // Matas de pasto y pétalos caídos (más cerca de los árboles).
  for (let i = 0; i < 70 * (WORLD_W / VW); i++) {
    const x = rng.int(WORLD_W), y = HORIZON + 2 + rng.int(VH - HORIZON - 2);
    if (y >= top - 1 && y <= bottom + 1) continue;
    const col = fogged(rng.pick([C.leaf, C.leafLight, C.groundLight]), 0.3);
    pb.set(x, y, col); pb.set(x + 2, y, col); pb.set(x + 1, y + 1, col);
  }
  for (const [tx, n] of [[160, 60], [500, 24], [1128, 26]] as Pt[]) {
    for (let i = 0; i < n; i++) pb.set(tx + Math.round(rng.range(-90, 90)), HORIZON + rng.int(VH - HORIZON), hex(rng.pick(PETAL_COLS)));
  }
}

// La esquina verde: pavimento, pared verde con la puerta y la ventana de su
// casa, y la calle que dobla en la esquina.
function paintStreet(pb: PixelBuffer, rng: Rng): void {
  const { x0, x1, wallX0, wallX1, wallTop, house, streetX0, pole } = STREET;
  // Pavimento de baldosas entre la pared y la vereda.
  for (let y = HORIZON; y < 167; y++) {
    for (let x = x0; x < x1; x++) {
      const seam = (y - HORIZON) % 5 === 4 || ((x + ((y - HORIZON) / 5 | 0) * 4) % 9 === 8);
      pb.set(x, y, hex(seam ? C.pavementSeam : C.pavement));
    }
  }
  // Pared: cornisa clara, zócalo oscuro y juntas de ladrillo apenas marcadas.
  for (let y = wallTop; y < HORIZON; y++) {
    const col = y < wallTop + 3 ? C.wallLight : y >= HORIZON - 5 ? C.skirting : y > HORIZON - 14 ? C.wallDark : C.wall;
    pb.hline(wallX0, wallX1 - 1, y, hex(col));
    if (y > wallTop + 4 && y < HORIZON - 6 && (y - wallTop) % 6 === 0) {
      for (let x = wallX0 + ((y / 6 | 0) % 2) * 7; x < wallX1; x += 14) pb.set(x, y, hex(C.wallDark));
    }
  }
  for (let i = 0; i < 90; i++) pb.set(wallX0 + rng.int(wallX1 - wallX0), wallTop + 4 + rng.int(HORIZON - wallTop - 10), hex(rng.next() < 0.5 ? C.wallDark : C.wallLight, 90));
  // Enredadera en un tramo de la pared.
  for (let i = 0; i < 60; i++) {
    const x = wallX0 + 20 + rng.int(60), y = wallTop + 3 + rng.int(40);
    if (rng.next() < 0.4 + (y - wallTop) / 100) { pb.set(x, y, hex(rng.pick([C.leafDark, C.leaf]))); pb.set(x + 1, y, hex(C.leafDark)); }
  }
  // Lado de la esquina: la pared dobla hacia el fondo.
  pb.rect(wallX1, wallTop + 2, 6, HORIZON - wallTop - 2, hex(C.wallSide));
  pb.rect(wallX1, wallTop + 2, 6, 2, hex(C.wallDark));

  // Su casa, pegada a la pared: un piso, techo plano con pretil, puerta con luz
  // en el portal, ventana encendida con cortinas y la cámara en la esquina del techo.
  const hb = HORIZON - 1, hw = 40;
  pb.rect(house, hb - 26, hw, 26, hex('#e8dccb'));
  pb.rect(house + hw - 5, hb - 26, 5, 26, hex('#c9bcaa')); // lado en sombra
  pb.rect(house - 2, hb - 30, hw + 4, 4, hex('#8a7f78')); // pretil
  pb.rect(house - 2, hb - 31, hw + 4, 1, hex('#a59a92'));
  pb.rect(house - 2, hb - 27, hw + 4, 1, hex('#6f6660'));
  pb.rect(house, hb - 1, hw - 5, 1, hex('#bfb3a4')); // zócalo
  // Puerta.
  pb.rect(house + 5, hb - 21, 11, 21, hex(C.outline));
  pb.rect(house + 6, hb - 20, 9, 20, hex(C.door));
  pb.rect(house + 10, hb - 20, 1, 20, hex(C.doorDark));
  pb.rect(house + 7, hb - 18, 3, 7, hex(C.doorDark)); pb.rect(house + 11, hb - 18, 3, 7, hex(C.doorDark));
  pb.set(house + 9, hb - 10, hex(C.flowerCenter));
  pb.rect(house + 4, hb, 13, 1, hex(C.pavementSeam)); // escalón
  // Luz del portal.
  pb.rect(house + 8, hb - 24, 5, 2, hex('#3b3236')); pb.rect(house + 9, hb - 23, 3, 1, hex(C.lampLight));
  // Ventana con cortinas.
  pb.rect(house + 20, hb - 21, 15, 12, hex(C.windowFrame));
  pb.rect(house + 21, hb - 20, 13, 10, hex(C.windowLight));
  pb.rect(house + 27, hb - 20, 1, 10, hex(C.windowFrame)); pb.rect(house + 21, hb - 16, 13, 1, hex(C.windowFrame));
  for (let y = hb - 20; y < hb - 10; y++) { pb.set(house + 21 + (y & 1), y, hex(C.lilacLight)); pb.set(house + 33 - (y & 1), y, hex(C.lilacLight)); }
  pb.rect(house + 19, hb - 9, 17, 1, hex('#bfb3a4')); // alféizar
  // Número de la casa y una maceta.
  pb.rect(house + 18, hb - 25, 3, 2, hex('#f4efe6'));
  pb.rect(house + 36, hb - 5, 4, 5, hex('#a7674f')); for (let i = 0; i < 6; i++) pb.set(house + 36 + rng.int(4), hb - 8 + rng.int(4), hex(rng.pick([C.leaf, C.leafDark])));
  // Cámara de seguridad bajo el pretil, mirando hacia la esquina (su luz roja parpadea en el juego).
  pb.rect(house, hb - 26, 4, 2, hex('#3b3236')); pb.set(house - 1, hb - 26, hex('#8fb3d9')); pb.set(house + 3, hb - 24, hex('#3b3236'));

  // La calle que entra, a la derecha de su casa, con un poste de luz al centro.
  pb.poly([[streetX0 + 12, wallTop + 44], [streetX0 + 30, wallTop + 44], [x1, HORIZON + 6], [streetX0, HORIZON + 6]], hex(C.asphalt));
  pb.poly([[streetX0, HORIZON + 6], [x1, HORIZON + 6], [x1, HORIZON + 8], [streetX0, HORIZON + 8]], hex(C.curb));
  for (let t = 0; t < 1; t += 0.12) {
    const y = wallTop + 46 + t * (HORIZON - wallTop - 40), x = streetX0 + 21 + t * ((x1 - streetX0) / 2 - 21);
    pb.rect(Math.round(x), Math.round(y), 1, 2, hex(C.curb, 160));
  }
  const base = HORIZON + 1;
  pb.ellipse(pole + 5, base, 12, 3, [255, 225, 160, 70]);
  pb.rect(pole - 1, base - 1, 4, 2, hex('#4a4650'));
  pb.rect(pole, base - 33, 2, 33, hex('#5a5560')); pb.rect(pole, base - 33, 1, 33, hex('#6e6975'));
  pb.rect(pole + 2, base - 33, 5, 1, hex('#5a5560')); pb.rect(pole + 6, base - 32, 1, 1, hex('#5a5560'));
  pb.rect(pole + 4, base - 31, 4, 1, hex('#3b3236')); pb.rect(pole + 4, base - 30, 4, 2, hex(C.lampLight)); pb.set(pole + 5, base - 30, hex('#ffffff'));
}

const LAMPS = [420, 655, 955, 1270];

// ───────────────────────── árboles ─────────────────────────

function paintTrunkAt(pb: PixelBuffer, x: number, base: number, top: number, halfBase: number, branches: [Pt, Pt][]): void {
  pb.ellipse(x, base + 2, halfBase + 5, 2, hex(C.shadow, 70));
  pb.ellipse(x, base + 1, halfBase + 2, 2, fogged(C.trunkDark, 0.12));
  for (const [dx, len] of [[-halfBase - 1, 3], [-Math.round(halfBase * 0.6), 4], [Math.round(halfBase * 0.5), 4], [halfBase + 1, 3]] as Pt[]) {
    pb.rect(x + dx, base - 1, len, 2, fogged(C.trunk, 0.12));
  }
  for (let y = base; y >= top; y--) {
    const t = (base - y) / (base - top);
    const half = Math.round(halfBase - halfBase * 0.55 * t);
    const cx = x + Math.round(Math.sin(t * 2.2) * 3 * (halfBase / 8));
    pb.hline(cx - half, cx + half, y, fogged(C.trunkDark, 0.12));
    pb.hline(cx - half + 1, cx + half - 3, y, fogged(C.trunk, 0.12));
    pb.hline(cx - half + 2, cx - half + 3, y, fogged(C.trunkLight, 0.12));
  }
  for (const [a, b] of branches) {
    for (let t = 0; t <= 1; t += 0.03) {
      const bx = a[0] + (b[0] - a[0]) * t, by = a[1] + (b[1] - a[1]) * t;
      pb.circle(bx, by, Math.max(1, Math.round((3.5 - 2.5 * t) * Math.min(1, halfBase / 8))), fogged(C.trunkDark, 0.12 + 0.2 * t));
      if (t < 0.7) pb.set(Math.round(bx) - 1, Math.round(by) - 1, fogged(C.trunk, 0.12));
    }
  }
}

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

// Racimo (panícula): cono desde la base (x, y) hacia la punta.
function panicle(pb: PixelBuffer, rng: Rng, x: number, y: number, h: number, w: number, tilt: number, s: number, k: number, count: number, dew?: Pt[]): void {
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

// Copa de lilas dentro de una elipse (cx, cy, hw, hh). `scale` reduce el tamaño de los racimos.
function paintCanopyAt(pb: PixelBuffer, rng: Rng, dew: Pt[], cx: number, cy: number, hw: number, hh: number, scale: number): void {
  // Densidad relativa al árbol grande; los chicos no bajan de la mitad para no verse ralos.
  const area = Math.max(0.55, (hw * hh) / (200 * 82));
  const pick = (m = 1): Pt => {
    for (;;) {
      const x = cx + rng.range(-hw, hw) * m, y = cy + rng.range(-hh, hh) * m;
      const nx = (x - cx) / hw, ny = (y - cy) / hh;
      if (nx * nx + ny * ny <= 1) return [x, y];
    }
  };
  for (let i = 0; i < 70 * area; i++) {
    const [x, y] = pick();
    const r = Math.round((9 + rng.int(14)) * scale);
    pb.circle(x, y, r, fogged(rng.pick([C.lilacMid, C.canopyShade, C.canopyBase, C.lilacMid]), 0.42));
    for (let j = 0; j < r * 3; j++) {
      const a = rng.range(0, 6.28), d = Math.sqrt(rng.next()) * r;
      pb.set(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), fogged(rng.pick([C.lilacLight, C.lilacDark, C.leaf]), 0.45));
    }
  }
  for (let i = 0; i < 90 * area; i++) {
    const [x, y] = pick();
    const col = fogged(rng.pick([C.leafDark, C.leaf, C.leafLight]), 0.3);
    const ix = Math.round(x), iy = Math.round(y);
    pb.set(ix, iy, col); pb.set(ix + 1, iy, col); pb.set(ix, iy + 1, col); pb.set(ix + 1, iy + 1, col); pb.set(ix + 1, iy - 1, col);
  }
  for (let i = 0; i < 46 * area; i++) {
    const [x, y] = pick();
    panicle(pb, rng, x, y, rng.range(14, 22) * scale, rng.range(10, 16) * scale, rng.range(-0.9, 0.9), 1, 0.5, 34);
  }
  for (let i = 0; i < 44 * area; i++) {
    const [x, y] = pick();
    panicle(pb, rng, x, y, rng.range(22, 34) * scale, rng.range(14, 22) * scale, rng.range(-0.8, 0.8), rng.next() < 0.4 && scale > 0.8 ? 2 : 1, 0.25, 50);
  }
  for (let i = 0; i < 14 * area; i++) {
    const [x, y] = pick(0.9);
    panicle(pb, rng, x, y, rng.range(36, 48) * scale, rng.range(24, 32) * scale, rng.range(-0.6, 0.6), scale > 0.8 ? 2 : 1, 0.06, 70, dew);
  }
}

// ───────────────────────── objetos del paseo ─────────────────────────

// [centro x, base y, radio]. Los del primer tramo son fijos; el resto se reparte
// por el mundo evitando troncos, faroles, banca y puerta.
function bushSpots(rng: Rng, props: Prop[]): [number, number, number][] {
  const spots: [number, number, number][] = [
    [16, 176, 11], [52, 163, 9], [86, 173, 10], [30, 156, 7], [122, 156, 7],
    [196, 175, 11], [232, 161, 9], [268, 177, 12], [300, 159, 8], [250, 153, 7], [178, 178, 8],
  ];
  for (let x = 350; x < 1385; x += 46 + rng.int(34)) {
    const r = 7 + rng.int(6);
    const baseY = 153 + rng.int(26);
    if (x > STREET.x0 - 20 && x < STREET.x1 + 16) continue; // la esquina verde es pavimento
    if (Math.abs(x - BENCH.x) < 52) continue; // espacio libre alrededor de la banca
    if (props.some((pr) => pr.solid && Math.abs(pr.cx - x) < pr.solid.hw + r + 4 && Math.abs(pr.baseY - baseY) < 10)) continue;
    spots.push([x, baseY, r]);
  }
  return spots;
}

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

// Farol de parque: poste fino con lámpara. `lit` 0..1 = qué tan encendido está.
function renderLamp(lit: number): HTMLCanvasElement {
  const pb = new PixelBuffer(9, 44);
  pb.ellipse(4, 42, 4, 1, hex(C.shadow, 60));
  pb.rect(1, 39, 7, 2, hex(C.trunkDark)); pb.rect(2, 38, 5, 1, hex(C.trunkDark));
  pb.rect(3, 8, 3, 31, hex(C.trunkDark)); pb.rect(3, 8, 1, 31, hex(C.trunk));
  pb.rect(2, 1, 5, 1, hex(C.trunkDark)); pb.rect(3, 0, 3, 1, hex(C.trunkDark));
  pb.rect(1, 2, 7, 6, hex(C.trunkDark));
  pb.rect(2, 3, 5, 4, mix('#e8e0d0', C.lampLight, lit));
  pb.rect(3, 4, 2, 2, mix('#f4efe6', '#fffaf0', lit));
  if (lit > 0.5) { pb.rect(2, 3, 5, 4, hex('#fff6d6')); pb.rect(3, 4, 3, 2, hex('#ffffff')); }
  return pb.toCanvas();
}

// Banca grande de madera, con él sentado en el lado derecho, mirando a la izquierda.
function renderBench(him: PixelBuffer): HTMLCanvasElement {
  const pb = new PixelBuffer(48, 33);
  pb.ellipse(24, 31, 23, 1, hex(C.shadow, 60));
  const light = hex('#b58f68'), wood = hex('#95724f'), dark = hex('#5f4a3c');
  // Respaldo: tres tablas.
  pb.rect(3, 6, 42, 2, light); pb.rect(3, 9, 42, 2, wood); pb.rect(3, 12, 42, 2, light);
  pb.rect(4, 8, 2, 1, dark); pb.rect(42, 8, 2, 1, dark); pb.rect(4, 11, 2, 1, dark); pb.rect(42, 11, 2, 1, dark);
  pb.rect(4, 14, 2, 6, dark); pb.rect(42, 14, 2, 6, dark); // montantes
  // Asiento y patas.
  pb.rect(2, 20, 44, 3, light); pb.rect(2, 23, 44, 1, wood);
  pb.rect(4, 24, 3, 7, dark); pb.rect(41, 24, 3, 7, dark);
  pb.rect(4, 26, 40, 1, dark);
  pb.blit(him, 27, 5);
  return pb.toCanvas();
}

// Puerta de jardín al final del paseo (por ahora, cerrada).
function renderGate(rng: Rng): HTMLCanvasElement {
  const pb = new PixelBuffer(34, 40);
  pb.ellipse(17, 38, 16, 2, hex(C.shadow, 60));
  const post = hex(C.trunkDark), postL = hex(C.trunk);
  pb.rect(0, 6, 4, 32, post); pb.rect(1, 6, 1, 32, postL);
  pb.rect(30, 6, 4, 32, post); pb.rect(31, 6, 1, 32, postL);
  for (let x = 0; x < 34; x++) {
    const y = 4 + Math.round(3 * Math.pow((x - 17) / 17, 2));
    pb.rect(x, y, 1, 3, post);
  }
  for (let x = 6; x < 29; x += 4) pb.rect(x, 14, 1, 23, post);
  pb.rect(4, 22, 26, 1, post); pb.rect(4, 32, 26, 1, post);
  for (let i = 0; i < 14; i++) {
    const x = 2 + rng.int(30), y = 2 + rng.int(9);
    floret(pb, x, y, 1, 0.05, rng.range(0.3, 1), rng);
  }
  for (let i = 0; i < 10; i++) pb.set(rng.int(34), 5 + rng.int(6), hex(C.leaf));
  return pb.toCanvas();
}

function cropToContent(pb: PixelBuffer): { pb: PixelBuffer; x: number; y: number } {
  let x0 = pb.w, y0 = pb.h, x1 = -1, y1 = -1;
  for (let y = 0; y < pb.h; y++) for (let x = 0; x < pb.w; x++) {
    if (pb.data[(y * pb.w + x) * 4 + 3] === 0) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const out = new PixelBuffer(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.set(x - x0, y - y0, pb.get(x, y));
  return { pb: out, x: x0, y: y0 };
}

// ───────────────────────── primer plano: la foto ─────────────────────────

interface Tone { light: string; mid: string; dark: string; deep: string }
const TONE_LILAC: Tone = { light: '#ebe3f9', mid: '#c9b6ec', dark: '#a893dc', deep: '#8a72c4' };
const TONE_PINK: Tone = { light: '#f1e6f8', mid: '#d4bceb', dark: '#b89ad8', deep: '#9776bf' };
const LIGHT: Pt = [-0.707, -0.707];
// Círculos que definen el volumen del racimo de primer plano.
const FG_MASS: [number, number, number][] = [[275, 105, 46], [300, 60, 38], [258, 150, 36], [300, 150, 40], [270, 30, 30], [318, 105, 34], [236, 120, 22]];
const FG_WEIGHTS = FG_MASS.map(([, , r]) => r * r);
const FG_TOTAL = FG_WEIGHTS.reduce((a, b) => a + b, 0);
function pickMass(rng: Rng): [number, number, number] {
  let u = rng.next() * FG_TOTAL;
  for (let i = 0; i < FG_MASS.length; i++) { u -= FG_WEIGHTS[i]; if (u <= 0) return FG_MASS[i]; }
  return FG_MASS[FG_MASS.length - 1];
}

function renderFloret(rng: Rng, S: number, rot: number): HTMLCanvasElement {
  const size = Math.ceil(S * 2.3) + 4;
  const pb = new PixelBuffer(size, size);
  bigFloret(pb, rng, size >> 1, size >> 1, S, rot, 0.04);
  return pb.toCanvas();
}
function renderPetal(col: string, kind: number): HTMLCanvasElement {
  const pb = new PixelBuffer(3, 2);
  const c = hex(col);
  if (kind === 0) pb.rect(0, 0, 2, 2, c);
  else { pb.rect(0, 0, 2, 1, c); pb.rect(1, 1, 2, 1, c); }
  return pb.toCanvas();
}

// Pétalo: elipse alargada que se afina hacia la punta, rotada `ang`.
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
      if (e > 0.68) col = lit > 0.15 ? tone.light : lit < -0.3 ? tone.dark : chk ? tone.light : tone.mid;
      else if (Math.abs(v) < rb * 0.22 && u < ra * 0.35) col = u < -ra * 0.3 ? tone.deep : chk ? tone.dark : tone.mid;
      else if (lit > 0.4) col = chk && e > 0.4 ? tone.light : tone.mid;
      else if (lit < -0.3) col = chk ? tone.mid : tone.dark;
      else col = tone.mid;
      pb.set(x, y, fogged(col, k));
    }
  }
}

function dewDrop(pb: PixelBuffer, x: number, y: number, r: number, k: number): void {
  pb.circle(x, y, r, [255, 255, 255, 105]);
  const rim = fogged(C.lilacDeep, k);
  pb.set(x + r, y + r - 1, [rim[0], rim[1], rim[2], 120]);
  pb.set(x - 1, y - 1, [255, 255, 255, 235]);
}

function bigFloret(pb: PixelBuffer, rng: Rng, cx: number, cy: number, S: number, rot: number, k: number, dew?: Pt[]): void {
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
  for (const [x, y, r] of FG_MASS) pb.circle(x, y, r - 7, fogged(C.lilacDeep, 0.1));
  const fill: [number, number, number][] = [];
  for (let i = 0; i < 170; i++) {
    const [x, y, r] = pickMass(rng);
    const a = rng.range(0, 6.28), d = Math.sqrt(rng.next()) * (r - 3);
    fill.push([Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), 5 + rng.int(4)]);
  }
  fill.sort((a, b) => a[2] - b[2]);
  fill.forEach(([x, y, S], i) => bigFloret(pb, rng, x, y, S, rng.range(0, 1.57), 0.22 - 0.16 * (i / fill.length)));
  const big: [number, number, number, number][] = [
    [218, 68, 8, 0.5], [240, 32, 9, 0.1], [222, 104, 9, 0.7], [286, 30, 10, -0.6], [250, 68, 11, 0.4],
    [316, 112, 12, -0.2], [268, 176, 12, 0.3], [236, 140, 12, -0.3], [308, 176, 11, 0.9], [300, 70, 13, 0.6],
    [292, 152, 14, 0.9], [270, 108, 17, 0.15],
  ];
  for (const [x, y, S, rot] of big) bigFloret(pb, rng, x, y, S, rot, 0.04, dew);
  const budSpots: [number, number, number][] = [
    [224, 156, -0.9], [230, 166, -0.6], [219, 170, -1.2], [236, 174, -0.4], [214, 148, -1.4], [242, 164, -0.2],
    [306, 12, 0.8], [316, 22, 1.1], [298, 8, 0.4], [214, 128, -1.0],
  ];
  for (const [x, y, a] of budSpots) budBig(pb, x, y, a, 5 + rng.int(3), 0.06);
  for (const [x, y] of [[226, 160], [232, 170], [220, 174]] as Pt[]) {
    pb.set(x, y, fogged(C.leafDark, 0.1)); pb.set(x + 1, y + 1, fogged(C.leafDark, 0.1)); pb.set(x + 2, y + 2, fogged(C.leaf, 0.1));
  }
}

function paintForegroundBlur(pb: PixelBuffer, rng: Rng): void {
  const blurry: [number, number, number, number, number][] = [
    [204, 56, 10, 0.3, 0.3], [192, 98, 11, -0.4, 0.3], [206, 138, 10, 0.6, 0.25], [198, 172, 9, 0.1, 0.3],
    [226, 10, 9, -0.2, 0.35], [40, 164, 12, 0.5, 0.65], [16, 26, 11, -0.3, 0.7], [300, 40, 16, 0.2, 0.2],
  ];
  for (const [x, y, S, rot, k] of blurry) bigFloret(pb, rng, x, y, S, rot, k);
  for (const [x, y, a] of [[208, 118, -1.1], [200, 152, -0.8], [212, 32, 0.6]] as [number, number, number][]) budBig(pb, x, y, a, 6, 0.3);
}

// ───────────────────────── capas derivadas ─────────────────────────

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

function makeSoft(full: HTMLCanvasElement): HTMLCanvasElement {
  const c = downsample(full);
  const ctx = c.getContext('2d')!;
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
  const v = ctx.createRadialGradient(30, 0, 10, 30, 0, 260);
  v.addColorStop(0, 'rgba(255,240,190,0.28)');
  v.addColorStop(0.4, 'rgba(255,244,210,0.10)');
  v.addColorStop(1, 'rgba(255,244,210,0)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, VW, VH);
  const l = ctx.createLinearGradient(150, 0, 0, 0);
  l.addColorStop(0, 'rgba(250,247,255,0)');
  l.addColorStop(1, 'rgba(250,247,255,0.45)');
  ctx.fillStyle = l;
  ctx.fillRect(0, 0, VW, VH);
  return c;
}
