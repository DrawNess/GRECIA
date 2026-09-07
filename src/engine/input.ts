// Teclado: flechas / WASD para mover. Z, Espacio y Enter = acción; X y Esc = cancelar.
const MOVE: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
};
export const ACTION = new Set(['KeyZ', 'Space', 'Enter']);
export const CANCEL = new Set(['KeyX', 'Escape']);

export class Input {
  private readonly down = new Set<string>();
  /** Teclas pulsadas desde la última lectura (para acciones de un toque). */
  readonly pressed = new Set<string>();

  constructor() {
    window.addEventListener('keydown', (e) => {
      // Mientras ella escribe en el menú, el teclado es del formulario.
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (MOVE[e.code] || ACTION.has(e.code) || CANCEL.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
  }

  /** Eje horizontal -1..1 y vertical -1..1 según las teclas mantenidas. */
  get axis(): [number, number] {
    let x = 0, y = 0;
    for (const code of this.down) {
      const m = MOVE[code];
      if (m) { x += m[0]; y += m[1]; }
    }
    return [Math.sign(x), Math.sign(y)];
  }

  /** Consume las pulsaciones acumuladas de un conjunto de teclas. */
  take(codes: Set<string>): boolean {
    let hit = false;
    for (const c of codes) if (this.pressed.delete(c)) hit = true;
    return hit;
  }

  endFrame(): void { this.pressed.clear(); }
}
