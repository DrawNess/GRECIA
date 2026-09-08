# Grecia — plan por etapas

Juego web 2D en pixel art, controlado con teclado, que termina en una carta.
Objetivo: PCs de bajos recursos. Hosting gratis en GitHub Pages.

## Decisiones

- **Stack:** Vite + TypeScript, Canvas 2D, cero dependencias en runtime
  (solo las fuentes `DotGothic16` y `Pixelify Sans`, empaquetadas).
- **Resolución interna:** 320×180, escalado entero. Dos capas: `soft`
  (80×45, se estira con suavizado → borroso), `crisp` (nítida) y `haze`
  (80×45, niebla y luz encima). El "desenfoque de ensueño" es una máscara
  radial entre `soft` y `crisp`: costo cero.
- **Controles (juego):** flechas / WASD mover · J (también Espacio / Enter)
  acción · Shift / K correr · Esc cancelar · M silencio.
- **Perspectiva del juego:** vista lateral 2.5D con plano de suelo y parallax.
  (La escena del menú es una ilustración frontal, cámara baja.)
- **Hosting:** GitHub Pages con GitHub Actions. Repo público → las respuestas
  de la puerta van hasheadas (sha256) y la carta final irá cifrada (AES-GCM)
  con la clave del QR.
- **Persistencia:** el sitio vive en Pages; el progreso de ella, en
  `localStorage`. `#reset` en la URL lo borra.

## Etapas

| # | Etapa | Estado |
|---|-------|--------|
| 0 | Setup: repo, Vite/TS, Action → Pages, menú con validación de nombre | ✅ código listo · ⏳ falta crear el repo en GitHub y hacer push |
| 1 | Núcleo del motor: loop, input, sprites animados, colisiones, cámara | ✅ input · sprites 3 direcciones con ciclo de caminata de 4 cuadros · movimiento en franja de suelo · orden por profundidad · colisiones con troncos, faroles, banca y puerta · mundo de 1280 px con cámara suave y parallax (ciudad 0.2×, árboles lejanos 0.45×) |
| 2 | Capa de ensueño en el juego: parallax, DOF, partículas, transiciones, caja de diálogo | pendiente |
| 3 | Interacción y guardado: objetos con `J`, diálogos, fragmentos, flags | 🔨 arbustos, banca, troncos, flor; **caja de diálogo con máquina de escribir** (`ui/dialog.ts`) usada en la banca. Falta: más diálogos, flags guardados |
| 4 | Puerta + QR: 2ª validación (fecha), token en URL, carta cifrada, tarjeta "ábrelo en la compu", QR | pendiente (falta la fecha) |
| 5 | Diseño de niveles: escenas y recuerdos (material del autor) | pendiente |
| 6 | Final y pulido: carta con máquina de escribir, música opcional, QA en PC débil, QR impreso | 🔨 sonido ambiental y efectos listos (sin música); resto pendiente |

## Mundo (etapa 1) — el paseo como recuerdo

- 2260 px (7 pantallas). Vereda continua abajo; senda curva al árbol grande.
- **Día → noche** al caminar a la derecha (x 340–660): el cielo pasa por el
  atardecer, la ciudad enciende ventanas, salen estrellas y la luna, los
  faroles se prenden (halo en la capa `haze`, luz horneada en el suelo).
- Tramo 1 (día): el árbol grande, arbustos.
- Tramo 2 (atardecer): farol, segundo árbol.
- Tramo 3 (noche, x 600–1046): **la esquina verde** — la pared verde de su
  casa a la entrada de la calle, donde más tiempo pasaban y hasta donde él la
  acompañaba: pavimento, la pared verde con enredadera, y pegada a ella **su
  casa** (puerta con luz en el portal, ventana encendida, cámara de seguridad
  con luz roja que parpadea); a la derecha, la calle que entra con un poste
  de luz al centro.
- Tramo 3½ (noche, x 1100–1740): **la tormenta** — los problemas. Nubes
  oscuras (capa media, parallax), lluvia de lado, relámpagos con destello,
  charcos. Minijuego: tres **árboles muertos** junto a la vereda crujen al
  acercarse (~1 s de aviso) y **se desploman cruzando el camino**; si Grecia
  está debajo, la lastiman → fundido y vuelta al menú (subtítulo "otra vez,
  con calma"). El tronco caído cierra la vereda y **se rompe con J** (3
  golpes). Además caen **rayos** cerca de ella con aviso en el suelo (mancha
  de luz que palpita ~0,8 s); si la alcanzan → vuelta al menú. **Ramas**
  que caen rápido (sombra chica): si la alcanzan solo tropieza. **Correr**
  con Shift/K (aliento limitado). **Kiosco rojo** con toldo a rayas: bajo el
  toldo no llegan rayos ni ramas. **Romper con ritmo**: sobre el tronco hay
  una barra con un marcador; J con el marcador al centro golpea fuerte (1,5),
  fuera apenas (0,5); vida 3. Cada tronco roto amaina la lluvia; con el
  último la tormenta pasa del todo y aparece **la flor de lila** en el
  camino: con J la recoge y **la lleva en la mano** desde entonces (brilla
  suave). Servirá para abrir una puerta al final (Jhammil lo explicará).
