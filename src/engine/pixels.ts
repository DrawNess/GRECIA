// Rasterizador mínimo sobre un buffer RGBA: todo se dibuja píxel a píxel,
// sin antialias, para que el resultado sea pixel art de verdad.

export type RGBA = [number, number, number, number];

export function hex(c: string, a = 255): RGBA {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}

export class PixelBuffer {
  readonly data: Uint8ClampedArray<ArrayBuffer>;

  constructor(readonly w: number, readonly h: number) {
    this.data = new Uint8ClampedArray(new ArrayBuffer(w * h * 4));
  }

  get(x: number, y: number): RGBA {
    const i = (y * this.w + x) * 4;
    const d = this.data;
    return [d[i], d[i + 1], d[i + 2], d[i + 3]];
  }

  set(x: number, y: number, c: RGBA): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    const d = this.data;
    const a = c[3] / 255;
    if (a >= 1) {
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      return;
    }
    if (a <= 0) return;
    const da = d[i + 3] / 255;
    const oa = a + da * (1 - a);
    if (oa <= 0) return;
    d[i] = (c[0] * a + d[i] * da * (1 - a)) / oa;
    d[i + 1] = (c[1] * a + d[i + 1] * da * (1 - a)) / oa;
    d[i + 2] = (c[2] * a + d[i + 2] * da * (1 - a)) / oa;
    d[i + 3] = oa * 255;
  }

  hline(x0: number, x1: number, y: number, c: RGBA): void {
    for (let x = Math.round(x0); x <= Math.round(x1); x++) this.set(x, y, c);
  }

  rect(x: number, y: number, w: number, h: number, c: RGBA): void {
    for (let j = 0; j < h; j++) this.hline(x, x + w - 1, y + j, c);
  }

  circle(cx: number, cy: number, r: number, c: RGBA): void {
    cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
    for (let dy = -r; dy <= r; dy++) {
      const dx = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.35));
      this.hline(cx - dx, cx + dx, cy + dy, c);
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGBA): void {
    cx = Math.round(cx); cy = Math.round(cy);
    for (let dy = -ry; dy <= ry; dy++) {
      const k = 1 - (dy * dy) / (ry * ry);
      if (k < 0) continue;
      const dx = Math.floor(rx * Math.sqrt(k) + 0.3);
      this.hline(cx - dx, cx + dx, cy + dy, c);
    }
  }

  // Polígono convexo o cóncavo simple, relleno por scanline.
  poly(pts: [number, number][], c: RGBA): void {
    let minY = Infinity, maxY = -Infinity;
    for (const [, y] of pts) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
    const y0 = Math.max(0, Math.floor(minY));
    const y1 = Math.min(this.h - 1, Math.ceil(maxY));
    const xs: number[] = [];
    for (let y = y0; y <= y1; y++) {
      const cy = y + 0.5;
      xs.length = 0;
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) {
          xs.push(ax + ((cy - ay) * (bx - ax)) / (by - ay));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const xa = Math.round(xs[i]), xb = Math.round(xs[i + 1]);
        for (let x = xa; x < xb; x++) this.set(x, y, c);
      }
    }
  }

  blit(src: PixelBuffer, x: number, y: number): void {
    for (let j = 0; j < src.h; j++) {
      for (let i = 0; i < src.w; i++) {
        const k = (j * src.w + i) * 4;
        const a = src.data[k + 3];
        if (a === 0) continue;
        this.set(x + i, y + j, [src.data[k], src.data[k + 1], src.data[k + 2], a]);
      }
    }
  }

  // Ajusta cada píxel opaco al color más cercano de la paleta dada.
  quantize(palette: RGBA[]): void {
    const d = this.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      let best = palette[0], bestD = Infinity;
      for (const p of palette) {
        const dr = d[i] - p[0], dg = d[i + 1] - p[1], db = d[i + 2] - p[2];
        const dist = dr * dr + dg * dg + db * db;
        if (dist < bestD) { bestD = dist; best = p; }
      }
      d[i] = best[0]; d[i + 1] = best[1]; d[i + 2] = best[2];
    }
  }

  toCanvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const ctx = c.getContext('2d')!;
    ctx.putImageData(new ImageData(this.data, this.w, this.h), 0, 0);
    return c;
  }
}

// Convierte un dibujo en texto (una letra por píxel) en un PixelBuffer.
// '.' es transparente; el resto se busca en la paleta.
export function sprite(rows: readonly string[], palette: Record<string, string>): PixelBuffer {
  const w = rows[0].length;
  const pb = new PixelBuffer(w, rows.length);
  const cache = new Map<string, RGBA>();
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`sprite: fila ${y} mide ${row.length}, se esperaba ${w}`);
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      let c = cache.get(ch);
      if (!c) {
        const h = palette[ch];
        if (!h) throw new Error(`sprite: color desconocido '${ch}'`);
        c = hex(h);
        cache.set(ch, c);
      }
      pb.set(x, y, c);
    }
  });
  return pb;
}
