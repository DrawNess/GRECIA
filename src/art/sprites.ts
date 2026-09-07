import { sprite } from '../engine/pixels';
import { C } from './palette';

// Grecia vista desde arriba y de espaldas: cabello castaño con partidura,
// trenza cayendo por la espalda con un lazo lila, vestido beige formal.
const GRECIA_PAL = {
  O: C.outline, H: C.hair, h: C.hairLight, k: C.hairDark,
  S: C.skin, s: C.skinShade, D: C.dress, d: C.dressShade, e: C.dressDeep,
  W: C.white, R: C.ribbon, r: C.ribbonDark, B: C.shoe,
};

const GRECIA_A = [
  '.......OOOO.......',
  '.....OOhhhhOO.....',
  '....OhhHHHHhhO....',
  '...OhHHHkHHHHhO...',
  '...OHHHHkHHHHHO...',
  '..OHHHHHkHHHHHHO..',
  '..OHHHHHkHHHHHHO..',
  '..OHHHHHHHHHHHHO..',
  '..OkHHHHHHHHHHkO..',
  '...OkHHHHHHRHkO...',
  '....OkkHHHHkkO....',
  '.....OWkHHkWO.....',
  '...OODDWkHkWDDOO..',
  '..ODDDDDdHhdDDDDO.',
  '.ODDDDDDDkHkDDDDDO',
  '.ODDDDDDDhHhDDDDDO',
  '.ODdDDDDDkHkDDDdDO',
  '.ODdDDDDDhHhDDDdDO',
  '.OSdDDDDDkHkDDDdSO',
  '.OSdDDDDDhHhDDDdSO',
  '..OdDDDDDkHkDDDdO.',
  '..OdDDDDrRRrDDDdO.',
  '..OddDDDDRRDDDddO.',
  '..OeddDDDDDDDddeO.',
  '..OeeddDDDDDddeeO.',
  '...OOOOOOOOOOOOO..',
  '.....OBBO..OBBO...',
  '......OO....OO....',
];

// Segundo cuadro: el lazo de la trenza se mueve un píxel (respiración).
const GRECIA_B = GRECIA_A.map((row, i) => {
  if (i === 21) return '..OdDDDDDrRRrDDdO.';
  if (i === 22) return '..OddDDDDDRRDDddO.';
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
  { P: C.lilac, Y: C.lilacPale, L: C.leaf },
);
