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

// Segundo cuadro: los lazos de las trenzas se mueven un píxel.
const GRECIA_B = GRECIA_A.map((row, i) => {
  if (i === 11) return '..ODrDDDrDO.';
  if (i === 12) return '..ODRDdDRDO.';
  return row;
});

export const GRECIA_FRAMES = [sprite(GRECIA_A, GRECIA_PAL), sprite(GRECIA_B, GRECIA_PAL)];

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
