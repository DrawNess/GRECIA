# Grecia — contexto completo del proyecto

Documento para retomar el trabajo en cualquier máquina (o con otra sesión de
Claude Code). Léelo junto con `PLAN.md` (estado por etapas). Última
actualización: 2026-09-07.

## 1. Qué es

Un regalo: un juego web en pixel art, corto y contemplativo, hecho para
**Grecia** por **Jhammil**. Ella lo abre desde un link/QR, escribe su nombre,
y controla a una versión pixel de sí misma en un paseo que recorre lugares de
la historia de los dos. Al final (etapa futura) habrá una carta.

- Web estática, sin servidor. Pensado para **PCs de bajos recursos**.
- Estilo: pixel art limpio y minimal, colores pastel, "de ensueño" (bordes
  desenfocados, bruma, luz suave).
- Idioma de la interfaz y del código (comentarios): español.

## 2. Estado actual (qué funciona ya)

1. **Menú**: ilustración del jardín de lilas (árbol enorme de frente, racimo
   de lilas en primer plano a la derecha, ciudad en la neblina al fondo,
   Grecia pequeña de espaldas). Panel a la izquierda pide el **nombre
   completo**; solo acepta `GRECIA NICOL ESCOBAR MAMANI` en mayúsculas
   (comparación por sha256; si lo escribe bien en minúsculas se le pide
   mayúsculas). El nombre se pide en cada visita.
2. **Entrada al juego**: el panel se desvanece, la niebla y el desenfoque se
   despejan, un golpe de viento se lleva las flores del frente por delante de
   la cámara, y Grecia queda bajo control.
3. **Paseo** de 2260 px (7 pantallas) con cámara suave y parallax:
   - Tramo 1 (día): el árbol grande, arbustos.
   - Tramo 2 (atardecer → noche al avanzar): farol, segundo árbol.
   - Tramo 3 (noche): **la esquina verde** — pared verde, y pegada a ella
     **su casa** (puerta con luz en el portal, ventana encendida, cámara de
     seguridad con luz roja); a la derecha la calle que entra, con un poste
     de luz al centro.
   - Tramo 3½ (noche): **la tormenta** — los problemas. Nubes, lluvia,
     relámpagos, charcos. Minijuego: tres árboles muertos que crujen y se
     desploman cruzando la vereda al acercarse (si la aplastan → vuelta al
     menú con `#again`, subtítulo "otra vez, con calma"); el tronco caído se
     rompe con J (romper con ritmo: barra con marcador, al centro golpea
     fuerte). Rayos dirigidos con aviso en el suelo (si la alcanzan → vuelta
     al menú) y ramas que caen (solo tropieza). Correr con Shift/K. Un
     **kiosco rojo** es refugio: bajo el toldo no llegan rayos ni ramas. Con
     cada tronco roto amaina la lluvia; con el último la tormenta pasa y
     aparece **la flor de lila**: J la recoge y Grecia la lleva en la mano
     (`player.flower`). Está pensada para abrir una puerta más adelante
     (Jhammil lo explicará).
   - Tramo 4 (noche): tercer árbol, farol, **la banca grande con Jhammil**
     sentado; con J Grecia se sienta a su lado y se miran (etiqueta con su
     nombre). La cámara se acerca 2× y aparece la caja de diálogo con el
     poema de Jhammil (`story.benchTalk`); al terminar se paran, se toman de la mano y Jhammil
     camina a su lado el resto del paseo (`him`, del lado contrario a donde
     ella mira, con las manos unidas dibujadas entre los dos). Después, **Chimuelo** (dragón negro) durmiendo: al acercarse
     despierta, suelta corazones y se va volando; vuelve a dormirse si ella
     se aleja un rato.
   - Tramo 5 (noche): **la autopista** en perspectiva. Autos que vienen
     (faros) y se van (luces rojas); cruzar cuando no venga ninguno. Si un
     auto pisa a cualquiera de los dos → fundido y vuelta a la banca
     (`respawnAtBench`), no al menú.
   - Puerta de jardín cerrada al final (meta provisional).
