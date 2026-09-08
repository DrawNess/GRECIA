// Escena principal: el jardín de lilas. Empieza como menú (una pantalla, con
// ventana de enfoque y bruma) y, tras el nombre, se abre en un paseo de
// cuatro pantallas con cámara y parallax. Lo estático se pinta una vez en
// PixelBuffers; por cuadro solo se componen capas y se dibujan los sprites.
import { PixelBuffer, hex, sprite, type RGBA } from '../engine/pixels';
import { Rng } from '../engine/rng';
import { VW, VH, SW, SH } from '../engine/stage';
import { C } from '../art/palette';
import { GRECIA, GRECIA_SEATED, JHAMMIL, JHAMMIL_SEATED, SPRIG, type DirSprites } from '../art/sprites';
import { story } from '../content/story';
import { ACTION, type Input } from '../engine/input';

export const WORLD_W = 2260;
const HORIZON = 150;
// De día junto al árbol; al caminar a la derecha cae la noche.
const NIGHT_FROM = 340, NIGHT_TO = 660;
const nightAt = (x: number) => { const t = Math.min(1, Math.max(0, (x - NIGHT_FROM) / (NIGHT_TO - NIGHT_FROM))); return t * t * (3 - 2 * t); };
// La esquina verde: pared, puerta y ventana de su casa, y la calle que dobla.
// x0..x1 pavimento · wallX0..wallX1 la pared · house su casa · streetX0..x1 la calle que entra
const STREET = { x0: 600, wallX0: 612, wallX1: 986, house: 996, streetX0: 1040, x1: 1096, wallTop: 92, pole: 1064 };
// La tormenta: los problemas. Entre la esquina verde y el parque.
const STORM = { x0: 1100, x1: 1740 };
const stormAt = (x: number) => {
  const inA = Math.min(1, Math.max(0, (x - STORM.x0) / 80));
  const outA = Math.min(1, Math.max(0, (STORM.x1 - x) / 100));
  return Math.min(inA, outA);
};
// Árboles muertos junto a la vereda: se desploman al acercarse; el tronco
// caído se rompe con J.
const BARRIERS = [1250, 1400, 1550];
// El kiosco rojo: refugio de los rayos. La flor de lila aparece al pasar la tormenta.
const KIOSK = { x: 1330, baseY: 151 };
const FLOWER_SPOT = { x: 1612, baseY: 174 };
const RUN_MULT = 1.7;
// La autopista: después de Chimuelo, cruza el camino y se pierde hacia el
// fondo con una curva suave. t = 0 en el punto de fuga … 1 abajo del todo.
const ROAD = { cx: 2080, vanishY: 98, nearY: 188, halfFar: 5, halfNear: 88, bend: 26 };
const roadY = (t: number) => ROAD.vanishY + (ROAD.nearY - ROAD.vanishY) * t;
const roadHalf = (t: number) => ROAD.halfFar + (ROAD.halfNear - ROAD.halfFar) * t;
const roadCX = (t: number) => ROAD.cx + ROAD.bend * (1 - t) * (1 - t);
// `off` = posición dentro de la calzada, -1 (borde izq.) … 1 (borde der.).
const roadX = (t: number, off: number) => roadCX(t) + off * roadHalf(t);
const roadS = (t: number) => 0.16 + 1.14 * t * t;
// Carriles: los dos de la izquierda se alejan, los dos de la derecha vienen.
const ROAD_LANES: { off: number; coming: boolean }[] = [{ off: -0.72, coming: false }, { off: -0.26, coming: false }, { off: 0.26, coming: true }, { off: 0.72, coming: true }];
const ROAD_LAMPS = [0.2, 0.36, 0.55, 0.78];
const BENCH = { x: 1830, baseY: 165 };
// Chimuelo duerme después de la banca, sobre el pasto.
const DRAGON = { x: 1940, baseY: 164, w: 44, h: 30 };
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
type PropKind = 'bush' | 'trunk' | 'lamp' | 'bench' | 'gate' | 'barrier' | 'kiosk' | 'flower';
interface Prop { kind: PropKind; img: HTMLCanvasElement; x: number; y: number; cx: number; baseY: number; r: number; secret: Secret; used: boolean; shake: number; solid?: { hw: number; depth: number }; hp?: number; variants?: HTMLCanvasElement[]; tree?: TreeState; t?: number; standing?: HTMLCanvasElement }
// Lluvia (pantalla) y relámpago.
interface Rain { x: number; y: number; v: number }
interface Bolt { pts: Pt[]; t: number }
// Rayo dirigido: aviso en el suelo y luego cae.
interface Strike { x: number; groundY: number; t: number }
// Rama que cae rápido (mundo): sombra pequeña; si alcanza a Grecia, tropieza.
interface Branch { x: number; groundY: number; h: number; v: number; rot: number }
// Auto en la autopista: t = 0 lejos … 1 cerca, en su carril.
interface Car { t: number; lane: number; speed: number; img: HTMLCanvasElement; passed: boolean }
type TreeState = 'stand' | 'shake' | 'fall' | 'down';
// Mariposa, pájaro, pétalo, corazón o "z" (coordenadas de mundo).
interface Critter { kind: 'butterfly' | 'bird' | 'puff' | 'heart' | 'zz'; x: number; y: number; vx: number; vy: number; ph: number; t: number; life: number; col: string }
type DragonState = 'sleep' | 'wake' | 'fly' | 'gone';
interface Dragon { state: DragonState; t: number; x: number; y: number; vx: number; vy: number; hearts: boolean; lastZ: number }
type Facing = 'up' | 'down' | 'left' | 'right';
interface Player { x: number; y: number; facing: Facing; moving: boolean; walkT: number; sitting: boolean; stun: number; knock: number; running: boolean; stamina: number; flower: boolean }
// Luz nocturna (mundo): farol o ventana; brilla según lo oscuro que esté ahí.
interface Light { x: number; y: number; r: number; col: string; a: number }
interface Star { x: number; y: number; ph: number }
interface Firefly { x: number; y: number; vx: number; vy: number; ph: number }
interface Meteor { x: number; y: number; vx: number; vy: number; t: number }
interface DirCanvases { idle: HTMLCanvasElement[]; walk: HTMLCanvasElement[] }
// Jhammil cuando la acompaña: camina a su lado, de la mano.
interface Follower { active: boolean; x: number; y: number; facing: Facing; moving: boolean; walkT: number; side: number; holding: boolean; everHeld: boolean }
const HIM_H = 26;
const HAND_GAP = 10; // separación horizontal entre los dos cuando van de la mano

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
  private readonly dragonImgs: { sleep: HTMLCanvasElement[]; wake: HTMLCanvasElement; fly: HTMLCanvasElement[] };
  private readonly dragon: Dragon = { state: 'sleep', t: 0, x: DRAGON.x, y: DRAGON.baseY - DRAGON.h + 3, vx: 0, vy: 0, hearts: false, lastZ: 0 };
  private readonly lights: Light[] = [];
  // Luz roja de la cámara de la caseta (parpadea).
  private readonly cameraLed: Pt = [STREET.house + 1, HORIZON - 27];
  private readonly stars: Star[] = [];
  readonly icon: HTMLCanvasElement;

  private readonly props: Prop[] = [];
  private readonly player: Player = { x: GIRL_START.x, y: GIRL_START.y, facing: 'up', moving: false, walkT: 0, sitting: false, stun: 0, knock: 0, running: false, stamina: 1, flower: false };
  private readonly branches: Branch[] = [];
  private readonly cars: Car[] = [];
  private readonly carImgs: { front: HTMLCanvasElement[]; rear: HTMLCanvasElement[] };
  private readonly laneTimers = [1.2, 2.6, 0.9, 2.1];
  private roadSeen = false;
  private runOver = false;
  private nextBranch = 2;
  private flowerTimer = -1;
  private shelterSeen = false;
  private dustTimer = 0;
  private readonly carried: HTMLCanvasElement;
  private readonly himSprites: Record<Facing, DirCanvases>;
  private readonly benchEmpty: HTMLCanvasElement;
  private readonly him: Follower = { active: false, x: 0, y: 0, facing: 'left', moving: false, walkT: 0, side: 1, holding: false, everHeld: false };
  private zoom = 1;
  private zoomTarget = 1;
  private busy = false;       // hay una charla abierta: el teclado es de la caja de diálogo
  private benchTalked = false;
  private zoomBox: [number, number, number, number] | null = null;
  // Tormenta.
  private readonly clouds: HTMLCanvasElement;
  private readonly rain: Rain[] = [];
  private bolt: Bolt | null = null;
  private flash = 0;
  private nextBolt = 4;
  private broken = 0;
  private stormSeen = false;
  private caught = false;
  private breakSeen = false;
  private readonly strikes: Strike[] = [];
  private readonly fireflies: Firefly[] = [];
  private meteor: Meteor | null = null;
  private nextMeteor = 9;
  private nextStrike = 3;
  private readonly events: string[] = [];
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
    const clouds = new PixelBuffer(MID_W, 80);
    paintStormClouds(clouds, rng);
    this.clouds = clouds.toCanvas();

    const world = new PixelBuffer(WORLD_W, VH);
    paintGround(world, rng);
    paintStreet(world, rng);
    paintPuddles(world, rng);
    paintHighway(world, rng);
    paintCanopyAt(world, rng, dew, 160, 40, 200, 82, 1);
    paintCanopyAt(world, rng, dew, 500, 70, 66, 44, 0.62);
    paintCanopyAt(world, rng, dew, 1768, 64, 72, 48, 0.66);
    // Luz de los faroles sobre el suelo, ya horneada (la noche no cambia).
    for (const lx of LAMPS) {
      const n = nightAt(lx);
      if (n > 0.05) world.ellipse(lx, 172, 26, 7, [255, 225, 160, Math.round(70 * n)]);
    }
    this.world = world.toCanvas();

    // ── Objetos ──
    this.addTrunk(rng, MAIN_TREE.x, MAIN_TREE.base, MAIN_TREE.top, 8, [[[-2, 104], [112, 66]], [[-1, 100], [156, 44]], [[2, 104], [231, 62]], [[3, 110], [248, 104]]], 10);
    this.addTrunk(rng, 500, 153, 112, 4.5, [[[-1, 118], [470, 94]], [[1, 114], [506, 86]], [[2, 118], [532, 98]]], 6);
    this.addTrunk(rng, 1768, 153, 108, 5, [[[-1, 114], [1732, 88]], [[0, 110], [1774, 78]], [[2, 114], [1806, 92]]], 7);
    // Faroles al borde del pasto, sin estorbar la vereda. De noche, encendidos.
    for (const x of LAMPS) {
      this.addProp('lamp', renderLamp(nightAt(x)), x, 164, 3, { hw: 2, depth: 3 });
      this.lights.push({ x, y: 164 - 39, r: 12, col: '255,225,160', a: 0.5 * nightAt(x) });
    }
    // Poste de la calle que entra, luz del portal y ventana de su casa.
    this.lights.push({ x: STREET.pole + 5, y: 120, r: 7, col: '255,225,160', a: 0.45 });
    this.lights.push({ x: STREET.house + 10, y: HORIZON - 23, r: 5, col: '255,225,160', a: 0.32 });
    this.lights.push({ x: STREET.house + 27, y: HORIZON - 15, r: 6, col: '255,220,150', a: 0.3 });
    // La banca grande, con Jhammil sentado mirando hacia donde llegará ella.
    this.addProp('bench', renderBench(JHAMMIL_SEATED), BENCH.x, BENCH.baseY, 26, { hw: 23, depth: 3 });
    this.benchEmpty = renderBench(null);
    const hr = toCanvasesJ(JHAMMIL.side);
    this.himSprites = { up: toCanvasesJ(JHAMMIL.back), down: toCanvasesJ(JHAMMIL.front), right: hr, left: { idle: hr.idle.map(flipX), walk: hr.walk.map(flipX) } };
    this.addProp('gate', renderGate(rng), 2232, 160, 16, { hw: 15, depth: 4 });
    // Farolas de la autopista a ambos lados, y el resplandor de la ciudad al fondo.
    for (const t of ROAD_LAMPS) {
      const s = roadS(t), h = Math.round(20 * s) + 6;
      for (const side of [-1, 1]) this.lights.push({ x: roadX(t, side * 1.08) + side * 4 - side * (6 * s + 2), y: roadY(t) - h, r: 4 + 6 * s, col: '255,236,190', a: 0.22 + 0.25 * s });
    }
    this.lights.push({ x: roadCX(0), y: ROAD.vanishY - 2, r: 14, col: '255,225,190', a: 0.28 });
    const colors = ['#e8e6ea', '#c8443f', '#3b4a6b', '#8a8f99', '#d9b86a'];
    this.carImgs = { front: colors.map((c) => renderCar(true, c)), rear: colors.map((c) => renderCar(false, c)) };
    // El kiosco rojo: bajo su toldo los rayos no llegan.
    this.addProp('kiosk', renderKiosk(), KIOSK.x, KIOSK.baseY, 14);
    this.lights.push({ x: KIOSK.x + 1, y: KIOSK.baseY - 22, r: 6, col: '255,225,170', a: 0.3 });
    this.carried = renderCarriedFlower().toCanvas();
    // Los árboles muertos de la tormenta: de pie junto a la vereda; caen al
    // acercarse y el tronco cierra el camino hasta romperlo con J.
    for (const bx of BARRIERS) {
      const variants = [3, 2, 1].map((hp) => renderFallenTrunk(new Rng(bx), hp));
      const standing = renderDeadTree(new Rng(bx + 1));
      const pr = this.addProp('barrier', standing, bx, 153, 12, { hw: 4, depth: 3 });
      pr.hp = 3; pr.variants = variants; pr.standing = standing; pr.tree = 'stand'; pr.t = 0;
    }
    this.seated = GRECIA_SEATED.toCanvas();
    this.dragonImgs = {
      sleep: [renderDragon('sleep', 0), renderDragon('sleep', 1)],
      wake: renderDragon('wake', 0),
      fly: [renderDragon('fly', 0), renderDragon('fly', 1)],
    };
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

  /** Avisos para la interfaz (ayudas, sonidos), se consumen al leerlos. */
  takeEvents(): string[] { return this.events.splice(0); }

  /** Cuánto ha amainado la tormenta: 0 con todos los troncos en pie … 1 con todos rotos. */
  private calm(): number { return this.broken / BARRIERS.length; }

  /** Qué se oye: día, noche y tormenta (0..1) donde está la cámara. */
  ambience(): { day: number; night: number; storm: number } {
    const n = this.mode === 'game' ? nightAt(this.camX + VW / 2) : 0;
    const st = this.mode === 'game' ? stormAt(this.camX + VW / 2) * (1 - this.calm()) : 0;
    return { day: 1 - n, night: n, storm: st };
  }

  /** ¿Está bajo el toldo del kiosco? Ahí los rayos y las ramas no la alcanzan. */
  private sheltered(): boolean {
    const fx = this.player.x + GIRL_W / 2, fy = this.player.y + GIRL_H - 1;
    return Math.abs(fx - KIOSK.x) < 16 && fy < 172;
  }

  /** Etiqueta con el nombre de Jhammil (coordenadas de pantalla) cuando ella está cerca de la banca. */
  nameTag(): { text: string; x: number; y: number } | null {
    if (this.mode !== 'game') return null;
    const cam = Math.round(this.camX);
    if (!this.benchTalked && (this.player.sitting || this.nearProp?.kind === 'bench')) return { text: story.himName, x: BENCH.x + 9 - cam, y: BENCH.baseY - 29 };
    const d = this.dragon;
    if (d.state === 'wake' || (d.state === 'fly' && d.t < 1.5)) return { text: story.dragonName, x: Math.round(d.x) + 12 - cam, y: Math.round(d.y) - 3 };
    return null;
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

  // La flor de lila en su mano, según hacia dónde mira.
  private drawCarried(ctx: CanvasRenderingContext2D, gx: number, gy: number, facing: Facing): void {
    const off: Record<Facing, Pt> = { right: [8, 9], left: [-1, 9], up: [9, 10], down: [9, 10] };
    const [dx, dy] = off[facing];
    const glow = 0.25 + 0.2 * Math.sin(this.t * 3);
    ctx.fillStyle = `rgba(225,205,255,${glow.toFixed(3)})`;
    ctx.fillRect(gx + dx - 1, gy + dy - 1, 7, 6);
    ctx.drawImage(this.carried, gx + dx, gy + dy);
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
    if (p.stun > 0) {
      // Tropieza: retrocede un poco y no responde un instante.
      p.stun -= dt; p.moving = false; p.walkT = 0;
      p.x = Math.max(-2, p.x + p.knock * dt);
      p.knock *= Math.exp(-8 * dt);
      return;
    }
    const [ax, ay] = input.axis;
    // Correr (Shift / K): más rápido mientras quede aliento; se recupera al caminar.
    const wantsRun = input.running && (ax !== 0 || ay !== 0);
    p.running = wantsRun && p.stamina > 0;
    p.stamina = Math.max(0, Math.min(1, p.stamina + (p.running ? -dt / 1.3 : dt / 2)));
    if (p.sitting) {
      // Cualquier flecha la levanta de la banca.
      if (ax === 0 && ay === 0) return;
      p.sitting = false;
      p.y = BENCH.baseY + 4 - GIRL_H + 1;
    }
    p.moving = ax !== 0 || ay !== 0;
    if (!p.moving) { p.walkT = 0; return; }
    const mult = p.running ? RUN_MULT : 1;
    p.walkT += dt * mult;
    p.facing = ax !== 0 ? (ax > 0 ? 'right' : 'left') : ay > 0 ? 'down' : 'up';
    if (p.running) {
      this.dustTimer -= dt;
      if (this.dustTimer <= 0) {
        this.dustTimer = 0.12;
        this.critters.push({ kind: 'puff', x: p.x + GIRL_W / 2 - ax * 4, y: p.y + GIRL_H - 2, vx: -ax * 10, vy: -8, ph: 0, t: 0, life: 0.4, col: '#c9c2b4' });
      }
    }
    const nx = Math.min(WORLD_W - GIRL_W + 2, Math.max(-2, p.x + ax * SPEED_X * mult * dt));
    const ny = Math.min(VH - GIRL_H, Math.max(HORIZON - GIRL_H + 2, p.y + ay * SPEED_Y * mult * dt));
    if (!this.blocked(nx, ny)) { p.x = nx; p.y = ny; }
    else if (!this.blocked(nx, p.y)) p.x = nx;
    else if (!this.blocked(p.x, ny)) p.y = ny;
  }

  private findNearProp(): Prop | null {
    const fx = this.player.x + GIRL_W / 2, fy = this.player.y + GIRL_H - 1;
    let best: Prop | null = null, bestD = Infinity;
    for (const pr of this.props) {
      if (pr.kind !== 'bush' && pr.kind !== 'bench' && pr.kind !== 'barrier' && pr.kind !== 'flower') continue;
      if (pr.kind === 'bench' && this.benchTalked) continue;
      const dx = Math.abs(fx - pr.cx), dy = Math.abs(fy - pr.baseY);
      if (pr.kind === 'barrier' && pr.tree !== 'down') continue;
      if (pr.kind === 'barrier' ? dx > 22 : dx > pr.r + 9 || dy > 14) continue;
      // La banca y las marañas tienen prioridad sobre los arbustos de alrededor.
      const d = dx + dy * 2 - (pr.kind === 'bush' ? 0 : 100);
      if (d < bestD) { bestD = d; best = pr; }
    }
    return best;
  }

  // J junto a la banca: Grecia se sienta al lado de Jhammil y se miran.
  private sit(): void {
    const p = this.player;
    p.sitting = true; p.moving = false; p.walkT = 0; p.facing = 'right';
    p.x = BENCH.x - 22 + 8; p.y = BENCH.baseY - 25;
    this.zoomTarget = 2;
    if (!this.benchTalked) { this.busy = true; this.events.push('talk:bench'); }
  }

  /** Terminó la charla: se paran los dos y Jhammil la acompaña desde aquí. */
  afterTalk(): void {
    this.busy = false;
    this.benchTalked = true;
    this.zoomTarget = 1;
    const p = this.player;
    p.sitting = false;
    p.y = BENCH.baseY + 4 - GIRL_H + 1;
    p.facing = 'right';
    const bench = this.props.find((pr) => pr.kind === 'bench');
    if (bench) bench.img = this.benchEmpty;
    this.him.active = true;
    this.him.x = BENCH.x + 6; this.him.y = BENCH.baseY + 4 - HIM_H + 1; this.him.facing = 'left';
    this.him.side = 1;
    this.nearProp = null;
  }

  // Jhammil camina al lado de Grecia, de la mano: se pone del lado contrario
  // a donde ella mira (un paso atrás) y sigue su ritmo. Si ella se da la
  // vuelta, él pasa por detrás y le toma la mano del otro lado.
  private updateFollower(dt: number): void {
    const h = this.him, p = this.player;
    if (!h.active) return;
    if (p.moving && (p.facing === 'left' || p.facing === 'right')) h.side = p.facing === 'right' ? -1 : 1;
    const tx = p.x + h.side * HAND_GAP, ty = p.y - 1 + (GIRL_H - HIM_H);
    const dx = tx - h.x, dy = ty - h.y;
    const d = Math.hypot(dx, dy);
    if (d > 1 && !p.sitting) {
      const base = p.running ? SPEED_X * RUN_MULT : SPEED_X;
      const sp = Math.min(d / dt, base * 1.4 + 12);
      h.x += (dx / d) * sp * dt; h.y += (dy / d) * sp * dt;
      h.moving = p.moving || d > 4;
      h.walkT += dt * (p.running ? RUN_MULT : 1);
      h.facing = p.moving ? p.facing : Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    } else {
      h.moving = false; h.walkT = 0;
      if (!p.sitting) h.facing = p.facing;
    }
    // Van de la mano cuando están a la distancia justa.
    const near = Math.abs(h.x - (p.x + h.side * HAND_GAP)) < 2.5 && Math.abs(h.y - ty) < 3;
    if (near && !h.holding && !h.everHeld) {
      h.everHeld = true;
      this.events.push('sfx:twinkle');
      const r = this.rng;
      for (let i = 0; i < 3; i++) this.critters.push({ kind: 'heart', x: p.x + h.side * 5 + 6, y: p.y + 8, vx: r.range(-6, 6), vy: -r.range(12, 20), ph: r.range(0, 6.28), t: -i * 0.15, life: 2.2, col: r.pick(['#f38fb1', '#f7a8c4']) });
    }
    h.holding = near;
  }

  // J sobre un arbusto: se sacude y suelta lo que esconde (una sola vez).
  private poke(pr: Prop): void {
    if (pr.kind === 'bench') { this.sit(); return; }
    if (pr.kind === 'barrier') { this.hitBarrier(pr); return; }
    if (pr.kind === 'flower') {
      this.props.splice(this.props.indexOf(pr), 1);
      this.player.flower = true;
      this.nearProp = null;
      this.events.push('flower'); this.events.push('sfx:twinkle');
      const r = this.rng;
      for (let k = 0; k < 10; k++) this.critters.push({ kind: 'puff', x: pr.cx + r.range(-6, 6), y: pr.baseY - r.range(4, 14), vx: r.range(-14, 14), vy: r.range(-24, -8), ph: 0, t: 0, life: 0.9, col: r.pick([C.lilacLight, C.lilacPale]) });
      return;
    }
    pr.shake = 0.5;
    this.events.push('sfx:rustle');
    const r = this.rng;
    const top = pr.baseY - pr.r * 2;
    for (let i = 0; i < 4; i++) {
      this.critters.push({ kind: 'puff', x: pr.cx + r.range(-pr.r, pr.r), y: top + r.range(0, pr.r), vx: r.range(-22, 22), vy: r.range(-40, -15), ph: 0, t: 0, life: 1.2, col: r.pick(PETAL_COLS) });
    }
    if (pr.used || pr.secret === 'none') return;
    pr.used = true;
    this.events.push('sfx:flutter');
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

  // Chimuelo: duerme; cuando Grecia se acerca despierta, suelta corazones y se
  // va volando. Si ella se aleja un rato, vuelve a dormirse en su sitio.
  private updateDragon(dt: number): void {
    const d = this.dragon;
    d.t += dt;
    const px = this.player.x + GIRL_W / 2;
    const r = this.rng;
    if (d.state === 'sleep') {
      if (this.t - d.lastZ > 1.7) {
        d.lastZ = this.t;
        this.critters.push({ kind: 'zz', x: d.x + 10, y: d.y + 12, vx: 6, vy: -9, ph: r.range(0, 6.28), t: 0, life: 1.9, col: C.white });
      }
      if (!this.player.sitting && Math.abs(px - (d.x + DRAGON.w / 2)) < 48) { d.state = 'wake'; d.t = 0; this.events.push('sfx:purr'); }
    } else if (d.state === 'wake') {
      if (!d.hearts && d.t > 0.45) {
        d.hearts = true;
        this.events.push('sfx:twinkle');
        for (let i = 0; i < 8; i++) {
          this.critters.push({ kind: 'heart', x: d.x + 4 + r.range(0, 16), y: d.y + 2 + r.range(0, 8), vx: r.range(-10, 10), vy: -r.range(14, 26), ph: r.range(0, 6.28), t: -r.range(0, 0.6), life: 2.6, col: r.pick(['#f38fb1', '#f7a8c4', '#e86f9a']) });
        }
      }
      if (d.t > 1.9) { d.state = 'fly'; d.t = 0; d.vx = 26; d.vy = -22; }
    } else if (d.state === 'fly') {
      d.vx += 22 * dt; d.vy -= 26 * dt;
      d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.t < 1.2 && r.next() < 0.15) {
        this.critters.push({ kind: 'heart', x: d.x + 16, y: d.y + 10, vx: r.range(-8, 8), vy: -r.range(8, 16), ph: r.range(0, 6.28), t: 0, life: 1.8, col: '#f7a8c4' });
      }
      if (d.y < -50 || d.x > WORLD_W + 60) { d.state = 'gone'; d.t = 0; }
    } else if (d.t > 14 && Math.abs(px - DRAGON.x) > 170) {
      d.state = 'sleep'; d.t = 0; d.hearts = false;
      d.x = DRAGON.x; d.y = DRAGON.baseY - DRAGON.h + 3;
    }
  }

  // Autopista: por los carriles de la derecha vienen autos creciendo; por los
  // de la izquierda se alejan. Si uno pisa a Grecia o a Jhammil, vuelven a la banca.
  private updateHighway(dt: number): void {
    const p = this.player, r = this.rng;
    if (!this.roadSeen && p.x > ROAD.cx - 210) { this.roadSeen = true; this.events.push('road'); }
    const active = p.x > ROAD.cx - 420 && p.x < ROAD.cx + 320;
    const fx = p.x + GIRL_W / 2, fy = p.y + GIRL_H - 1;
    const hx = this.him.x + GIRL_W / 2, hy = this.him.y + HIM_H - 1;
    for (let i = 0; i < ROAD_LANES.length; i++) {
      this.laneTimers[i] -= dt;
      if (active && this.laneTimers[i] <= 0) {
        const L = ROAD_LANES[i];
        this.cars.push({ t: L.coming ? 0 : 1.12, lane: i, speed: r.range(0.36, 0.5), img: r.pick(L.coming ? this.carImgs.front : this.carImgs.rear), passed: false });
        this.laneTimers[i] = r.range(2.4, 5);
      }
    }
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i], L = ROAD_LANES[c.lane];
      // Velocidad en t más lenta lejos (parece constante en perspectiva).
      const v = c.speed * (0.35 + 0.65 * c.t);
      c.t += (L.coming ? 1 : -1) * v * dt;
      if (c.t > 1.15 || c.t < -0.02) { this.cars.splice(i, 1); continue; }
      const cx = roadX(c.t, L.off), cy = roadY(c.t), s = roadS(c.t);
      const hw = 10 * s + 2;
      const hits = (x: number, y: number) => Math.abs(x - cx) < hw && Math.abs(y - cy) < 6;
      if (!c.passed && cy > fy - 7 && cy < fy + 7 && Math.abs(cx - fx) < 80) { c.passed = true; this.events.push('sfx:whoosh'); }
      if (!this.runOver && !p.sitting && (hits(fx, fy) || (this.him.active && hits(hx, hy)))) {
        this.runOver = true;
        p.moving = false; p.stun = 99;
        this.events.push('sfx:horn'); this.events.push('hit:car');
      }
    }
  }

  /** Tras un atropello: de vuelta a la banca, de pie y de la mano. */
  respawnAtBench(): void {
    const p = this.player;
    this.runOver = false;
    p.stun = 0; p.knock = 0; p.running = false; p.stamina = 1; p.sitting = false;
    p.x = BENCH.x - 14; p.y = BENCH.baseY + 4 - GIRL_H + 1; p.facing = 'right';
    if (this.him.active) { this.him.x = p.x - HAND_GAP; this.him.y = p.y - 1 + (GIRL_H - HIM_H); this.him.side = -1; this.him.facing = 'right'; }
    this.cars.length = 0;
    this.camX = Math.min(WORLD_W - VW, Math.max(0, p.x + GIRL_W / 2 - VW / 2));
    if (this.dragon.state === 'gone') this.dragon.t = 99;
  }

  // Luciérnagas en el parque de noche (no en la tormenta) y, de vez en cuando,
  // una estrella fugaz.
  private updateNightLife(dt: number): void {
    const r = this.rng;
    const cx = this.camX + VW / 2;
    const calm = nightAt(cx) * (1 - stormAt(cx));
    const want = calm > 0.5 ? 12 : 0;
    while (this.fireflies.length < want) {
      this.fireflies.push({ x: this.camX + r.range(0, VW), y: r.range(95, 172), vx: r.range(-6, 6), vy: r.range(-4, 4), ph: r.range(0, 6.28) });
    }
    if (want === 0) this.fireflies.length = 0;
    for (const f of this.fireflies) {
      f.vx += r.range(-8, 8) * dt; f.vy += r.range(-6, 6) * dt;
      f.vx = Math.max(-9, Math.min(9, f.vx)); f.vy = Math.max(-6, Math.min(6, f.vy));
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.y < 90) f.vy = Math.abs(f.vy); if (f.y > 174) f.vy = -Math.abs(f.vy);
      // Si se queda muy lejos de la cámara, reaparece dentro de la pantalla.
      if (f.x < this.camX - 30 || f.x > this.camX + VW + 30) { f.x = this.camX + r.range(0, VW); f.y = r.range(95, 172); }
    }
    this.nextMeteor -= dt;
    if (!this.meteor && calm > 0.6 && this.nextMeteor <= 0) {
      this.meteor = { x: r.range(40, VW - 40), y: r.range(4, 30), vx: r.range(-1, 1) < 0 ? -170 : 170, vy: 70, t: 0 };
      this.nextMeteor = r.range(12, 26);
    }
    if (this.meteor) {
      const m = this.meteor;
      m.t += dt; m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.t > 0.7) this.meteor = null;
    }
  }

  // Algo la lastimó: se queda quieta y la interfaz la manda de vuelta al menú.
  private hurt(): void {
    this.caught = true;
    this.player.moving = false; this.player.stun = 99;
    this.events.push('caught');
  }

  // Golpe a un tronco caído: se astilla, y al tercer golpe se parte. Con cada
  // problema roto la tormenta amaina un poco.
  /** Posición del marcador de ritmo (0..1) y si ahora mismo está en el centro. */
  rhythm(): { m: number; good: boolean } {
    const m = 0.5 + 0.5 * Math.sin(this.t * 4.2);
    return { m, good: Math.abs(m - 0.5) < 0.15 };
  }

  private hitBarrier(pr: Prop): void {
    const r = this.rng;
    pr.shake = 0.4;
    // Con ritmo: J con el marcador al centro golpea fuerte; fuera, apenas astilla.
    const { good } = this.rhythm();
    pr.hp = (pr.hp ?? 1) - (good ? 1.5 : 0.5);
    const n = pr.hp > 0 ? (good ? 10 : 3) : 22;
    for (let i = 0; i < n; i++) {
      this.critters.push({ kind: 'puff', x: pr.cx + r.range(-7, 7), y: pr.baseY - r.range(4, 34), vx: r.range(-45, 45), vy: r.range(-70, -10), ph: 0, t: 0, life: pr.hp > 0 ? 0.7 : 1.1, col: r.pick(['#6f5c55', '#8a746a', '#3f3430']) });
    }
    if (pr.hp > 0) { pr.img = pr.variants![Math.min(2, 3 - Math.ceil(pr.hp))]; this.events.push(good ? 'sfx:crack' : 'sfx:hit'); return; }
    this.props.splice(this.props.indexOf(pr), 1);
    this.broken++;
    this.events.push('sfx:crack');
    if (this.broken === BARRIERS.length) this.flowerTimer = 1.4;
    this.flash = Math.max(this.flash, 0.6);
    if (this.nearProp === pr) this.nearProp = null;
  }

  // Lluvia, gotas pesadas que hay que esquivar y relámpagos. Todo amaina
  // según los problemas rotos.
  private updateStorm(dt: number): void {
    const p = this.player;
    const intensity = stormAt(this.camX + VW / 2) * (1 - this.calm());
    const r = this.rng;
    if (!this.shelterSeen && Math.abs(p.x - KIOSK.x) < 70) { this.shelterSeen = true; this.events.push('shelter'); }
    // Al romper el último tronco, la flor de lila aparece en el camino.
    if (this.flowerTimer >= 0) {
      this.flowerTimer -= dt;
      if (this.flowerTimer < 0) {
        this.addProp('flower', renderFlowerItem(), FLOWER_SPOT.x, FLOWER_SPOT.baseY, 10);
        this.events.push('sfx:twinkle');
        for (let k = 0; k < 12; k++) this.critters.push({ kind: 'puff', x: FLOWER_SPOT.x + r.range(-8, 8), y: FLOWER_SPOT.baseY - r.range(2, 14), vx: r.range(-12, 12), vy: r.range(-20, -6), ph: 0, t: 0, life: 1, col: r.pick([C.lilacLight, C.lilacPale, '#fff6d6']) });
      }
    }
    // Ramas que caen rápido cerca de Grecia; si la alcanzan, tropieza.
    this.nextBranch -= dt;
    if (intensity > 0.25 && this.nextBranch <= 0 && !p.sitting && !this.caught) {
      const x = Math.min(STORM.x1 - 30, Math.max(STORM.x0 + 30, p.x + r.range(-40, 80)));
      this.branches.push({ x, groundY: r.range(HORIZON + 3, VH - 3), h: 130, v: r.range(150, 190), rot: r.range(0, 6.28) });
      this.nextBranch = r.range(1.4, 3) / Math.max(0.4, intensity);
    }
    for (let i = this.branches.length - 1; i >= 0; i--) {
      const b = this.branches[i];
      b.h -= b.v * dt; b.rot += 6 * dt;
      if (b.h > 0) continue;
      this.branches.splice(i, 1);
      const onRoof = Math.abs(b.x - KIOSK.x) < 18 && b.groundY < 172;
      const py = onRoof ? KIOSK.baseY - 30 : b.groundY - 1;
      for (let k = 0; k < 5; k++) this.critters.push({ kind: 'puff', x: b.x + r.range(-3, 3), y: py, vx: r.range(-30, 30), vy: r.range(-40, -10), ph: 0, t: 0, life: 0.6, col: r.pick(['#6f5c55', '#8a746a']) });
      const fx = p.x + GIRL_W / 2, fy = p.y + GIRL_H - 1;
      if (!onRoof && p.stun <= 0 && !this.caught && Math.abs(fx - b.x) < 7 && Math.abs(fy - b.groundY) < 5) { p.stun = 0.6; p.knock = -55; p.moving = false; this.events.push('sfx:thud'); }
    }
    if (!this.stormSeen && p.x > STORM.x0 - 30) { this.stormSeen = true; this.events.push('storm'); }
    // Lluvia en pantalla: la cantidad sigue a la intensidad.
    const want = Math.round(90 * intensity);
    while (this.rain.length < want) this.rain.push({ x: r.range(-20, VW + 40), y: r.range(-VH, VH), v: r.range(150, 230) });
    if (this.rain.length > want) this.rain.length = want;
    for (const d of this.rain) {
      d.y += d.v * dt; d.x -= 38 * dt;
      if (d.y > 165 + (d.x * 7) % 14) { d.y = r.range(-40, -4); d.x = r.range(-10, VW + 50); }
    }
    // Árboles muertos: crujen al acercarse, caen cruzando la vereda.
    for (const pr of this.props) {
      if (pr.kind !== 'barrier' || !pr.tree || pr.tree === 'down') continue;
      const fx = p.x + GIRL_W / 2;
      if (pr.tree === 'stand') {
        if (fx > pr.cx - 76 && fx < pr.cx + 14) { pr.tree = 'shake'; pr.t = 0; }
        continue;
      }
      pr.t = (pr.t ?? 0) + dt;
      if (pr.tree === 'shake') {
        if (pr.t - dt <= 0) this.events.push('sfx:creak');
        pr.shake = 0.3;
        if (r.next() < 0.3) this.critters.push({ kind: 'puff', x: pr.cx + r.range(-6, 6), y: pr.baseY - r.range(10, 36), vx: r.range(-15, 15), vy: r.range(-10, 20), ph: 0, t: 0, life: 0.5, col: '#6f5c55' });
        if (pr.t > 1.2) { pr.tree = 'fall'; pr.t = 0; pr.shake = 0; }
      } else if (pr.tree === 'fall' && pr.t > 0.45) {
        // Aterriza cruzando la vereda: ahora es un tronco que bloquea el paso.
        pr.tree = 'down'; pr.t = 0;
        pr.img = pr.variants![0];
        pr.baseY = 181; pr.y = 181 - pr.img.height + 3; pr.x = pr.cx - (pr.img.width >> 1);
        pr.solid = { hw: 8, depth: 34 };
        this.flash = Math.max(this.flash, 0.35);
        this.events.push('sfx:thud');
        for (let k = 0; k < 14; k++) this.critters.push({ kind: 'puff', x: pr.cx + r.range(-10, 10), y: r.range(152, 180), vx: r.range(-40, 40), vy: r.range(-45, -5), ph: 0, t: 0, life: 0.7, col: r.pick(['#6f5c55', '#8a746a', '#3f3430']) });
        if (!this.breakSeen) { this.breakSeen = true; this.events.push('break'); }
        const fy = p.y + GIRL_H - 1;
        if (!this.caught && Math.abs(fx - pr.cx) < 11 && fy > 148 && fy < 182) this.hurt();
      }
    }
    // Rayos dirigidos: aviso en el suelo y luego caen. Si alcanzan a Grecia, se vuelve al menú.
    this.nextStrike -= dt;
    if (intensity > 0.25 && this.nextStrike <= 0 && !p.sitting && !this.caught) {
      const x = Math.min(STORM.x1 - 30, Math.max(STORM.x0 + 30, p.x + r.range(-50, 90)));
      this.strikes.push({ x, groundY: r.range(HORIZON + 3, VH - 3), t: 0 });
      this.nextStrike = r.range(2.6, 5) / Math.max(0.4, intensity);
    }
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const st = this.strikes[i];
      const before = st.t;
      st.t += dt;
      if (before < 0.85 && st.t >= 0.85) {
        // Cae el rayo. Si cae sobre el kiosco, pega en el toldo.
        const onRoof = Math.abs(st.x - KIOSK.x) < 20 && st.groundY < 172;
        const endY = onRoof ? KIOSK.baseY - 32 : st.groundY;
        const pts: Pt[] = [[st.x - this.camX + r.range(-10, 10), -2]];
        let x = pts[0][0], y = 0;
        while (y < endY - 12) { x += (st.x - this.camX - x) * 0.35 + r.range(-8, 8); y += r.range(10, 16); pts.push([x, y]); }
        pts.push([st.x - this.camX, endY]);
        this.bolt = { pts, t: 0 };
        this.flash = 1;
        this.events.push('sfx:thunder:1');
        for (let k = 0; k < 10; k++) this.critters.push({ kind: 'puff', x: st.x + r.range(-4, 4), y: endY - 1, vx: r.range(-50, 50), vy: r.range(-60, -10), ph: 0, t: 0, life: 0.5, col: r.pick(['#fff6c8', '#ffe27a']) });
        const fx = p.x + GIRL_W / 2, fy = p.y + GIRL_H - 1;
        if (!this.caught && !this.sheltered() && Math.abs(fx - st.x) < 9 && Math.abs(fy - st.groundY) < 7) this.hurt();
      }
      if (st.t > 1.7) this.strikes.splice(i, 1);
    }
    // Relámpagos mientras la tormenta esté fuerte.
    this.nextBolt -= dt;
    if (intensity > 0.3 && this.nextBolt <= 0) {
      const x0 = r.range(30, VW - 30);
      const pts: Pt[] = [[x0, -2]];
      let x = x0, y = 0;
      while (y < r.range(70, 110)) { x += r.range(-12, 12); y += r.range(10, 18); pts.push([x, y]); }
      this.bolt = { pts, t: 0 };
      this.flash = 1;
      this.events.push('sfx:thunder:0.6');
      this.nextBolt = r.range(3.5, 8) / Math.max(0.4, intensity);
    }
    if (this.bolt) { this.bolt.t += dt; if (this.bolt.t > 0.16) this.bolt = null; }
    this.flash = Math.max(0, this.flash - dt * 3);
  }

  private updateCritters(dt: number): void {
    for (let i = this.critters.length - 1; i >= 0; i--) {
      const c = this.critters[i];
      c.t += dt;
      if (c.t < 0) continue;
      if (c.kind === 'puff') {
        c.vy += 70 * dt;
        c.x += c.vx * dt; c.y += c.vy * dt;
      } else if (c.kind === 'heart' || c.kind === 'zz') {
        c.x += (c.vx + Math.sin(c.t * 3 + c.ph) * 8) * dt;
        c.y += c.vy * dt;
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
      if (input && !this.busy) {
        this.movePlayer(dt, input);
        this.nearProp = this.findNearProp();
        if (input.take(ACTION) && this.nearProp) this.poke(this.nearProp);
      }
      this.zoom += (this.zoomTarget - this.zoom) * (1 - Math.exp(-4 * dt));
      this.updateFollower(dt);
      for (const pr of this.props) if (pr.shake > 0) pr.shake = Math.max(0, pr.shake - dt);
      this.updateDragon(dt);
      this.updateStorm(dt);
      this.updateHighway(dt);
      this.updateNightLife(dt);
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
    // Las nubes van en la capa media (parallax), así que se atenúan según dónde
    // está la cámara para no seguir tapando el cielo fuera de la tormenta.
    const cloudA = (1 - this.calm()) * Math.min(1, stormAt(this.camX + VW / 2) * 1.6);
    if (cloudA > 0.02) { ctx.globalAlpha = cloudA; ctx.drawImage(this.clouds, -Math.round(this.camX * PAR_MID), 0); ctx.globalAlpha = 1; }
    ctx.drawImage(this.world, -cam, 0);
    type Drawable = { baseY: number; draw: () => void };
    const items: Drawable[] = [];
    for (const pr of this.props) {
      const sx = pr.x - cam;
      if (sx > VW || sx + pr.img.width < 0) continue;
      const shake = pr.shake > 0 ? Math.round(Math.sin(pr.shake * 40) * 1.5) : 0;
      if (pr.tree === 'fall') {
        // Se desploma hacia la vereda: el árbol de pie se aplasta y aparece el tronco tendido.
        const k = Math.min(1, (pr.t ?? 0) / 0.45);
        const lying = pr.variants![0];
        items.push({ baseY: 181, draw: () => {
          const h = Math.max(1, Math.round(pr.standing!.height * (1 - k)));
          ctx.drawImage(pr.standing!, sx, pr.baseY + 3 - h, pr.standing!.width, h);
          if (k > 0.4) { ctx.globalAlpha = (k - 0.4) / 0.6; ctx.drawImage(lying, pr.cx - cam - (lying.width >> 1), 181 - lying.height + 3); ctx.globalAlpha = 1; }
        } });
        continue;
      }
      items.push({ baseY: pr.baseY, draw: () => ctx.drawImage(pr.img, sx + shake, pr.y) });
    }
    // Sombras de las ramas que caen.
    for (const b of this.branches) {
      const rx = 1.5 + 2.5 * (1 - b.h / 130);
      ctx.fillStyle = 'rgba(20,18,40,0.35)';
      ctx.beginPath(); ctx.ellipse(b.x - cam, b.groundY, rx, Math.max(1, rx * 0.45), 0, 0, 6.2832); ctx.fill();
    }
    // Aviso de rayo: mancha de luz que palpita donde va a caer.
    for (const st of this.strikes) {
      if (st.t >= 0.85) continue;
      const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(st.t * 22));
      ctx.fillStyle = `rgba(255,246,200,${a.toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(st.x - cam, st.groundY, 9, 3, 0, 0, 6.2832); ctx.fill();
      ctx.fillStyle = `rgba(255,246,200,${(a * 0.5).toFixed(3)})`;
      ctx.fillRect(Math.round(st.x - cam), st.groundY - 40, 1, 40);
    }
    const d = this.dragon;
    if (d.state !== 'gone') {
      const img = d.state === 'sleep' ? this.dragonImgs.sleep[Math.floor(this.t / 0.9) & 1]
        : d.state === 'wake' ? this.dragonImgs.wake
        : this.dragonImgs.fly[Math.floor(this.t / 0.14) & 1];
      const dx = Math.round(d.x) - cam, dy = Math.round(d.y);
      if (dx < VW && dx + DRAGON.w > 0) items.push({ baseY: d.state === 'fly' ? 9999 : DRAGON.baseY, draw: () => ctx.drawImage(img, dx, dy) });
    }
    for (const c of this.cars) {
      const L = ROAD_LANES[c.lane];
      const cx = roadX(c.t, L.off), cy = roadY(c.t), s = roadS(c.t);
      const w = Math.max(3, Math.round(20 * s)), h = Math.max(2, Math.round(11 * s));
      const dx = Math.round(cx - w / 2) - cam, dy = Math.round(cy - h);
      if (dx > VW || dx + w < 0) continue;
      items.push({ baseY: cy, draw: () => ctx.drawImage(c.img, dx, dy, w, h) });
    }
    if (withPlayer && this.him.active) {
      const h = this.him;
      const set = this.himSprites[h.facing];
      const i = Math.floor(h.walkT / 0.13) % set.walk.length;
      const img = h.moving ? set.walk[i] : set.idle[0];
      const bob = h.moving && (i & 1) ? -1 : 0;
      const hx = Math.round(h.x) - cam, hy = Math.round(h.y) + bob;
      items.push({ baseY: h.y + HIM_H - 1, draw: () => { ctx.drawImage(this.girlShadow, hx, hy - bob + HIM_H - 2); ctx.drawImage(img, hx, hy); } });
    }
    if (withPlayer) {
      const p = this.player;
      if (p.sitting) {
        items.push({ baseY: BENCH.baseY + 0.5, draw: () => {
          ctx.drawImage(this.seated, Math.round(p.x) - cam, Math.round(p.y));
          if (p.flower) this.drawCarried(ctx, Math.round(p.x) - cam, Math.round(p.y), 'right');
        } });
      } else {
        const { img, bob } = this.girlFrame();
        const wob = p.stun > 0 ? Math.round(Math.sin(p.stun * 40) * 1.5) : 0;
        const gx = Math.round(p.x) - cam + wob, gy = Math.round(p.y) + bob;
        items.push({ baseY: p.y + GIRL_H - 1, draw: () => {
          ctx.drawImage(this.girlShadow, gx - wob, gy - bob + GIRL_H - 2);
          ctx.drawImage(img, gx, gy);
          if (p.flower) this.drawCarried(ctx, gx, gy, p.facing);
          if (this.him.holding && !p.sitting) {
            // Sus manos, unidas: dos o tres píxeles de piel entre los dos.
            const hx = Math.round(this.him.x) - cam;
            const x0 = this.him.side < 0 ? hx + 10 : gx + 10, x1 = this.him.side < 0 ? gx + 2 : hx + 1;
            ctx.fillStyle = C.skin;
            ctx.fillRect(Math.min(x0, x1), gy + 15, Math.abs(x1 - x0) + 1, 1);
            ctx.fillStyle = C.skinShade;
            ctx.fillRect(Math.min(x0, x1), gy + 16, Math.abs(x1 - x0) + 1, 1);
          }
        } });
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
      } else if (c.kind === 'heart') {
        crisp.globalAlpha = Math.max(0, Math.min(1, (c.life - c.t) / 0.8));
        crisp.fillRect(x - 2, y - 1, 2, 1); crisp.fillRect(x + 1, y - 1, 2, 1);
        crisp.fillRect(x - 2, y, 5, 2); crisp.fillRect(x - 1, y + 2, 3, 1); crisp.fillRect(x, y + 3, 1, 1);
        crisp.fillStyle = '#ffd2e1'; crisp.fillRect(x - 1, y, 1, 1);
        crisp.globalAlpha = 1;
      } else if (c.kind === 'zz') {
        crisp.globalAlpha = Math.max(0, Math.min(1, (c.life - c.t) / 0.7));
        crisp.fillStyle = '#f4f0ff';
        crisp.fillRect(x, y, 3, 1); crisp.fillRect(x + 1, y + 1, 1, 1); crisp.fillRect(x, y + 2, 3, 1);
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

    // Ramas cayendo (giran) y barra de ritmo sobre el tronco cercano.
    for (const b of this.branches) {
      const x = Math.round(b.x) - cam, y = Math.round(b.groundY - b.h);
      const horiz = Math.cos(b.rot) > 0;
      crisp.fillStyle = '#5a4a44';
      if (horiz) { crisp.fillRect(x - 3, y, 7, 2); crisp.fillRect(x + 1, y - 2, 1, 2); }
      else { crisp.fillRect(x, y - 3, 2, 7); crisp.fillRect(x + 2, y - 1, 2, 1); }
    }
    if (this.nearProp?.kind === 'barrier' && this.nearProp.tree === 'down' && !this.player.sitting) {
      const m = this.nearProp, { m: pos, good } = this.rhythm();
      const bx = m.cx - cam - 13, by = m.baseY - 50;
      crisp.fillStyle = 'rgba(30,27,42,0.8)'; crisp.fillRect(bx, by, 26, 5);
      crisp.fillStyle = good ? '#e6d9ff' : '#9d8fc4'; crisp.fillRect(bx + 9, by + 1, 8, 3);
      crisp.fillStyle = '#ffffff'; crisp.fillRect(bx + 1 + Math.round(pos * 23), by, 2, 5);
    }

    // Tormenta: lluvia, relámpagos, rayos con aviso y destello.
    if (this.rain.length) {
      crisp.fillStyle = 'rgba(205,214,242,0.55)';
      for (const d of this.rain) { const x = Math.round(d.x), y = Math.round(d.y); crisp.fillRect(x, y, 1, 3); crisp.fillRect(x - 1, y + 3, 1, 3); }
    }
    if (this.bolt) {
      crisp.fillStyle = '#f8f4ff';
      const pts = this.bolt.pts;
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
        for (let t = 0; t <= 1; t += 0.07) crisp.fillRect(Math.round(ax + (bx - ax) * t), Math.round(ay + (by - ay) * t), i < 3 ? 2 : 1, 1);
      }
    }
    if (this.flash > 0) { crisp.fillStyle = `rgba(240,236,255,${(0.45 * this.flash).toFixed(3)})`; crisp.fillRect(0, 0, VW, VH); }

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
    // Luciérnagas: un punto verde-amarillo que se enciende y apaga, con halo.
    for (const f of this.fireflies) {
      const a = 0.5 + 0.5 * Math.sin(this.t * 2.2 + f.ph);
      if (a < 0.25) continue;
      const x = Math.round(f.x) - cam, y = Math.round(f.y);
      crisp.fillStyle = `rgba(214,255,140,${(0.25 * a).toFixed(3)})`;
      crisp.fillRect(x - 1, y - 1, 3, 3);
      crisp.fillStyle = `rgba(232,255,170,${a.toFixed(3)})`;
      crisp.fillRect(x, y, 1, 1);
    }
    // Estrella fugaz: trazo breve con cola que se apaga.
    if (this.meteor) {
      const m = this.meteor;
      const fade = m.t < 0.15 ? m.t / 0.15 : Math.max(0, (0.7 - m.t) / 0.55);
      for (let i = 0; i < 9; i++) {
        crisp.fillStyle = `rgba(255,250,235,${(fade * (1 - i / 9) * 0.9).toFixed(3)})`;
        crisp.fillRect(Math.round(m.x - m.vx * i * 0.012), Math.round(m.y - m.vy * i * 0.012), 1, 1);
      }
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
    // Acercamiento a la banca: la capa nítida se vuelve a dibujar ampliada
    // (escala entera cuando llega a 2×, así el píxel sigue nítido).
    if (this.zoom > 1.01) {
      const z = this.zoom, sw = VW / z, sh = VH / z;
      const cx = BENCH.x + 4 - cam, cy = BENCH.baseY - 16;
      const sx = Math.max(0, Math.min(VW - sw, cx - sw / 2)), sy = Math.max(0, Math.min(VH - sh, cy - sh / 2));
      crisp.drawImage(crisp.canvas, sx, sy, sw, sh, 0, 0, VW, VH);
      this.zoomBox = [sx / 4, sy / 4, sw / 4, sh / 4];
    } else {
      this.zoomBox = null;
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
    const stormK = stormAt(this.camX + VW / 2) * (1 - this.calm());
    if (stormK > 0) { haze.fillStyle = `rgba(38,42,70,${(0.32 * stormK).toFixed(3)})`; haze.fillRect(0, 0, SW, SH); }
    // Faros de los autos que vienen y luces rojas de los que se van.
    for (const c of this.cars) {
      const L = ROAD_LANES[c.lane];
      const cx = roadX(c.t, L.off), cy = roadY(c.t), s = roadS(c.t);
      const sx = (cx - cam) / 4, sy = (cy - 5 * s) / 4, rr = (L.coming ? 4.5 : 2.2) * s + 0.8;
      if (sx < -rr * 2 || sx > SW + rr * 2) continue;
      const g = haze.createRadialGradient(sx, sy, 0, sx, sy, rr * 2.2);
      const col = L.coming ? '255,240,200' : '255,90,90';
      g.addColorStop(0, `rgba(${col},${(L.coming ? 0.5 : 0.32) * Math.min(1, s)})`);
      g.addColorStop(1, `rgba(${col},0)`);
      haze.fillStyle = g;
      haze.fillRect(sx - rr * 2.2, sy - rr * 2.2, rr * 4.4, rr * 4.4);
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
    if (this.zoomBox) {
      const [sx, sy, sw, sh] = this.zoomBox;
      haze.drawImage(haze.canvas, sx, sy, sw, sh, 0, 0, SW, SH);
    }
  }
}

function toCanvasesJ(d: DirSprites): DirCanvases {
  return { idle: d.idle.map((f) => f.toCanvas()), walk: d.walk.map((f) => f.toCanvas()) };
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
  for (const [tx, n] of [[160, 60], [500, 24], [1768, 26]] as Pt[]) {
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

const LAMPS = [420, 655, 955, 1910];

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
  for (let x = 350; x < WORLD_W - 60; x += 46 + rng.int(34)) {
    const r = 7 + rng.int(6);
    const baseY = 153 + rng.int(26);
    if (x > STREET.x0 - 20 && x < STREET.x1 + 16) continue; // la esquina verde es pavimento
    if (x > STORM.x0 - 20 && x < STORM.x1 + 20) continue; // en la tormenta solo hay problemas
    if (Math.abs(x - BENCH.x) < 52) continue; // espacio libre alrededor de la banca
    if (Math.abs(x - DRAGON.x - DRAGON.w / 2) < 44) continue; // y alrededor de Chimuelo
    if (Math.abs(x - ROAD.cx) < 118) continue; // la autopista
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

// Banca grande de madera, con Jhammil sentado en el lado derecho, mirando a la izquierda.
function renderBench(him: PixelBuffer | null): HTMLCanvasElement {
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
  if (him) pb.blit(him, 27, 5);
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

// Chimuelo: dragón negro con brillos, orejitas, ojos verdes enormes, alas de
// murciélago y aleta roja en la cola. Mira a la izquierda (por donde llega ella).
function renderDragon(pose: 'sleep' | 'wake' | 'fly', frame: number): HTMLCanvasElement {
  const pb = new PixelBuffer(DRAGON.w, DRAGON.h);
  const O = hex('#141319'), K = hex('#25232c'), k = hex('#3d3a48'), W = hex('#2e2b38'), w = hex('#46425a');
  const G = hex('#9be24a'), R = hex('#a8433f'), T = hex('#e8e6e0');
  const curve = (a: Pt, c: Pt, b: Pt, n = 14): Pt[] => {
    const out: Pt[] = [];
    for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]); }
    return out;
  };
  const tube = (pts: Pt[], r0: number, r1: number) => {
    pts.forEach(([x, y], i) => pb.circle(x, y, Math.round(r0 + (r1 - r0) * (i / (pts.length - 1))) + 1, O));
    pts.forEach(([x, y], i) => pb.circle(x, y, Math.round(r0 + (r1 - r0) * (i / (pts.length - 1))), K));
  };
  const eyes = (x: number, y: number) => {
    for (const ex of [x, x + 6]) { pb.circle(ex, y, 2, O); pb.circle(ex, y, 1, G); pb.set(ex + 1, y, G); pb.set(ex, y - 1, hex('#c8f58a')); pb.rect(ex, y, 1, 2, O); }
  };
  const ears = (x: number, y: number, up: number) => {
    for (const [dx, dy] of [[-4, 1], [0, 0], [4, 1]] as Pt[]) { pb.rect(x + dx - 1, y + dy - up, 3, 3 + up, O); pb.rect(x + dx, y + dy - up + 1, 1, 2 + up, K); }
  };
  if (pose !== 'fly') {
    const dy = pose === 'sleep' && frame === 1 ? -1 : 0;
    pb.ellipse(22, 27, 19, 2, hex(C.shadow, 70));
    // Cola: sale del cuerpo por la derecha, baja y vuelve al frente, con la aleta roja.
    tube(curve([30, 21], [46, 27], [30, 27]), 2, 1);
    pb.poly([[30, 24], [24, 28], [33, 29]], O); pb.poly([[30, 25], [26, 28], [32, 28]], R);
    pb.poly([[31, 23], [37, 24], [32, 27]], O); pb.poly([[32, 24], [35, 25], [32, 26]], K);
    // Cuerpo enroscado.
    pb.ellipse(22, 20 + dy, 12, 7, O); pb.ellipse(22, 20 + dy, 11, 6, K); pb.ellipse(19, 17 + dy, 6, 2, k);
    // Ala plegada sobre el lomo, con sus dedos.
    pb.poly([[11, 15 + dy], [33, 12 + dy], [31, 19 + dy], [15, 21 + dy]], O);
    pb.poly([[13, 15 + dy], [32, 13 + dy], [30, 18 + dy], [16, 20 + dy]], W);
    pb.poly([[14, 15 + dy], [24, 14 + dy], [22, 16 + dy], [16, 17 + dy]], w);
    for (const [a, b] of [[[14, 15], [28, 18]], [[13, 15], [31, 14]], [[15, 16], [26, 20]]] as [Pt, Pt][]) {
      for (let t = 0; t <= 1; t += 0.08) pb.set(Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t + dy), O);
    }
    // Pata delantera con garras.
    pb.ellipse(15, 25, 4, 2, O); pb.ellipse(15, 25, 3, 1, K); pb.set(12, 26, T); pb.set(14, 26, T);
    if (pose === 'sleep') {
      // Cabeza apoyada, ojos cerrados.
      pb.ellipse(9, 21 + dy, 6, 5, O); pb.ellipse(9, 21 + dy, 5, 4, K); pb.ellipse(8, 19 + dy, 3, 1, k);
      ears(9, 15 + dy, 0);
      pb.rect(5, 21 + dy, 3, 1, k); pb.rect(10, 21 + dy, 3, 1, k);
      pb.set(4, 23 + dy, k); pb.set(5, 23 + dy, k);
    } else {
      // Despierto: cuello erguido, cabeza en alto, ojos abiertos.
      tube(curve([14, 18], [12, 14], [10, 12]), 3, 3);
      pb.ellipse(9, 10, 6, 5, O); pb.ellipse(9, 10, 5, 4, K); pb.ellipse(8, 8, 3, 1, k);
      ears(9, 5, 1);
      eyes(6, 10);
      pb.rect(4, 13, 4, 1, O); pb.set(4, 12, k);
    }
  } else {
    const up = frame === 0;
    // Cuerpo horizontal y cabeza al frente.
    pb.ellipse(22, 17, 12, 5, O); pb.ellipse(22, 17, 11, 4, K); pb.ellipse(20, 15, 6, 1, k);
    pb.ellipse(9, 15, 6, 5, O); pb.ellipse(9, 15, 5, 4, K); pb.ellipse(8, 13, 3, 1, k);
    ears(9, 10, 1);
    eyes(6, 15);
    pb.rect(4, 18, 4, 1, O);
    // Cola extendida con aletas.
    tube(curve([33, 17], [38, 17], [42, 21]), 2, 1);
    pb.poly([[41, 20], [44, 17], [44, 24]], O); pb.poly([[42, 20], [44, 18], [44, 23]], R);
    pb.poly([[40, 21], [37, 24], [43, 24]], O); pb.poly([[40, 22], [38, 24], [42, 24]], K);
    // Alas grandes: arriba o abajo.
    const wing: Pt[] = up ? [[15, 14], [7, 1], [21, 0], [33, 3], [27, 14]] : [[15, 19], [8, 29], [22, 29], [34, 26], [27, 19]];
    pb.poly(wing, O);
    pb.poly(wing.map(([x, y]) => [x + (x < 20 ? 1 : -1), y + (up ? 1 : -1)] as Pt), W);
    for (const tip of wing.slice(1, 4)) {
      for (let t = 0; t <= 1; t += 0.06) pb.set(Math.round(21 + (tip[0] - 21) * t), Math.round((up ? 14 : 19) + (tip[1] - (up ? 14 : 19)) * t), O);
    }
    pb.poly([[17, up ? 13 : 20], [12, up ? 6 : 26], [20, up ? 5 : 27]], w);
    // Patas recogidas.
    pb.ellipse(16, 21, 3, 1, O); pb.ellipse(27, 21, 3, 1, O); pb.ellipse(16, 21, 2, 1, K); pb.ellipse(27, 21, 2, 1, K);
  }
  return pb.toCanvas();
}

// Nubes de tormenta en la capa media, colocadas para quedar sobre el tramo
// de la tormenta cuando la cámara pasa por ahí (parallax 0.45).
function paintStormClouds(pb: PixelBuffer, rng: Rng): void {
  const x0 = VW / 2 + PAR_MID * (STORM.x0 - VW / 2) - 60, x1 = VW / 2 + PAR_MID * (STORM.x1 - VW / 2) + 60;
  for (let i = 0; i < 90; i++) {
    const x = rng.range(x0, x1), y = rng.range(-10, 46);
    const edge = Math.min(1, Math.min(x - x0, x1 - x) / 90);
    if (rng.next() > edge + 0.1) continue;
    const r = 10 + rng.int(18);
    pb.circle(x, y, r, hex(rng.pick(['#2c2840', '#332e4a', '#3a3550']), 235));
    pb.circle(x - 3, y - 4, Math.max(2, r - 6), hex('#4a4463', 150));
  }
  for (let i = 0; i < 300; i++) pb.set(Math.round(rng.range(x0, x1)), rng.int(56), hex(rng.pick(['#3a3550', '#26223a']), 120));
}

// Charcos en el tramo de la tormenta.
function paintPuddles(pb: PixelBuffer, rng: Rng): void {
  for (let i = 0; i < 16; i++) {
    const x = rng.range(STORM.x0 + 20, STORM.x1 - 20), y = rng.range(HORIZON + 4, VH - 3);
    const rx = 5 + rng.int(9);
    pb.ellipse(x, y, rx, 1 + rng.int(2), [150, 160, 205, 95]);
    pb.hline(x - rx + 2, x + rx - 4, y - 1, [200, 210, 240, 70]);
  }
}

// Árbol muerto, de pie: tronco seco y ramas peladas (un problema esperando).
function renderDeadTree(rng: Rng): HTMLCanvasElement {
  const pb = new PixelBuffer(30, 48);
  const dark = hex('#3f3430'), bark = hex('#5a4a44'), light = hex('#6f5c55');
  pb.ellipse(15, 46, 8, 2, hex(C.shadow, 70));
  for (let y = 45; y >= 14; y--) {
    const t = (45 - y) / 31;
    const half = Math.round(3 - 1.6 * t);
    const cx = 15 + Math.round(Math.sin(t * 3) * 1.5);
    pb.hline(cx - half - 1, cx + half + 1, y, dark); pb.hline(cx - half, cx + half - 1, y, bark); pb.set(cx - half, y, light);
  }
  const branches: [Pt, Pt][] = [[[14, 30], [3, 16]], [[16, 24], [27, 10]], [[15, 18], [9, 4]], [[15, 22], [22, 20]], [[14, 36], [5, 34]]];
  for (const [a, b] of branches) {
    for (let t = 0; t <= 1; t += 0.05) {
      const x = Math.round(a[0] + (b[0] - a[0]) * t), y = Math.round(a[1] + (b[1] - a[1]) * t);
      pb.rect(x - 1, y, t < 0.5 ? 2 : 1, 2, dark); if (t < 0.6) pb.set(x, y, bark);
    }
    if (rng.next() < 0.7) { pb.set(b[0] + 1, b[1] - 2, dark); pb.set(b[0] - 2, b[1] - 1, dark); }
  }
  return pb.toCanvas();
}

// Tronco caído cruzando la vereda (de arriba abajo). Con menos vida, más astillado.
function renderFallenTrunk(rng: Rng, hp: number): HTMLCanvasElement {
  const pb = new PixelBuffer(18, 38);
  const dark = hex('#3f3430'), bark = hex('#5a4a44'), light = hex('#6f5c55'), pale = hex('#8a746a');
  pb.ellipse(9, 36, 8, 2, hex(C.shadow, 80));
  for (let y = 2; y < 36; y++) {
    const half = 4 + (y < 8 ? 1 : 0);
    pb.hline(9 - half - 1, 9 + half + 1, y, dark); pb.hline(9 - half, 9 + half, y, bark);
    if (y % 5 === 0) pb.hline(9 - half, 9 + half - 2, y, light);
  }
  pb.ellipse(9, 2, 6, 2, dark); pb.ellipse(9, 2, 4, 1, pale); pb.rect(9, 2, 1, 1, dark); // corte de la raíz
  for (const [y, dir] of [[10, -1], [19, 1], [27, -1]] as Pt[]) { pb.rect(dir < 0 ? 1 : 13, y, 4, 2, dark); pb.rect(dir < 0 ? 2 : 13, y, 3, 1, bark); }
  for (let i = 0; i < (3 - hp) * 7; i++) {
    const x = 5 + rng.int(9), y = 4 + rng.int(30);
    pb.set(x, y, pale); pb.set(x + 1, y + 1, hex('#b39c8e'));
  }
  if (hp === 1) for (let y = 8; y < 30; y += 2) pb.set(9 + (y % 4 === 0 ? 1 : 0), y, hex('#b39c8e'));
  return pb.toCanvas();
}

// Autopista en perspectiva, ancha y con curva suave hacia el fondo: asfalto,
// cuatro carriles, guardarraíl, farolas a ambos lados y paso de cebra.
function paintHighway(pb: PixelBuffer, rng: Rng): void {
  const { vanishY, nearY } = ROAD;
  const asphalt = hex('#3b3b46'), asphaltL = hex('#474752'), white = hex('#e6e2d8'), yellow = hex('#d8c26a'), rail = hex('#9a9aa6'), post = hex('#6a6a76');
  // Calzada: se rellena por franjas horizontales siguiendo la curva.
  for (let y = vanishY; y <= nearY; y++) {
    const t = (y - vanishY) / (nearY - vanishY);
    pb.hline(roadX(t, -1), roadX(t, 1), y, asphalt);
  }
  for (let i = 0; i < 900; i++) { const t = Math.sqrt(rng.next()); pb.set(Math.round(roadX(t, rng.range(-1, 1))), Math.round(roadY(t)), asphaltL); }
  // Arcenes de grava a los lados.
  for (let y = vanishY + 6; y <= nearY; y++) {
    const t = (y - vanishY) / (nearY - vanishY), w = Math.round(2 + 5 * t);
    pb.hline(roadX(t, -1) - w, roadX(t, -1) - 1, y, hex('#6d6a66')); pb.hline(roadX(t, 1) + 1, roadX(t, 1) + w, y, hex('#6d6a66'));
  }
  // Líneas: bordes blancos, divisores discontinuos, central amarilla doble.
  for (let y = vanishY + 2; y <= nearY; y++) {
    const t = (y - vanishY) / (nearY - vanishY);
    pb.set(Math.round(roadX(t, -1)) + 1, y, white); pb.set(Math.round(roadX(t, 1)) - 1, y, white);
    const dash = Math.floor(t * t * 40) % 2 === 0;
    if (dash) { pb.set(Math.round(roadX(t, -0.5)), y, white); pb.set(Math.round(roadX(t, 0.5)), y, white); }
    const cx = roadX(t, 0);
    if (t > 0.5) { pb.set(Math.round(cx) - 1, y, yellow); pb.set(Math.round(cx) + 1, y, yellow); } else pb.set(Math.round(cx), y, yellow);
  }
  // Guardarraíl: postes que crecen al acercarse.
  for (let t = 0.08; t <= 1; t += 0.055) {
    const y = Math.round(roadY(t)), h = Math.max(2, Math.round(8 * roadS(t))), s = roadS(t), w = Math.round(2 + 5 * t);
    for (const side of [-1, 1]) {
      const x = Math.round(roadX(t, side)) + side * (w + 2);
      pb.rect(x, y - h, 1, h, post); pb.rect(x - 1, y - h, 3, Math.max(1, Math.round(s)), rail);
    }
  }
  // Farolas altas a ambos lados, con el brazo sobre la calzada.
  for (const t of ROAD_LAMPS) {
    const s = roadS(t), y = Math.round(roadY(t)), h = Math.round(20 * s) + 6, arm = Math.round(6 * s) + 2, w = Math.round(2 + 5 * t);
    for (const side of [-1, 1]) {
      const x = Math.round(roadX(t, side)) + side * (w + 4);
      pb.rect(x, y - h, Math.max(1, Math.round(s)), h, hex('#5a5560'));
      pb.rect(side < 0 ? x : x - arm, y - h, arm + 1, 1, hex('#5a5560'));
      pb.rect(side < 0 ? x + arm - 1 : x - arm, y - h, 2, 2, hex(C.lampLight));
    }
  }
  // Paso de cebra: barras horizontales a lo ancho, a la altura de la vereda.
  for (const y of [168, 172, 176]) {
    const t = (y - vanishY) / (nearY - vanishY);
    pb.rect(Math.round(roadX(t, -1)) + 3, y, Math.round(roadX(t, 1)) - Math.round(roadX(t, -1)) - 6, 2, [230, 226, 216, 170]);
  }
  // Bordillos donde la vereda llega a la calzada.
  for (const side of [-1, 1]) {
    const t0 = (150 - vanishY) / (nearY - vanishY);
    for (let y = 150; y < 182; y++) { const t = (y - vanishY) / (nearY - vanishY); pb.set(Math.round(roadX(t, side)) + side * (Math.round(2 + 5 * t) + 1), y, hex(C.curb)); }
    void t0;
  }
}

// Auto visto de frente (faros) o de atrás (luces rojas), 20×11.
function renderCar(front: boolean, color: string): HTMLCanvasElement {
  const pb = new PixelBuffer(20, 11);
  const body = hex(color), dark = hex('#1e1c26'), glass = hex('#2a2f45'), chrome = hex('#b9bcc6');
  pb.rect(4, 0, 12, 4, dark); pb.rect(5, 1, 10, 3, glass);
  if (!front) pb.rect(6, 1, 8, 1, hex('#4a5270'));
  pb.rect(0, 4, 20, 6, dark); pb.rect(1, 4, 18, 5, body);
  pb.rect(2, 4, 16, 1, mix(color, '#ffffff', 0.35));
  if (front) { pb.rect(2, 6, 3, 2, hex('#fff6d6')); pb.rect(15, 6, 3, 2, hex('#fff6d6')); pb.rect(7, 7, 6, 1, dark); pb.rect(8, 6, 4, 1, chrome); }
  else { pb.rect(2, 6, 3, 2, hex('#ff5a5a')); pb.rect(15, 6, 3, 2, hex('#ff5a5a')); pb.rect(8, 7, 4, 1, hex('#e6e2d8')); }
  pb.rect(0, 9, 20, 1, chrome);
  pb.rect(1, 10, 4, 1, dark); pb.rect(15, 10, 4, 1, dark);
  return pb.toCanvas();
}

// Kiosco rojo con toldo a rayas: refugio de los rayos.
function renderKiosk(): HTMLCanvasElement {
  const pb = new PixelBuffer(44, 48);
  const red = hex('#c8443f'), redDark = hex('#8f2f2c'), cream = hex('#f6efe2'), wood = hex('#6b4e3d'), dark = hex('#3b2a33');
  pb.ellipse(22, 46, 20, 2, hex(C.shadow, 70));
  // Cuerpo.
  pb.rect(6, 16, 32, 30, dark); pb.rect(7, 17, 30, 29, red); pb.rect(33, 17, 4, 29, redDark);
  pb.rect(7, 40, 30, 6, redDark); // zócalo
  // Mostrador y ventana con luz.
  pb.rect(10, 20, 18, 12, dark); pb.rect(11, 21, 16, 10, hex('#ffe3a6')); pb.rect(11, 21, 16, 3, hex('#fff1c8'));
  pb.rect(9, 32, 20, 3, wood); pb.rect(9, 32, 20, 1, hex('#8a6a54'));
  pb.rect(14, 24, 3, 5, hex('#b8865b')); pb.rect(20, 25, 4, 4, hex('#7fbb79')); // cosas en la ventana
  // Puerta lateral.
  pb.rect(30, 24, 5, 16, dark); pb.rect(31, 25, 3, 15, wood); pb.set(32, 32, hex(C.flowerCenter));
  // Toldo a rayas, con su sombra.
  pb.rect(2, 12, 40, 2, dark);
  for (let x = 0; x < 44; x++) pb.rect(x, 9, 1, 5, ((x / 4) | 0) % 2 === 0 ? red : cream);
  pb.rect(0, 8, 44, 1, dark); pb.rect(0, 14, 44, 1, redDark);
  for (let x = 0; x < 44; x += 4) pb.rect(x + 1, 15, 2, 1, ((x / 4) | 0) % 2 === 0 ? red : cream);
  // Techito y letrero.
  pb.rect(8, 3, 28, 6, dark); pb.rect(9, 4, 26, 4, cream); pb.rect(11, 5, 22, 2, redDark);
  pb.rect(16, 0, 12, 3, dark); pb.rect(17, 1, 10, 2, red);
  return pb.toCanvas();
}

// Flor de lila en el suelo, con tallo, esperando que la recojan.
function renderFlowerItem(): HTMLCanvasElement {
  const pb = new PixelBuffer(11, 14);
  pb.ellipse(5, 12, 4, 1, hex(C.shadow, 60));
  pb.rect(5, 6, 1, 6, hex(C.leafDark)); pb.rect(3, 9, 2, 1, hex(C.leaf)); pb.rect(6, 8, 2, 1, hex(C.leaf));
  pb.circle(5, 4, 3, hex(C.lilacDeep));
  for (const [x, y] of [[3, 3], [7, 3], [5, 1], [5, 5], [4, 6], [7, 6]] as Pt[]) { pb.set(x, y, hex(C.lilacLight)); pb.set(x + 1, y, hex(C.lilac)); pb.set(x, y + 1, hex(C.lilac)); pb.set(x - 1, y, hex(C.lilacPale)); pb.set(x, y - 1, hex(C.lilacPale)); }
  pb.set(5, 3, hex(C.flowerCenter)); pb.set(4, 5, hex(C.flowerCenter));
  return pb.toCanvas();
}

// La misma flor, chiquita, para llevarla en la mano.
function renderCarriedFlower(): PixelBuffer {
  const pb = new PixelBuffer(5, 6);
  pb.rect(2, 3, 1, 3, hex(C.leafDark));
  pb.set(2, 0, hex(C.lilacLight)); pb.set(1, 1, hex(C.lilac)); pb.set(3, 1, hex(C.lilac)); pb.set(2, 1, hex(C.lilacPale));
  pb.set(0, 2, hex(C.lilacLight)); pb.set(4, 2, hex(C.lilacLight)); pb.set(1, 2, hex(C.lilacDeep)); pb.set(3, 2, hex(C.lilacDeep)); pb.set(2, 2, hex(C.flowerCenter));
  return pb;
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
