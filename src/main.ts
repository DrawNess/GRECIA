import '@fontsource/dotgothic16/latin-400.css';
import '@fontsource/dotgothic16/latin-ext-400.css';
import '@fontsource/pixelify-sans/latin-500.css';
import '@fontsource/pixelify-sans/latin-ext-500.css';
import './style.css';

import { Stage } from './engine/stage';
import { Input } from './engine/input';
import { GameAudio } from './engine/audio';
import { loadSave } from './engine/save';
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

// Sonido: arranca con el primer gesto (teclado o clic). M lo silencia.
const audio = new GameAudio();
audio.muted = loadSave().muted ?? false;
const wake = () => audio.ensure();
window.addEventListener('keydown', wake);
window.addEventListener('pointerdown', wake);
const muteBtn = document.createElement('button');
muteBtn.className = 'mute';
muteBtn.type = 'button';
const paintMute = () => { muteBtn.textContent = audio.muted ? '♪ off' : '♪'; muteBtn.title = audio.muted ? 'Activar sonido (M)' : 'Silenciar (M)'; };
const toggleMute = () => { audio.setMuted(!audio.muted); writeSave({ muted: audio.muted }); paintMute(); };
muteBtn.addEventListener('click', () => { audio.ensure(); toggleMute(); });
window.addEventListener('keydown', (e) => { if (e.code === 'KeyM' && (e.target as HTMLElement).tagName !== 'INPUT') toggleMute(); });
paintMute();
stage.ui.appendChild(muteBtn);

// Entrada en fundido desde crema (setTimeout: no depende de que rAF esté activo).
const veil = document.getElementById('veil')!;
setTimeout(() => veil.classList.add('is-gone'), 80);

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

// Etiqueta con nombre que sigue a un punto de la escena.
const tagEl = document.createElement('div');
tagEl.className = 'tag';
tagEl.hidden = true;
stage.ui.appendChild(tagEl);

const step = (dt: number) => {
  scene.update(dt, input);
  input.endFrame();
  audio.update(dt, scene.ambience());
  for (const e of scene.takeEvents()) {
    if (e === 'storm') showCaption(stage.ui, gate.stormHint, 6000);
    else if (e === 'break') showCaption(stage.ui, gate.breakHint, 6000);
    else if (e === 'shelter') showCaption(stage.ui, gate.shelterHint, 5000);
    else if (e === 'flower') showCaption(stage.ui, gate.flowerHint, 6000);
    else if (e === 'caught') backToMenu();
    else if (e.startsWith('sfx:thunder')) audio.thunder(Number(e.split(':')[2] ?? 1));
    else if (e === 'sfx:hit') audio.hit();
    else if (e === 'sfx:crack') audio.crack();
    else if (e === 'sfx:creak') audio.creak();
    else if (e === 'sfx:thud') audio.thud();
    else if (e === 'sfx:purr') audio.purr();
    else if (e === 'sfx:twinkle') audio.twinkle();
    else if (e === 'sfx:flutter') audio.flutter();
    else if (e === 'sfx:rustle') audio.rustle();
  }
};

// Algo la lastimó: fundido a crema y de vuelta al menú.
function backToMenu(): void {
  veil.style.transitionDuration = '0.7s';
  veil.classList.remove('is-gone');
  setTimeout(() => { location.hash = '#again'; location.reload(); }, 850);
}
const draw = () => {
  scene.render(stage.crisp, stage.soft, stage.haze);
  const tag = scene.nameTag();
  if (tag) {
    tagEl.textContent = tag.text;
    tagEl.style.left = `calc(${tag.x} * var(--u))`;
    tagEl.style.top = `calc(${tag.y} * var(--u))`;
  }
  tagEl.hidden = !tag;
};
startLoop(step, draw);

// Gancho de depuración solo en local: permite avanzar la simulación a mano.
if (import.meta.env.DEV || location.hostname === 'localhost') {
  (window as unknown as { __grecia: unknown }).__grecia = { scene, stage, input, audio, tick: (dt: number) => { step(dt); draw(); } };
}

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
if (location.hash === '#again') history.replaceState(null, '', location.pathname + location.search);