4. **Interacción**: J junto a un arbusto lo sacude; de algunos salen
   mariposas o pájaros (una vez cada uno). J junto a la banca: sentarse.
5. Sprites de Grecia en tres direcciones con caminata de 4 cuadros; sprites
   sentados de Grecia y Jhammil.

## 3. Cómo correrlo

```sh
pnpm install          # una vez (Node 22+; probado con Node 26 y pnpm 11)
pnpm dev              # http://localhost:5173 (recarga en vivo)
pnpm build            # tsc + vite → dist/
pnpm preview          # sirve dist/ en http://localhost:4173
pnpm hash "TEXTO"     # sha256 para las respuestas de src/content/gate.ts
```

- `#reset` al final de la URL borra el progreso guardado en localStorage.
- En `localhost` existe `window.__grecia` = `{ scene, stage, input, tick(dt) }`
  para avanzar la simulación a mano desde la consola (útil para probar sin
  esperar, o cuando la pestaña está oculta y el navegador congela rAF).

## 4. Arquitectura

```
index.html                 canvas soft + crisp + haze, div #ui, #veil (fundido)
src/main.ts                arranque: Stage, Input, escena, bucle, puerta, etiqueta de nombre
src/style.css              panel del menú, etiqueta, ayuda, fuentes
src/engine/stage.ts        resolución 320×180 y escalado entero; 3 capas
src/engine/loop.ts         bucle rAF con dt acotado + respaldo por setTimeout
src/engine/input.ts        teclado: flechas/WASD, J acción, Shift/K correr, Esc cancelar
src/engine/pixels.ts       PixelBuffer: rasterizador pixel a pixel + sprite() desde texto
src/engine/rng.ts          aleatorio con semilla (todo el arte es reproducible)
src/engine/hash.ts         sha256 en JS puro (funciona también en http://)
src/engine/save.ts         localStorage (progreso, silencio)
src/engine/audio.ts        sonido por código (WebAudio): ambientes y efectos
src/art/palette.ts         TODOS los colores, con nombre
src/art/sprites.ts         Grecia (3 vistas, caminata, sentada), Jhammil sentado, ramita
src/scenes/title.ts        LA escena: menú + mundo + objetos + animaciones (≈1200 líneas)
src/ui/gate.ts             panel de nombre/fecha (DOM), ayudas (una a la vez)
src/ui/dialog.ts           caja de diálogo con máquina de escribir (J/Enter pasa)
src/content/gate.ts        textos y hashes de la puerta
src/content/story.ts       nombres (y, próximamente, frases del paseo)
scripts/hash.mjs           `pnpm hash`
.github/workflows/deploy.yml   publica dist/ en GitHub Pages al hacer push a main
```

### Capas de dibujo (engine/stage.ts)

- Resolución interna **320×180**, escalada por un entero al tamaño de la
  ventana (calculado en píxeles físicos para que no se vea borroso).
- `soft` (80×45, se estira **con** suavizado → borroso): fondo del menú.
- `crisp` (320×180, **sin** suavizado): todo el pixel art.
- `haze` (80×45, transparente, encima): niebla, halos de luz, tinte de noche,
  flores fuera de foco. Borroso "gratis".
- El desenfoque del menú es una máscara radial (`makeFocused`) entre `soft`
  y `crisp`. En el juego la máscara se desvanece (`focus` 1 → 0).

### La escena (scenes/title.ts)

- Todo lo estático se pinta **una vez** en `PixelBuffer`s al construir:
  cielo (día/atardecer/noche), ciudad (parallax 0.2×, versión diurna y
  nocturna), árboles lejanos (0.45×), `world` (1440×180: suelo, vereda,
  esquina verde, copas de los árboles), primer plano (la foto de lilas).
- **Objetos** (`Prop`): sprites con coordenadas de mundo y `baseY` (línea
  del suelo). Se dibujan ordenados por `baseY` junto con Grecia → ella pasa
  por delante o por detrás. `solid` define la huella que bloquea el paso.
  `addProp(kind, img, cx, baseY, r, solid?, secret?)`.
