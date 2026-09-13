// Las palabras: la máquina de estados del minijuego, sin dibujo ni escena.
// Cada parada del camino tiene una palabra; al llegar a ella aparece y hay
// que escribirla antes de que se apague. Si se apaga, vuelve con más tiempo.
// Nunca se pierde: solo se repite hasta decirla.

export interface WordStop { x: number; text: string; plain: string; bad: boolean; done: boolean }
export type WordPhase = 'typing' | 'ok' | 'fail';
export interface WordRun { i: number; typed: number; time: number; total: number; tries: number; shake: number; phase: WordPhase; t: number }
/** Qué pasó en este cuadro: para sonidos, efectos y ayudas. */
export type WordEvent = 'start' | 'wrong' | 'ok' | 'fail' | 'retry' | 'next' | 'done';

const OK_HOLD = 0.8;    // s que la palabra completada se queda antes de seguir
const FAIL_HOLD = 1.5;  // s de pausa tras apagarse, antes de volver
const WRONG_COST = 0.35; // s que resta una letra equivocada

/** Sin tildes ni mayúsculas: así se compara lo que ella escribe. */
export const plainText = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Tiempo para una palabra: medio segundo por letra, un segundo de margen, y uno más por cada intento fallido. */
export const timeFor = (plain: string, tries: number) => 0.5 * plain.length + 1 + tries;

export class WordGame {
  readonly stops: WordStop[];
  current: WordRun | null = null;
  done = false;

  constructor(words: { text: string; bad: boolean }[], x0: number, x1: number) {
    this.stops = words.map((w, i) => ({ x: x0 + (x1 - x0) * i / Math.max(1, words.length - 1), text: w.text, plain: plainText(w.text), bad: w.bad, done: false }));
  }

  get stop(): WordStop | null { return this.current ? this.stops[this.current.i] : null; }

  /**
   * Un cuadro. `canStart`: se puede abrir una palabra nueva (van de la mano,
   * sin otra cosa en curso). `fx`: posición de ella. `letters`: lo tecleado.
   */
  update(dt: number, letters: string[], canStart: boolean, fx: number): WordEvent[] {
    const ev: WordEvent[] = [];
    if (!this.current) {
      if (this.done || !canStart) return ev;
      const i = this.stops.findIndex((w) => !w.done && fx >= w.x);
      if (i < 0) return ev;
      const total = timeFor(this.stops[i].plain, 0);
      this.current = { i, typed: 0, time: total, total, tries: 0, shake: 0, phase: 'typing', t: 0 };
      ev.push('start');
      return ev;
    }
    const w = this.current, stop = this.stops[w.i];
    w.shake = Math.max(0, w.shake - dt);
    if (w.phase === 'typing') {
      w.time -= dt;
      for (const ch of letters) {
        if (w.typed >= stop.plain.length) break;
        if (ch === stop.plain[w.typed]) w.typed++;
        else { w.shake = 0.3; w.time -= WRONG_COST; ev.push('wrong'); }
      }
      if (w.typed >= stop.plain.length) { w.phase = 'ok'; w.t = 0; ev.push('ok'); }
      else if (w.time <= 0) { w.phase = 'fail'; w.t = 0; w.time = 0; ev.push('fail'); }
    } else if (w.phase === 'ok') {
      w.t += dt;
      if (w.t > OK_HOLD) {
        stop.done = true;
        this.current = null;
        ev.push('next');
        if (this.stops.every((st) => st.done)) { this.done = true; ev.push('done'); }
      }
    } else {
      w.t += dt;
      if (w.t > FAIL_HOLD) {
        w.tries++;
        w.total = timeFor(stop.plain, w.tries);
        w.time = w.total; w.typed = 0; w.phase = 'typing'; w.t = 0;
        ev.push('retry');
      }
    }
    return ev;
  }
}
