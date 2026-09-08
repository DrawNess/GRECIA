import { ACTION } from '../engine/input';
import { clearCaptions } from './gate';

export interface Line { who: string; text: string }

// Caja de diálogo con máquina de escribir. J / Enter / Espacio: si está
// escribiendo, completa la línea; si no, pasa a la siguiente. Al terminar
// llama a onDone.
export function showDialog(root: HTMLElement, lines: Line[], onDone: () => void): void {
  clearCaptions(root);
  const box = document.createElement('div');
  box.className = 'dialog';
  box.innerHTML = '<div class="dialog__who"></div><div class="dialog__text"></div><span class="dialog__arrow">▼</span>';
  root.appendChild(box);
  const who = box.querySelector<HTMLElement>('.dialog__who')!;
  const text = box.querySelector<HTMLElement>('.dialog__text')!;
  const arrow = box.querySelector<HTMLElement>('.dialog__arrow')!;

  let i = 0, shown = 0, timer = 0;
  const line = () => lines[i];
  const typing = () => shown < line().text.length;

  const tick = () => {
    shown++;
    text.textContent = line().text.slice(0, shown);
    if (!typing()) { clearInterval(timer); arrow.hidden = false; }
  };
  const start = () => {
    who.textContent = line().who;
    text.textContent = '';
    shown = 0;
    arrow.hidden = true;
    clearInterval(timer);
    timer = window.setInterval(tick, 28);
  };
  const onKey = (e: KeyboardEvent) => {
    if (!ACTION.has(e.code)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (typing()) { shown = line().text.length - 1; tick(); return; }
    i++;
    if (i < lines.length) { start(); return; }
    window.removeEventListener('keydown', onKey, true);
    clearInterval(timer);
    box.classList.add('is-gone');
    setTimeout(() => box.remove(), 350);
    onDone();
  };
  // Con captura y un pequeño retraso: la J que abrió la charla no la pasa.
  setTimeout(() => window.addEventListener('keydown', onKey, true), 250);
  setTimeout(() => box.classList.add('is-shown'), 30);
  start();
}