- **Noche**: `nightAt(x)` (0 en x≤340, 1 en x≥660). Cielo y ciudad se
  cruzan según la cámara; el tinte oscuro es un gradiente horizontal en
  `haze`; los faroles tienen halo (`lights`) y luz horneada en el suelo.
- **Cámara**: sigue a Grecia con suavizado exponencial, acotada al mundo.
- **Grecia** (`player`): 12×23, velocidad 40 px/s horizontal, 24 vertical,
  franja de suelo y=129…157 (pies 150…180). `sitting` en la banca.
- **Interacción**: `findNearProp()` (arbustos y banca; la banca tiene
  prioridad), burbuja con J, `poke()`.
- **Bichos** (`critters`): mariposas, pájaros, pétalos, corazones, "z".
- **Chimuelo** (`dragon`): estados sleep → wake → fly → gone → sleep.
  Sprites procedimentales en `renderDragon()`.
- **Charla en la banca**: `sit()` → `zoomTarget = 2`, `busy = true`
  (la escena ignora el teclado) y evento `talk:bench`; main abre
  `showDialog(story.benchTalk)`; al terminar `afterTalk()`: banca vacía,
  `him.active`, zoom 1. El zoom se hace re-dibujando la capa nítida (y la
  haze) sobre sí mismas ampliadas, centradas en la banca.
- **Jhammil acompañante** (`updateFollower`): se coloca a `HAND_GAP` (10 px)
  del lado contrario a donde mira Grecia, un píxel atrás en profundidad, y
  sigue su velocidad; `holding` cuando está en su sitio → se dibujan las
  manos unidas (píxeles de piel entre ambos) al dibujar a Grecia. Sprites
  `JHAMMIL` (perfil/espaldas/frente, 12×26, caminata de 4 cuadros).
- **Autopista** (`updateHighway`): `ROAD` define la calzada; `roadX/roadY/
  roadS(t)` dan posición y escala por profundidad t (0 lejos … 1 cerca).
  `cars` avanzan (vienen) o retroceden (se van) en 2,2 s; se dibujan
  escalados y ordenados por su base; faros/luces rojas en `haze`. Atropello
  = base del auto a ±5 px de los pies de Grecia o Jhammil y dentro de su
  ancho → evento `hit:car` → main funde y llama `respawnAtBench()`.
- **Vida nocturna** (`updateNightLife`): luciérnagas cuando es de noche y no
  hay tormenta; estrella fugaz cada 12–26 s.
- **Sonido** (`engine/audio.ts`, `GameAudio`): se crea con el primer gesto;
  `update(dt, scene.ambience())` ajusta viento/lluvia/grillos/pájaros; los
  efectos llegan como eventos `sfx:*` desde la escena (`takeEvents`). M o el
  botón ♪ silencian; se guarda en `save.muted`.
- **Tormenta** (`updateStorm`): `stormAt(x)` da la intensidad por posición;
  `broken` (troncos rotos) la reduce. Lluvia en pantalla (`rain`), relámpagos
  ambientales (`bolt` + `flash`), rayos dirigidos (`strikes`: aviso 0,85 s y
  caída; `hurt()` si alcanza a Grecia), tinte gris-azul en `haze`, nubes en
  la capa media (`paintStormClouds`, alpha según `broken`). Árboles muertos =
  props `barrier` con estado `tree` (stand → shake → fall → down): de pie
  (`renderDeadTree`), al caer se vuelven tronco tendido (`renderFallenTrunk`
  por `hp`) sólido; `hitBarrier()` lo rompe con el ritmo de `rhythm()`.
  Ramas: `branches` (caen en ~0,8 s; tropiezo). Kiosco: prop `kiosk`;
  `sheltered()` = bajo el toldo. Flor: al romper el último tronco,
  `flowerTimer` crea el prop `flower`; `poke()` la recoge → `player.flower`
  y `drawCarried()` la dibuja en la mano según `facing`. `hurt()` → evento
  `caught` → main funde el velo y recarga con `#again`. Correr:
  `Input.running`, `player.stamina` (1,3 s de carrera, se recupera al doble).
