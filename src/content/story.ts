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

  // LA BANCA. Al sentarse con él empieza la conversación. Es un árbol de
  // nodos: cada nodo tiene sus cajas (`lines`, máquina de escribir; J o Enter
  // pasa a la siguiente) y después, o bien `choices` (respuestas que Grecia
  // elige con ↑↓ y confirma con J; `say` es lo que dice ella, `go` el nodo al
  // que sigue) o bien `go` (salta directo a otro nodo). Un nodo sin `choices`
  // ni `go` termina la charla: se paran y él la acompaña de la mano.
  // Si un nodo no dice `who`, habla Jhammil (`himName`).
  benchTalk: {
    start: 'hola',
    nodes: {
      hola: {
        lines: [
          'Hola, Grecia.\n¿Por qué tan solita?',
          'Te estaba esperando.',
          '¿Hablamos?',
        ],
        choices: [
          { say: 'Sí.', go: 'lugar' },
          { say: 'Bueno… hablemos.', go: 'lugar' },
        ],
      },
      lugar: {
        lines: [
          'Me gusta este lugar.\nCuántas veces nos quedamos aquí\nhasta que se hacía tarde.',
          'Hay algo que nunca te dije bien,\ny hoy quiero decírtelo despacio.',
        ],
        go: 'poema',
      },
      poema: {
        lines: [
          'Quiero un futuro contigo.\nQue se sienta real y único.',
          'Quiero quedarme\naunque el cielo se caiga.\nNo importan las caídas que tengamos.',
          'Quiero aprender de ti.\nDe tu templanza,\nde tu enojo,\ndel sonido de tu corazón.',
          'No quiero soltar tu mano.\nSé que no soy perfecto, tendré mis errores,\ny me disculpo por eso.',
          'Pero soy alguien\nque te elegirá cada día.',
        ],
        choices: [
          { say: '¿Y si vuelve a llover?', go: 'lluvia' },
          { say: 'Yo también te elijo.', go: 'elijo' },
          { say: 'No digas nada más. Ven.', go: 'ven' },
        ],
      },
      lluvia: {
        lines: ['Entonces me mojo contigo.\nYa pasamos una tormenta hoy, ¿no?'],
        go: 'vamos',
      },
      elijo: {
        lines: ['Cada día.\nHasta que el cielo se caiga,\ny después también.'],
        go: 'vamos',
      },
      ven: {
        lines: ['Ya voy.'],
        go: 'vamos',
      },
      vamos: {
        lines: ['¿Vamos? Te sigo a donde vayas.'],
      },
    },
  },

  // LA DESPEDIDA. En el verde, donde él se detiene y la deja seguir sola.
  // Misma forma que la banca (árbol de nodos). Aquí empieza hablando ella
  // (`who: 'Grecia'`); los nodos sin `who` son de Jhammil.
  farewellTalk: {
    start: 'pregunta',
    nodes: {
      pregunta: {
        who: 'Grecia',
        lines: ['Jhammil… ¿qué pasa?'],
        go: 'mirarte',
      },
      mirarte: {
        lines: [
          'Quería mirarte un momento.\nAsí, con esta luz.',
          'Tú siempre sabes a dónde vas.\nNunca has necesitado\nque nadie te lleve de la mano.',
          'Por eso no te voy a llevar.\nTe voy a acompañar,\nque es distinto.',
        ],
        choices: [
          { say: '¿Y si me voy lejos?', go: 'lejos' },
          { say: '¿Me lo prometes?', go: 'promesa' },
        ],
      },
      lejos: {
        lines: ['Entonces te espero.\nVayas a donde vayas,\ntómate el tiempo que quieras.\nYo voy a estar donde me dejaste.'],
        go: 've',
      },
      promesa: {
        lines: ['Te lo prometo.\nVayas a donde vayas, yo estoy detrás de ti,\ny te espero donde me dejaste.'],
        go: 've',
      },
      ve: {
        lines: ['Ahora ve.\nYo te sigo con la mirada.'],
        choices: [
          { say: 'Vuelvo por ti.', go: 'siempre' },
          { say: 'Espérame.', go: 'siempre' },
        ],
      },
      siempre: {
        lines: ['Siempre.'],
      },
    },
  },

  // LAS PALABRAS. El tramo de madrugada después de la autopista: van de la
  // mano y cada tanto una palabra o una frase aparece entre los dos; ella la
  // escribe con el teclado antes de que se apague. Se aceptan sin tilde. `bad` = una de
  // las difíciles (al decirla se deshace en cenizas que se lleva el viento;
  // las buenas florecen en corazones). El orden es el orden del camino.
  words: [
    { text: 'amor', bad: false },
    { text: 'vamos a ser mejores', bad: false },
    { text: 'mi cielo', bad: false },
    { text: 'días buenos', bad: false },
    { text: 'peleas', bad: true },
    { text: 'días malos', bad: true },
    { text: 'perdón', bad: false },
    { text: 'te elijo cada día', bad: false },
    { text: 'miedo', bad: true },
    { text: 'no me sueltes', bad: false },
    { text: 'inseguridades', bad: true },
    { text: 'las superamos juntos', bad: false },
    { text: 'paciencia', bad: false },
    { text: 'aprendamos juntos', bad: false },
    { text: 'te extraño', bad: false },
    { text: 'aunque el cielo se caiga', bad: false },
    { text: 'confianza', bad: false },
    { text: 'lo siento', bad: false },
    { text: 'hasta que se haga tarde', bad: false },
    { text: 'gracias', bad: false },
    { text: 'juntos', bad: false },
    { text: 'tu mano en la mía', bad: false },
    { text: 'siempre', bad: false },
    { text: 'te amo mucho mucho', bad: false },
  ],
  wordsTalk: {
    // La introducción: al llegar al tramo, antes de la primera palabra, él lo
    // explica en una charla corta (cada elemento es una caja; la última dice
    // cómo se juega).
    intro: [
      'Este camino es largo y oscuro.\nPero ya caminamos otros así, ¿no?',
      'Hay cosas que nos va a costar decir.\nAlgunas lindas, otras no tanto.\nPero se dicen.',
      'Cuando aparezca una, escríbela\nantes de que se apague.\nSi se apaga, no pasa nada:\nla decimos otra vez.',
    ],
    // Lo que dice Jhammil cuando una palabra se apaga antes de tiempo. La
    // primera vez, `failFirst`; después, una de `fail` al azar.
    failFirst: 'Tranquila. Letra por letra, otra vez.\nYo espero.',
    fail: [
      'No pasa nada. Respira, y de nuevo.',
      'Sin apuro. Estoy contigo.',
      'Aquí sigo. Vamos otra vez.',
      'Cuesta, pero se dice. Dale.',
    ],
    // Al terminar la última palabra, cuando empieza a clarear.
    done: '¿Ves? Se puede.',
    // Si llega al final sin la flor de lila.
    noFlower: 'Sin la flor no hay nada que plantar. Se quedó donde pasó la tormenta.',
  },

  // EL FINAL. La palabra en el centro de la hoja de pergamino (J la planta).
  plantWord: 'plantar',

  // LA CARTA. Un párrafo por elemento. Se muestran de a uno, grandes y
  // centrados como un poema, cuando Grecia llega a la altura de cada uno
  // (uno cada 250 px de caminata; ida y vuelta lo vuelve a mostrar).
  // Conviene que sean cortos (2–4 líneas). El último es la firma.
  letter: [
    '¡¡GRECIA!! ¡¡AMORRR!!\n¡HAS LLEGADO HASTA EL FINAL!',
    '¡AMOR! Lo sé, lo sé… un poco corto.\nUn poco de nuestra historia,\nalgo de lo que vivimos.',
    'ESTOS DÍAS HEMOS TENIDO MUCHOS PROBLEMAS.\nY aun así llegaste hasta acá.\nHa sido un camino difícil, mi vida.',
    'Y SÍ, VA A SER UN CAMINO DIFÍCIL.\nPero mira, lo caminaste.\nY yo estuve ahí. Y voy a estar.',
    '¡¡TE AMO!!\nSé que lo sabes.\nTambién sé que me amas.',
    'Pero ¿sabes? Quiero reforzar que lo sabes.\nY confirmarte que el amor que te tengo\nno ha cambiado.\nAl contrario, se ha fortalecido.',
    'Me he estado disculpando mucho\ndurante este tiempo\npor cosas que yo provoqué.\nPero siempre intento estar presente para ti.',
    'En esta carta quiero decirte\nTE AMO MUCHO MUCHO MUCHO.',
    'Y amor… me das más de lo que necesito.\nMucho más.',
    'No digas ni sientas\nque eres insuficiente.\nPORQUE NO LO ERES.',
    'TÚ ERES MÁS QUE SUFICIENTE.\nTÚ ERES CAPAZ.\nTÚ ERES LA MEJOR.',
    '¿SÍ, AMOR?',
    'Amor, me has mostrado tanto de ti.\nMe encantas.',
    'Tu forma de ser.\nTu forma de decir las cosas.\nCómo te abres con lo que sientes.',
    'Tus ojitos tan expresivos.\nAmo cuando te pones nerviosa.\nCómo amas tan bonito.',
    'Tu manera de comunicarte.\nAmo escucharte contarme cómo te fue.\nAmo verte feliz.',
    'Quiero que estés bien.\nQuiero que estés tranquila.',
    'Me acuerdo de las veces\nque se hacía tarde\ny seguíamos hablando.',
    'Las desveladas que nos dábamos\nsin darnos cuenta.',
    'Me acuerdo del primer beso.\nEstaba tan nervioso.',
    'Ese beso, ese momento,\nlo atesoro mucho.\nTodavía lo siento.',
    'No te pierdas a ti misma.\nY si lo haces,\nencuéntrate de nuevo.',
    'Amor, eres lo mejor.\nY créelo por ti misma,\nno porque yo lo diga.',
    'No te dejes vencer, por favor.',
    'Si me necesitas,\nyo voy a estar.\nSiempre disponible para ti.',
    'Te amo mucho mucho,\nGrecia.\n— Jhammil',
  ],
};
