import '@fontsource/dotgothic16/latin-400.css';
import '@fontsource/dotgothic16/latin-ext-400.css';
import '@fontsource/pixelify-sans/latin-500.css';
import '@fontsource/pixelify-sans/latin-ext-500.css';
import './style.css';

import { Stage } from './engine/stage';
import { Input } from './engine/input';
import { startLoop } from './engine/loop';
import { writeSave, resetSave } from './engine/save';
import { TitleScene } from './scenes/title';
import { mountGate, showCaption } from './ui/gate';
import { gate } from './content/gate';

// tuusuario.github.io/grecia/#reset borra el progreso guardado (útil para probar).
if (location.hash === '#reset') {
  resetSave();
  history.replaceState(null, '', location.pathname + location.search);
}

const stage = new Stage();
const scene = new TitleScene();
const input = new Input();

// Favicon: la ramita de lila escalada sin suavizado.
const fav = document.createElement('canvas');
fav.width = 48; fav.height = 48;
const fctx = fav.getContext('2d')!;
fctx.imageSmoothingEnabled = false;
fctx.drawImage(scene.icon, 0, 0, 48, 48);
const link = document.createElement('link');
link.rel = 'icon';
link.href = fav.toDataURL();
document.head.appendChild(link);

startLoop(
  (dt) => { scene.update(dt, input); input.endFrame(); },
  () => scene.render(stage.crisp, stage.soft, stage.haze),
);

function enterGame(showHint: boolean): void {
  scene.startGame();
  if (showHint) showCaption(stage.ui, gate.moveHint, 5000);
}

// El nombre se pide en cada visita: es el "inicio de sesión" y parte del ritual.
// El guardado queda para el progreso de las etapas siguientes.
mountGate(stage.ui, fav.toDataURL(), () => {
  writeSave({ unlocked: true });
  enterGame(true);
});

// Entrada en fundido desde crema (setTimeout: no depende de que rAF esté activo).
const veil = document.getElementById('veil')!;
setTimeout(() => veil.classList.add('is-gone'), 80);