- **Menú**: la composición a cámara 0 se enmascara (`menuBack`); en el juego
  se compone en vivo cada cuadro (`compose()`).

### Sprites en texto (art/sprites.ts)

Cada sprite es un arreglo de filas de igual largo; una letra por píxel,
`.` = transparente; las letras se resuelven en una paleta por sprite
(`{ O: C.outline, H: C.hair, … }`). `sprite(rows, pal)` lanza error si una
fila tiene otro largo. Los personajes miden 12×23 (de pie) y 12×26
(sentados). Los cuadros de caminata se generan a partir del cuadro base
(`walkCycle`) cambiando piernas, brazos y lazos.

## 5. Contenido de la historia (lo que definió Jhammil)

- **Grecia**: delgada, cabello castaño con dos trenzas cortas hasta los
  hombros con lazos lila, vestido beige formal y delicado.
- **Jhammil**: cabello oscuro corto, camisa blanca, un poco más alto que ella.
- **La esquina verde**: la pared verde a la entrada de la calle de ella; al
  lado, su casa (la única con cámara). Ahí pasaban más tiempo; hasta ahí la
  acompañaba él. Era de noche.
- **La banca**: grande; él sentado; ella llega, se sienta y se miran.
- **La tormenta**: entre la esquina verde y la banca, una parte triste con
  lluvia y relámpagos que representa los problemas; esquivar árboles que caen
  y rayos, y romper los troncos = pasar los problemas. Si algo la alcanza,
  vuelve al menú (pedido de Jhammil). Nada de abejas u otras cosas ajenas a
  la historia.
- **Chimuelo**: dragón negro dormido después de la banca; despierta con
  ella, corazones, y vuela.
- **El poema de la banca** (texto de Jhammil, en `story.benchTalk`): "Quiero un
  futuro contigo…" hasta "…alguien que te elegirá cada día", y el cierre
  "¿Vamos? Te sigo a donde vayas." (editable). Después él la sigue.
- Tecla de interacción: **J** (decisión de Jhammil). Correr: Shift/K.
- **La autopista** (2026-09-08): minijuego de cruzar de noche esquivando
  autos; si los pisan, reinician desde la banca (pedido de Jhammil).
- **La flor de lila**: la recompensa de la tormenta; Grecia la lleva en la
  mano y la usará para abrir una puerta al final del tramo (Jhammil lo
  explicará después).

Textos editables: `src/content/story.ts` (nombres; próximamente frases) y
`src/content/gate.ts` (menú). Las respuestas de la puerta van como sha256:
`pnpm hash "TEXTO EXACTO"` y pegar el resultado.

## 6. Pendientes (en orden sugerido)

1. **Más diálogos**: la caja ya existe (banca). Falta qué se lee con J frente
   a su casa, con Chimuelo, y la puerta final (Jhammil dará los textos).
2. **Fecha** de la segunda validación (Jhammil aún no la dio): generar
   `dateHash` con `pnpm hash "DD/MM/AAAA"` y pegarlo en `gate.ts`; el paso
   ya está programado y se activa solo.
3. Más recuerdos / lugares si los hay; qué pasa en la puerta final.
4. **Carta final** cifrada (AES-GCM, WebCrypto) con la clave del QR; pantalla
   con máquina de escribir; botón para responder (WhatsApp).
5. **QR**: la URL de Pages con `#k=TOKEN`; tarjeta "ábrelo en la compu" si
   se abre en un celular (hoy en móvil se ve diminuto).
6. Música opcional (canción que pase Jhammil); los sonidos ambientales ya están.
7. Pruebas en la PC real de ella (rendimiento, teclado, navegador).

## 7. Despliegue: GitHub Pages (gratis, solo con la cuenta de GitHub)

El repositorio ya tiene el workflow `.github/workflows/deploy.yml`: en cada
`git push` a `main` compila y publica `dist/`.

