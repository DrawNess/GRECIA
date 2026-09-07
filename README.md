# Grecia

Dedicatoria interactiva en pixel art. Web estática, sin servidor.

```sh
pnpm install     # una vez
pnpm dev         # abre http://localhost:5173
pnpm build       # genera dist/
pnpm hash "TEXTO"  # sha256 para las respuestas de src/content/gate.ts
```

Se publica solo en GitHub Pages al hacer `git push` a `main`
(ver `.github/workflows/deploy.yml`). Plan y estado: `PLAN.md`.
