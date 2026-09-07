import { sprite } from '../engine/pixels';
import { C } from './palette';

// Grecia de espaldas, delgada: cabello con partidura, dos trencitas cortas
// a la altura de los hombros con lazos lila, vestido beige formal.
const GRECIA_PAL = {
  O: C.outline, H: C.hair, h: C.hairLight, k: C.hairDark,
  S: C.skin, s: C.skinShade, D: C.dress, d: C.dressShade, e: C.dressDeep,
  W: C.white, R: C.ribbon, r: C.ribbonDark, B: C.shoe,
};

const GRECIA_A = [
  '....OOOO....',
  '...OhhkhhO..',
  '..OhHHkHHhO.',
  '..OHHHkHHHO.',
  '..OHHHkHHHO.',
  '..OHHHHHHHO.',
  '..OkHHHHHkO.',
  '...OkHHHkO..',
  '...OHWWWHO..',
  '..ODRDDDRDO.',
  '..ODrDdDrDO.',
  '..ODDDDDDDO.',
  '..ODDDdDDDO.',
  '..ODDDDDDDO.',
  '..OSDDDDDSO.',
  '..OSDDdDDSO.',
  '..ODDDDDDDO.',
  '..ODdDDDdDO.',
  '.ODddDdDddDO',
  '.OeddDdDddeO',
  '..OOOOOOOOO.',
  '...OBB.BBO..',
  '...OOO.OOO..',
];

// De frente: flequillo, ojos, trencitas cayendo por delante de los hombros.
const GRECIA_F = [
  '....OOOO....',
  '...OhhhhO...',
  '..OhHHHHhO..',
  '..OHhSSShHO.',
  '..OHSSSSSHO.',
  '..OHSOSOSHO.',
  '..OHSSSSSHO.',
  '..OkSSsSSkO.',
  '..OkOWWWOkO.',
  '..ORDDDDDRO.',
  '..OrDDdDDrO.',
  '..ODDDDDDDO.',
  '..ODDDdDDDO.',
  '..ODDDDDDDO.',
  '..OSDDDDDSO.',
  '..OSDDdDDSO.',
  '..ODDDDDDDO.',
  '..ODdDDDdDO.',
  '.ODddDdDddDO',
  '.OeddDdDddeO',
  '..OOOOOOOOO.',
  '...OBB.BBO..',
  '...OOO.OOO..',
];

// De perfil mirando a la derecha: una trencita a la vista sobre la espalda.
const GRECIA_S = [
  '....OOOO....',
  '...OhhhhO...',
  '..OhHHHHhO..',
  '..OHHHHSSO..',
  '..OHHHSSSO..',
  '..OHHHSOSO..',
  '..OkHHSSSO..',
  '..OkkHSSsO..',
  '..OkOWWWO...',
  '..ORODDDDO..',
  '..OrODDDDO..',
  '...ODDDDDO..',
  '...ODDDdDO..',
  '...ODDDdDO..',
  '...ODSDdDO..',
  '...ODSDdDO..',
  '...ODDDdDO..',
  '...ODdDdDO..',
  '..OddDDdDDO.',
  '..OeddDdddO.',
  '...OOOOOOO..',
  '....OBBBO...',
  '....OOOOO...',
];

