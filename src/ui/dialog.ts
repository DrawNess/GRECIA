import { ACTION } from '../engine/input';
import { clearCaptions } from './gate';

export interface Line { who: string; text: string }

/** Una respuesta que Grecia puede elegir: lo que dice (`say`) y a qué nodo va (`go`). */
export interface Choice { say: string; go: string }

/**
 * Un nodo de conversación: quien habla (`who`, opcional), sus cajas (`lines`),
 * y luego o bien opciones para que ella responda (`choices`) o un salto
 * directo (`go`). Sin ninguno de los dos, la charla termina.
 */
export interface Node { who?: string; lines: string[]; choices?: Choice[]; go?: string }

/** Conversación completa: nodo inicial y todos los nodos por nombre. */
export interface Conversation { start: string; nodes: Record<string, Node> }

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);

// Caja de diálogo con máquina de escribir. J / Enter / Espacio: si está
// escribiendo, completa la línea; si no, pasa a la siguiente. Al terminar
// llama a onDone.
export function showDialog(root: HTMLElement, lines: Line[], onDone: () => void): void {
  const conv: Conversation = {
    start: 'a',
    nodes: { a: { lines: lines.map((l) => l.text) } },
  };
  // Cada línea puede venir de un hablante distinto: las guardo aparte.
  const whos = lines.map((l) => l.who);
  runDialog(root, conv, { him: whos[0] ?? '', her: '' }, onDone, whos);
}

/**
 * Conversación con opciones. `names.him` habla en los nodos sin `who`;
 * `names.her` es quien elige (su respuesta se muestra como una caja suya).
 * Flechas ↑↓ (o W/S) mueven la elección; J / Enter / Espacio la confirman.
 */
export function showConversation(
  root: HTMLElement,
  conv: Conversation,
  names: { him: string; her: string },
  onDone: () => void,
): void {
  runDialog(root, conv, names, onDone);
}

function runDialog(
  root: HTMLElement,
  conv: Conversation,
  names: { him: string; her: string },
  onDone: () => void,
  whosOverride?: string[],
): void {
  clearCaptions(root);
  const box = document.createElement('div');
  box.className = 'dialog';
  box.innerHTML =
    '<div class="dialog__who"></div><div class="dialog__text"></div>' +
    '<div class="dialog__choices" hidden></div><span class="dialog__arrow">▼</span>';
  root.appendChild(box);
  const who = box.querySelector<HTMLElement>('.dialog__who')!;
  const text = box.querySelector<HTMLElement>('.dialog__text')!;
  const choicesEl = box.querySelector<HTMLElement>('.dialog__choices')!;
  const arrow = box.querySelector<HTMLElement>('.dialog__arrow')!;

  // Cola de cajas por mostrar; al vaciarse se mira el nodo actual.
  let queue: Line[] = [];
  let node: Node | undefined;
  let cur: Line = { who: '', text: '' };
  let shown = 0, timer = 0;
  let choosing = false, pick = 0;
  const typing = () => shown < cur.text.length;

  const tick = () => {
    shown++;
    text.textContent = cur.text.slice(0, shown);
    if (!typing()) {
      clearInterval(timer);
      if (queue.length === 0 && node?.choices?.length) openChoices();
      else arrow.hidden = false;
    }
  };
  const startLine = () => {
    cur = queue.shift()!;
    who.textContent = cur.who;
    text.textContent = '';
    shown = 0;
    arrow.hidden = true;
    choicesEl.hidden = true;
    clearInterval(timer);
    timer = window.setInterval(tick, 28);
  };
  const enter = (name: string) => {
    node = conv.nodes[name];
    if (!node) { console.warn(`Conversación: no existe el nodo "${name}"`); finish(); return; }
    const speaker = node.who ?? names.him;
    queue = node.lines.map((t, i) => ({ who: whosOverride?.[i] ?? speaker, text: t }));
    if (queue.length) startLine();
    else advance();
  };
  // Se acabaron las cajas del nodo: opciones, salto o fin.
  const advance = () => {
    if (queue.length) { startLine(); return; }
    if (node?.choices?.length) { openChoices(); return; }
    if (node?.go) { enter(node.go); return; }
    finish();
  };
  const openChoices = () => {
    choosing = true; pick = 0;
    arrow.hidden = true;
    choicesEl.innerHTML = '';
    for (const c of node!.choices!) {
      const el = document.createElement('div');
      el.className = 'dialog__choice';
      el.textContent = c.say;
      choicesEl.appendChild(el);
    }
    choicesEl.hidden = false;
    paintPick();
  };
  const paintPick = () => {
    choicesEl.querySelectorAll<HTMLElement>('.dialog__choice').forEach((el, i) => el.classList.toggle('is-current', i === pick));
  };
  const choose = () => {
    const c = node!.choices![pick];
    choosing = false;
    choicesEl.hidden = true;
    // Lo que ella eligió se muestra como una caja suya, y luego sigue el nodo.
    const next = conv.nodes[c.go];
    if (!next) console.warn(`Conversación: no existe el nodo "${c.go}"`);
    node = next;
    queue = [{ who: names.her, text: c.say }];
    if (next) queue.push(...next.lines.map((t) => ({ who: next.who ?? names.him, text: t })));
    startLine();
  };
  const finish = () => {
    window.removeEventListener('keydown', onKey, true);
    clearInterval(timer);
    box.classList.add('is-gone');
    setTimeout(() => box.remove(), 350);
    onDone();
  };
  const onKey = (e: KeyboardEvent) => {
    if (choosing) {
      const n = node!.choices!.length;
      if (UP.has(e.code)) { pick = (pick + n - 1) % n; paintPick(); }
      else if (DOWN.has(e.code)) { pick = (pick + 1) % n; paintPick(); }
      else if (ACTION.has(e.code)) choose();
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (!ACTION.has(e.code)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (typing()) { shown = cur.text.length - 1; tick(); return; }
    advance();
  };
  // Con captura y un pequeño retraso: la J que abrió la charla no la pasa.
  setTimeout(() => window.addEventListener('keydown', onKey, true), 250);
  setTimeout(() => box.classList.add('is-shown'), 30);
  enter(conv.start);
}
