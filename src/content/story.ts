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

  // El final. La palabra del centro de la hoja, y la carta: un párrafo por
  // elemento; Grecia camina por la hoja y van apareciendo a su paso. El
  // último párrafo es la firma.
  plantWord: 'plantar',
  letter: [
    '(Aquí empieza la carta. Jhammil la escribe hoy; cada elemento de esta lista es un párrafo.)',
    '(Segundo párrafo de ejemplo. Puede ser largo: la caja se ajusta.)',
    '(Tercer párrafo de ejemplo.)',
    'Te amo mucho mucho, Grecia.\n— Jhammil',
  ],
};
