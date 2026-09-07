# Grecia — plan por etapas

Juego web 2D en pixel art, controlado con teclado, que termina en una carta.
Objetivo: PCs de bajos recursos. Hosting gratis en GitHub Pages.

## Decisiones

- **Stack:** Vite + TypeScript, Canvas 2D, cero dependencias en runtime
  (solo las fuentes `DotGothic16` y `Pixelify Sans`, empaquetadas).
- **Resolución interna:** 320×180, escalado entero. Dos capas: `soft`
  (80×45, se estira con suavizado → borroso) y `crisp` (nítida). El
  "desenfoque de ensueño" es una máscara radial entre ambas: costo cero.
- **Controles (juego):** flechas / WASD mover · Z / Espacio / Enter acción ·
  X / Esc cancelar.
- **Perspectiva del juego:** vista lateral 2.5D con plano de suelo y parallax.
  (La escena del menú es una ilustración vista desde arriba.)
- **Hosting:** GitHub Pages con GitHub Actions. Repo público → las respuestas
  de la puerta van hasheadas (sha256) y la carta final irá cifrada (AES-GCM)
  con la clave del QR.
- **Persistencia:** el sitio vive en Pages; el progreso de ella, en
  `localStorage`. `#reset` en la URL lo borra.

## Etapas

| # | Etapa | Estado |
|---|-------|--------|
| 0 | Setup: repo, Vite/TS, Action → Pages, menú con validación de nombre | ✅ código listo · ⏳ falta crear el repo en GitHub y hacer push |
| 1 | Núcleo del motor: loop, input, sprites animados, tilemap/colisiones, cámara | pendiente |
| 2 | Capa de ensueño en el juego: parallax, DOF, partículas, transiciones, caja de diálogo | pendiente |
| 3 | Interacción y guardado: objetos con `Z`, diálogos, fragmentos, flags | pendiente |
| 4 | Puerta + QR: 2ª validación (fecha), token en URL, carta cifrada, tarjeta "ábrelo en la compu", QR | pendiente (falta la fecha) |
| 5 | Diseño de niveles: escenas y recuerdos (material del autor) | pendiente |
| 6 | Final y pulido: carta con máquina de escribir, música opcional, QA en PC débil, QR impreso | pendiente |

## Menú (etapa 0)

- Escena: jardín de lilas visto desde arriba; Grecia de espaldas (trenza,
  vestido beige) bajo el árbol; ramos en el pasto; pétalos cayendo; bokeh.
- Panel lateral: título, "Escribe tu nombre completo". Única respuesta
  válida, en mayúsculas obligatorias: se compara por sha256
  (`src/content/gate.ts`). Si escribe bien pero en minúsculas, se le pide
  mayúsculas.
- Segunda validación (fecha `DD/MM/AAAA`): lista en código; se activa al
  poner `dateHash` (generar con `pnpm hash "DD/MM/AAAA"`).

## Publicar (una sola vez)

1. Crear repo público `grecia` en GitHub (vacío, sin README).
2. `git remote add origin git@github.com:USUARIO/grecia.git && git push -u origin main`
3. En GitHub: Settings → Pages → Source: **GitHub Actions**.
4. En ~1 min queda en `https://USUARIO.github.io/grecia/`.
