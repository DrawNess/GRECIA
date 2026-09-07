// Resolución interna fija y escalado entero al tamaño de la ventana.
// Dos capas: `soft` (baja resolución, se estira con suavizado → borroso)
// y `crisp` (320×180, se estira sin suavizado → píxel nítido).

export const VW = 320;
export const VH = 180;
export const SW = 80;
export const SH = 45;

export class Stage {
  readonly el: HTMLElement;
  readonly ui: HTMLElement;
  readonly crisp: CanvasRenderingContext2D;
  readonly soft: CanvasRenderingContext2D;
  scale = 1;

  constructor() {
    this.el = document.getElementById('stage')!;
    this.ui = document.getElementById('ui')!;
    const crisp = document.getElementById('crisp') as HTMLCanvasElement;
    const soft = document.getElementById('soft') as HTMLCanvasElement;
    crisp.width = VW; crisp.height = VH;
    soft.width = SW; soft.height = SH;
    this.crisp = crisp.getContext('2d', { alpha: true })!;
    this.soft = soft.getContext('2d', { alpha: false })!;
    this.crisp.imageSmoothingEnabled = false;
    this.soft.imageSmoothingEnabled = true;
    window.addEventListener('resize', () => this.fit());
    this.fit();
  }

  private fit(): void {
    // Escala calculada en píxeles físicos para que cada píxel virtual
    // ocupe un número entero de píxeles de pantalla (sin borrosidad).
    const dpr = window.devicePixelRatio || 1;
    const pw = window.innerWidth * dpr;
    const ph = window.innerHeight * dpr;
    const s = Math.max(1, Math.floor(Math.min(pw / VW, ph / VH)));
    this.scale = s / dpr;
    const w = VW * this.scale;
    const h = VH * this.scale;
    const st = this.el.style;
    st.width = `${w}px`;
    st.height = `${h}px`;
    st.left = `${Math.floor((pw - VW * s) / 2) / dpr}px`;
    st.top = `${Math.floor((ph - VH * s) / 2) / dpr}px`;
    st.setProperty('--s', String(this.scale));
  }
}
