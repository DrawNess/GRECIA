import { sprite } from '../engine/pixels';
import { C } from './palette';

// Grecia de espaldas, delgada: cabello con partidura, dos trenzas cortas
// hasta los hombros con lazos lila, vestido beige formal.
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
  '..ODHDDDHDO.',
  '..ODkDDDkDO.',
  '..ODRDDDRDO.',
  '..ODrDdDrDO.',
  '..ODDDDDDDO.',
  '..ODDDdDDDO.',
  '..OSDDDDDSO.',
  '..OSDDdDDSO.',
  '..ODdDDDdDO.',
  '.ODddDdDddDO',
  '.OeddDdDddeO',
  '..OOOOOOOOO.',
  '...OBB.BBO..',
  '...OOO.OOO..',
];

// Segundo cuadro de reposo: los lazos de las trenzas se mueven un píxel.
const GRECIA_B = GRECIA_A.map((row, i) => {
  if (i === 11) return '..ODrDDDrDO.';
  if (i === 12) return '..ODRDdDRDO.';
  return row;
});

// De frente: flequillo, ojos, trenzas cayendo por delante de los hombros.
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
  '..OkDDDDDkO.',
  '..OHDDDDDHO.',
  '..ORDDdDDRO.',
  '..OrDDDDDrO.',
  '..ODDDdDDDO.',
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

// De perfil mirando a la derecha: una trenza a la vista sobre la espalda.
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
  '..OkODDDDO..',
  '..OkODDDDO..',
  '..ORODDDDO..',
  '..OrODDdDO..',
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

// Ciclo de caminata: dos cuadros (piernas abiertas / juntas) sobre el mismo cuerpo.
const withLegs = (base: string[], legs: [string, string]) => {
  const r = base.slice();
  r[21] = legs[0]; r[22] = legs[1];
  return r;
};
const LEGS_APART: [string, string] = ['..OBB...BBO.', '..OOO...OOO.'];
const LEGS_MID: [string, string] = ['....OBBBO...', '....OOOOO...'];
const SIDE_APART: [string, string] = ['...OBB..BBO.', '...OOO..OOO.'];
const SIDE_MID: [string, string] = ['.....OBBO...', '.....OOOO...'];

const mk = (rows: string[]) => sprite(rows, GRECIA_PAL);

export interface DirSprites { idle: ReturnType<typeof sprite>[]; walk: ReturnType<typeof sprite>[] }
export const GRECIA: { back: DirSprites; front: DirSprites; side: DirSprites } = {
  back: { idle: [mk(GRECIA_A), mk(GRECIA_B)], walk: [mk(withLegs(GRECIA_A, LEGS_APART)), mk(withLegs(GRECIA_A, LEGS_MID))] },
  front: { idle: [mk(GRECIA_F)], walk: [mk(withLegs(GRECIA_F, LEGS_APART)), mk(withLegs(GRECIA_F, LEGS_MID))] },
  side: { idle: [mk(GRECIA_S)], walk: [mk(withLegs(GRECIA_S, SIDE_APART)), mk(withLegs(GRECIA_S, SIDE_MID))] },
};
export const GRECIA_FRAMES = GRECIA.back.idle;

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
