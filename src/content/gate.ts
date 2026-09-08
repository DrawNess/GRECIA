// Textos y respuestas de la puerta de entrada.
// Las respuestas se guardan como sha256 para que no queden en texto plano
// en el repositorio público. Para generar uno:  pnpm hash "TEXTO EXACTO"
export const gate = {
  title: 'Grecia',
  subtitle: 'un paseo entre lilas',
  subtitleAgain: 'otra vez, con calma',

  namePrompt: 'Escribe tu nombre completo',
  namePlaceholder: 'EN MAYÚSCULAS',
  nameHash: 'f4eb721fa9e04147b9710baf2841de340ca3a2035642fcfffb5b7fb9743821f3',
  msgWrongName: 'Mmm… ese no es tu nombre completo.',
  msgUppercase: 'Todo en MAYÚSCULAS, por favor.',

  datePrompt: '¿Y qué fecha es la nuestra?',
  datePlaceholder: 'DD/MM/AAAA',
  // Pendiente: sha256 de la fecha escrita como DD/MM/AAAA.
  // Mientras esté vacío, este paso se omite.
  dateHash: '',
  msgWrongDate: 'Esa no es la fecha…',

  enterHint: 'Enter ↵ para continuar',
  moveHint: 'Flechas para caminar · J para mirar de cerca',
  stormHint: 'Cuidado con los rayos y los árboles: si te alcanzan, vuelves al inicio · Shift para correr',
  breakHint: 'J para romper el tronco: con el marcador al centro, golpeas fuerte',
  shelterHint: 'Bajo el toldo del kiosco los rayos no te alcanzan',
  flowerHint: 'Una flor de lila. Llévala contigo.',
  roadHint: 'Mira a los dos lados: cruza cuando no venga ningún auto',
  againHint: 'Otra vez, con calma.',
};