- Tramo 4 (noche): tercer árbol, farol y **la banca grande con Jhammil**
  sentado (cabello corto, camisa blanca, un poco más alto que ella); su nombre
  aparece en una etiqueta al acercarse. Al sentarse con J: **la cámara se
  acerca 2×** y aparece la **caja de diálogo** con el poema de Jhammil
  (`src/content/story.ts`, máquina de escribir, J/Enter pasa). Al terminar
  se paran los dos, se toman de la mano (corazoncitos) y **Jhammil camina a
  su lado, de la mano**, a donde ella vaya; si ella se da la vuelta, él pasa
  por detrás y le toma la mano del otro lado. Con J junto a la banca, Grecia se sienta a su
  lado y quedan mirándose; cualquier flecha la levanta.
- Después de la banca, **Chimuelo** (dragón negro) duerme sobre el pasto
  soltando "z"; cuando Grecia se acerca despierta, suelta corazones y se va
  volando; si ella se aleja un rato, vuelve a dormirse.
- Tramo 5 (noche, después de Chimuelo): **la autopista** (x 2036–2124), en
  perspectiva hacia el fondo, con guardarraíl, farolas y paso de cebra.
  Minijuego: autos que vienen creciendo por el carril derecho (faros) y se
  alejan por el izquierdo (luces rojas), cada 1,6–3,6 s por carril; hay que
  cruzar cuando no venga ninguno. Si un auto pisa a Grecia o a Jhammil:
  fundido corto y **vuelven a la banca**, de pie y de la mano ("Otra vez,
  con calma."). Aviso al acercarse. Sonido: paso de auto y bocina.
- De noche en el parque (fuera de la tormenta): luciérnagas y, de vez en
  cuando, una estrella fugaz.
- **Sonido** generado por código (`engine/audio.ts`): viento, lluvia y truenos
  en la tormenta, pájaros de día, grillos de noche; efectos al golpear y
  romper troncos, crujido y golpe del árbol, Chimuelo, corazones, arbustos.
  Botón ♪ arriba a la derecha y tecla M para silenciar (se recuerda).
- Puerta de jardín cerrada al final (meta, placeholder).
- Grecia rodea el tronco por la vereda; faroles y banca al borde del pasto.

## Menú (etapa 0)

- Escena (refs: composición de "gigantes entre bruma" + foto de lilas): árbol
  de lilas enorme que llena la pantalla, visto de frente; racimos grandes con
  flores de 4 pétalos nítidas al centro-izquierda y desenfocadas bajo el
  panel; día alto en luz (celeste, sol cálido arriba a la izquierda, bruma
  blanca sobre el pasto); Grecia pequeña de espaldas en el camino, delgada,
  dos trenzas cortas; pétalos, rocío, mariposas y bancos de niebla animados.
- Panel lateral: título, "Escribe tu nombre completo". Única respuesta
  válida, en mayúsculas obligatorias: se compara por sha256
  (`src/content/gate.ts`). Si escribe bien pero en minúsculas, se le pide
  mayúsculas.
- Segunda validación (fecha `DD/MM/AAAA`): lista en código; se activa al
  poner `dateHash` (generar con `pnpm hash "DD/MM/AAAA"`).
- El nombre se pide en cada visita (es el inicio de sesión).
- Al validar, el panel desaparece, la neblina y el desenfoque se despejan, un
  golpe de viento deshace el racimo del frente (flores y pétalos vuelan hacia
  la izquierda por delante de la cámara) y Grecia queda bajo control en el
  mismo escenario (flechas / WASD).

## Traspaso

Contexto completo para continuar en otra máquina: `docs/CONTEXTO.md`
(sección 9 = qué hacer primero).

## Publicar (una sola vez)

1. Crear repo público `grecia` en GitHub (vacío, sin README).
2. `git remote add origin git@github.com:USUARIO/grecia.git && git push -u origin main`
3. En GitHub: Settings → Pages → Source: **GitHub Actions**.
4. En ~1 min queda en `https://USUARIO.github.io/grecia/`.
