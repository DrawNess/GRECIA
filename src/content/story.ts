// ═══════════════════════════════════════════════════════════════════════════
// TEXTOS DEL PASEO. Todo lo que dice el juego durante el recorrido está aquí.
// (Los del menú y las ayudas están en gate.ts.) Los saltos de línea (\n) se
// respetan tal cual en pantalla.
// ═══════════════════════════════════════════════════════════════════════════
export const story = {
  // Nombres. `himName` aparece en la etiqueta sobre él en la banca y como
  // quien habla en las cajas de diálogo. `dragonName`, sobre Chimuelo al despertar.
  herName: 'Grecia',
  himName: 'Jhammil',
  dragonName: 'Chimuelo',

  // LA BANCA. Al sentarse con él: cada elemento es una caja de diálogo
  // (máquina de escribir; J o Enter pasa a la siguiente). Al terminar se paran
  // y él la acompaña de la mano.
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

  // LA DESPEDIDA. En el verde de Santa Cruz, donde él la deja seguir sola.
  farewellTalk: {
    who: 'Jhammil',
    lines: [
      'No siempre voy a estar a tu lado.\nPero te acompaño a donde vayas.',
      'Sigue. Yo te miro desde aquí.',
    ],
  },

  // EL FINAL. La palabra en el centro de la hoja de pergamino (J la planta).
  plantWord: 'plantar',

  // LA CARTA. Un párrafo por elemento. Se muestran de a uno, grandes y
  // centrados como un poema, cuando Grecia llega a la altura de cada uno
  // (uno cada 250 px de caminata; ida y vuelta lo vuelve a mostrar).
  // Conviene que sean cortos (2–4 líneas). El último es la firma.
  letter: [
    'Aquí empieza la carta.\n(Jhammil la escribe hoy.)',
    'Cada elemento de esta lista\nes un párrafo corto.',
    'Aparecen uno a uno,\ncentrados, mientras ella camina.',
    'Te amo mucho mucho,\nGrecia.\n— Jhammil',
  ],
};
