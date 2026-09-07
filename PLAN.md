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
  acción · K / Esc cancelar.
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
| 1 | Núcleo del motor: loop, input, sprites animados, tilemap/colisiones, cámara | 🔨 en curso: input, sprites 3 direcciones con caminata, movimiento en franja de suelo, orden con el tronco. Falta: cámara/scroll, más escenarios |
| 2 | Capa de ensueño en el juego: parallax, DOF, partículas, transiciones, caja de diálogo | pendiente |
| 3 | Interacción y guardado: objetos con `J`, diálogos, fragmentos, flags | 🔨 empezado: arbustos con indicador `J`; al pulsar salen mariposas o pájaros (aleatorio, una vez por arbusto). Falta: diálogos, fragmentos, flags |
| 4 | Puerta + QR: 2ª validación (fecha), token en URL, carta cifrada, tarjeta "ábrelo en la compu", QR | pendiente (falta la fecha) |
| 5 | Diseño de niveles: escenas y recuerdos (material del autor) | pendiente |
| 6 | Final y pulido: carta con máquina de escribir, música opcional, QA en PC débil, QR impreso | pendiente |

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

## Publicar (una sola vez)

1. Crear repo público `grecia` en GitHub (vacío, sin README).
2. `git remote add origin git@github.com:USUARIO/grecia.git && git push -u origin main`
3. En GitHub: Settings → Pages → Source: **GitHub Actions**.
4. En ~1 min queda en `https://USUARIO.github.io/grecia/`.