// ── Animación ──
// Cambia un píxel (fila, columna) de un dibujo.
const put = (rows: string[], r: number, c: number, ch: string) => {
  rows[r] = rows[r].slice(0, c) + ch + rows[r].slice(c + 1);
};
const setLegs = (rows: string[], legs: [string, string]) => { rows[21] = legs[0]; rows[22] = legs[1]; };
// Los lazos de las trenzas se mecen: se intercambian las dos filas del lazo.
const swayRibbons = (rows: string[], r0: number) => { const a = rows[r0]; rows[r0] = rows[r0 + 1].replace(/R/g, '#').replace(/r/g, 'R').replace(/#/g, 'r'); rows[r0 + 1] = a.replace(/R/g, '#').replace(/r/g, 'R').replace(/#/g, 'r'); };

const LEGS_APART: [string, string] = ['..OBB...BBO.', '..OOO...OOO.'];
const LEGS_MID: [string, string] = ['....OBBBO...', '....OOOOO...'];
const SIDE_APART: [string, string] = ['...OBB..BBO.', '...OOO..OOO.'];
const SIDE_MID: [string, string] = ['.....OBBO...', '.....OOOO...'];

// Brazos de frente/espaldas (manos en columnas 3 y 9, filas 14–15):
// en cada paso un brazo sube y el otro baja.
const armsFB = (rows: string[], step: number) => {
  const up = step === 0 ? 3 : 9, down = step === 0 ? 9 : 3;
  put(rows, 13, up, 'S'); put(rows, 15, up, 'D');
  put(rows, 14, down, 'D'); put(rows, 16, down, 'S');
};
// Brazo de perfil (columna 5, filas 14–15): adelante o atrás.
const armSide = (rows: string[], step: number) => {
  put(rows, 14, 5, 'D'); put(rows, 15, 5, 'D');
  const c = step === 0 ? 7 : 4;
  put(rows, 14, c, 'S'); put(rows, 15, c, 'S');
};

// Ciclo de 4 cuadros: paso · pies juntos (rebote) · paso · pies juntos (rebote).
function walkCycle(base: string[], apart: [string, string], mid: [string, string], arms: (rows: string[], step: number) => void, ribbonRow: number): string[][] {
  const f0 = base.slice(); setLegs(f0, apart); arms(f0, 0);
  const f1 = base.slice(); setLegs(f1, mid); swayRibbons(f1, ribbonRow);
  const f2 = base.slice(); setLegs(f2, apart); arms(f2, 1);
  const f3 = base.slice(); setLegs(f3, mid); swayRibbons(f3, ribbonRow);
  return [f0, f1, f2, f3];
}

const mk = (rows: string[]) => sprite(rows, GRECIA_PAL);
const idleB = (rows: string[], ribbonRow: number) => { const r = rows.slice(); swayRibbons(r, ribbonRow); return r; };

export interface DirSprites { idle: ReturnType<typeof sprite>[]; walk: ReturnType<typeof sprite>[] }
export const GRECIA: { back: DirSprites; front: DirSprites; side: DirSprites } = {
  back: { idle: [mk(GRECIA_A), mk(idleB(GRECIA_A, 9))], walk: walkCycle(GRECIA_A, LEGS_APART, LEGS_MID, armsFB, 9).map(mk) },
  front: { idle: [mk(GRECIA_F), mk(idleB(GRECIA_F, 9))], walk: walkCycle(GRECIA_F, LEGS_APART, LEGS_MID, armsFB, 9).map(mk) },
  side: { idle: [mk(GRECIA_S), mk(idleB(GRECIA_S, 9))], walk: walkCycle(GRECIA_S, SIDE_APART, SIDE_MID, armSide, 9).map(mk) },
};
export const GRECIA_FRAMES = GRECIA.back.idle;

// Grecia sentada mirando a la derecha (en la banca, hacia él).
const GRECIA_SIT = [
  '....OOOO....',
  '...OhhhhO...',
  '..OhHHHHhO..',
  '..OHHHHSSO..',
  '..OHHHSSSO..',
  '..OHHHSOSO..',
  '..OkHHSSSO..',
  '..OkkHSSsO..',
  '..OkOWWWO...',
  '..ORODDDDO..',
  '..OrODDDDO..',
  '...ODDDDDO..',
  '...ODDDdDO..',
  '...ODDSSDO..',
  '...ODDSSDO..',
  '...ODDDDDDO.',
  '..ODDDDDDDDO',
  '..OddDDDdddO',
  '..OOOOOOSSO.',
  '........OSSO',
  '........OSSO',
  '........OSSO',
  '........OSSO',
  '........OSSO',
  '........OBBO',
  '........OOOO',
];
export const GRECIA_SEATED = mk(GRECIA_SIT);

// Jhammil, sentado mirando a la izquierda (hacia ella): cabello corto, camisa
// blanca. Un poco más alto que Grecia.
const JHAMMIL_PAL = {
  O: C.outline, k: C.jhHair, S: C.skin, s: C.skinShade,
  W: C.jhShirt, w: C.jhShirtShade, P: C.jhPants, B: C.jhShoe,
};
const JHAMMIL_SIT = [
  '....OOOO....',
  '...OkkkkO...',
  '..OkkkkkkO..',
  '..OSSSkkkO..',
  '..OSSSSkkO..',
  '..OSOSSkkO..',
  '..OSSSSkkO..',
  '..OsSSSSsO..',
  '...OSSOO....',
  '..OWWWWWWO..',
  '.OWWWwWWWWO.',
  '.OWWWwWWWWO.',
  '.OWwWwWWwWO.',
  '.OWwWWWWwWO.',
  '.OSwWWWWwWO.',
  '.OPPPPwWWWO.',
  'OPPPPPPPPPO.',
  'OPPOOOOOOO..',
  'OPPO........',
  'OPPO........',
  'OPPO........',
  'OPPO........',
  'OPPO........',
  'OBBBO.......',
  'OBBBO.......',
  'OOOOO.......',
];
export const JHAMMIL_SEATED = sprite(JHAMMIL_SIT, JHAMMIL_PAL);

// Ramita de lila (ícono del menú y favicon).
export const SPRIG = sprite(
  [
    '.....P......',
    '....PYP.....',
    '...P.P.P....',
    '..PYP.PYP...',
    '...P.P.P....',
    '..P.PYP.P...',
    '.PYP.P.PYP..',
    '..P.L.L.P...',
    '....LLL.....',
    '.....L......',
    '.....L......',
    '.....L......',
  ],
  { P: C.lilacMid, Y: C.lilacPale, L: C.leaf },
);
