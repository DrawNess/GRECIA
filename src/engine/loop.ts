export function startLoop(update: (dt: number) => void, render: () => void): void {
  let last = performance.now();
  let raf = 0;
  const frame = (now: number) => {
    // El primer timestamp de rAF puede ser anterior a performance.now():
    // nunca dejar dt negativo. Y si la pestaña dormía, no saltar de golpe.
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    update(dt);
    render();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf);
    if (!document.hidden) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  });
}
