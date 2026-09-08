// Personajes y textos del paseo. Aquí es donde se editan los nombres y frases.
// Cada elemento de `lines` es una caja de diálogo; los saltos de línea se respetan.
export const story = {
  herName: 'Grecia',
  himName: 'Jhammil',
  dragonName: 'Chimuelo',

  // En la banca, al sentarse con él.
  benchTalk: {
    who: 'Jhammil',
    lines: [
      'Quiero un futuro contigo.\nQue se sienta real y único.',
      'Quiero quedarme\naunque el cielo se caiga.\nNo importan las caídas que tengamos.',
      'Quiero aprender de ti.\nDe tu templanza,\nde tu enojo,\ndel sonido de tu corazón.',
      'No quiero soltar tu mano.\nSé que no soy perfecto, tendré mis errores,\ny me disculpo por eso.',
      'Pero soy alguien\nque te elegirá cada día.',
      '¿Vamos? Te sigo a donde vayas.',
    ],
  },

  // En el verde, donde Jhammil la deja seguir sola.
  farewellTalk: {
    who: 'Jhammil',
    lines: [
      'No siempre voy a estar a tu lado.\nPero te acompaño a donde vayas.',
      'Sigue. Yo te miro desde aquí.',
    ],
  },
};
