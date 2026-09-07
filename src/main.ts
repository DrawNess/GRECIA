import '@fontsource/dotgothic16/latin-400.css';
import '@fontsource/dotgothic16/latin-ext-400.css';
import '@fontsource/pixelify-sans/latin-500.css';
import '@fontsource/pixelify-sans/latin-ext-500.css';
import './style.css';

import { Stage } from './engine/stage';
import { startLoop } from './engine/loop';
import { loadSave, writeSave, resetSave } from './engine/save';
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
  (dt) => scene.update(dt),
  () => scene.render(stage.crisp, stage.soft),
);

if (loadSave().unlocked) {
  showCaption(stage.ui, gate.toBeContinued);
} else {
  mountGate(stage.ui, fav.toDataURL(), () => {
    writeSave({ unlocked: true });
    showCaption(stage.ui, gate.toBeContinued);
  });
}

// Entrada en fundido desde crema.
const veil = document.getElementById('veil')!;
requestAnimationFrame(() => requestAnimationFrame(() => veil.classList.add('is-gone')));