Una sola vez:

1. En GitHub, crear un repositorio **público** llamado `grecia` (vacío: sin
   README, sin .gitignore).
2. En la carpeta del proyecto:
   ```sh
   git remote add origin git@github.com:TU_USUARIO/grecia.git   # o https://github.com/TU_USUARIO/grecia.git
   git push -u origin main
   ```
3. En el repo: **Settings → Pages → Build and deployment → Source: GitHub
   Actions**. (El workflow intenta habilitarlo solo con
   `actions/configure-pages`, pero si el primer despliegue falla con
   "Creating Pages deployment failed … Not Found", es esto: habilitarlo a
   mano y volver a correr el workflow desde la pestaña Actions.)
4. En ~1 minuto queda publicado en `https://TU_USUARIO.github.io/grecia/`.
   El progreso del workflow se ve en la pestaña **Actions**.

Repo real: `DrawNess/GRECIA` → `https://drawness.github.io/GRECIA/`.

Notas:
- El repo debe ser **público**: con repo privado, la página de Pages pide
  pagar GitHub Pro. Para cambiarlo: Settings → Danger Zone → Change
  repository visibility → Make public. (Si se quiere privado sí o sí, usar
  Cloudflare Pages: Workers & Pages → Create → Pages → Connect to Git,
  build `pnpm build`, output `dist`; gratis y sin cambios en el código.) Por eso el nombre de ella no
  está en texto plano (solo su hash) y la carta final irá cifrada.
- `vite.config.ts` usa `base: './'`, así que funciona en cualquier ruta.
- Alternativas si algún día se quiere repo privado: Cloudflare Pages o
  Netlify (gratis, se conectan a la cuenta de GitHub). Nada que cambiar en el
  código.
- El QR final apuntará a esa URL (más `#k=TOKEN` en la etapa 4).

## 8. Para continuar en otra máquina

1. Hacer el `push` del punto anterior desde esta máquina (todo está
   commiteado en `main`).
2. En la otra máquina: instalar Node 22+ y pnpm (`corepack enable` o
   `npm i -g pnpm`), luego:
   ```sh
   git clone git@github.com:TU_USUARIO/grecia.git
   cd grecia && pnpm install && pnpm dev
   ```
3. Abrir este documento y `PLAN.md`. Si se usa Claude Code, pedirle que lea
   `docs/CONTEXTO.md` primero: ahí está todo lo que no se deduce del código.

## 9. Traspaso (2026-09-07, fin de la primera sesión)

Estado al cerrar: todo commiteado en `main` y subido a `DrawNess/GRECIA`.
Verificado en Chrome: menú → nombre → viento → paseo completo (día → noche →
esquina verde → banca con Jhammil → Chimuelo) → puerta final. Sin errores en
consola.

Primero, en casa:

1. `git clone git@github.com:DrawNess/GRECIA.git && cd GRECIA && pnpm install && pnpm dev`.
2. Publicar: hacer el repo **público** (Settings → Danger Zone), luego
   Settings → Pages → Source: **GitHub Actions**, y re-correr el workflow
   (Actions → Re-run) o hacer un push. URL: `https://drawness.github.io/GRECIA/`.
3. Si se trabaja con Claude Code, empezar con: *"Lee docs/CONTEXTO.md y
   PLAN.md. Seguimos con la caja de diálogo."* Claude de esta máquina tenía
   además notas de memoria locales; todo lo importante está en este archivo.

Lo que decidimos que viene (en orden): caja de diálogo con máquina de
escribir (J frente a su casa, al sentarse en la banca, quizá con Chimuelo)
→ textos reales de Jhammil → fecha de la segunda validación → carta final
cifrada + QR → música opcional → pruebas en la PC de ella.

Ideas que quedaron dichas y no hechas: afinar la cara de Chimuelo si se
quiere más parecido; "fragmentos" coleccionables que abran la puerta final;
tarjeta "ábrelo en la compu" cuando se abre desde el celular.
