export function startLoop(update: (dt: number) => void, render: () => void): void {
  let last = performance.now();
  let lastRaf = last;
  let raf = 0;

  const tick = (now: number) => {
    // El primer timestamp de rAF puede ser anterior a performance.now():
    // nunca dejar dt negativo. Y si la pestaña dormía, no saltar de golpe.
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    update(dt);
    render();
  };
  const frame = (now: number) => {
    lastRaf = now;
    tick(now);
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

  // Respaldo: algunos navegadores pausan rAF en ventanas tapadas aunque la
  // página siga "visible". Si rAF lleva más de 250 ms sin llamar, seguimos a 20 fps.
  setInterval(() => {
    const now = performance.now();
    if (!document.hidden && now - lastRaf > 250) tick(now);
  }, 50);
}
