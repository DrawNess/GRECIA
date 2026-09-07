# Grecia

Dedicatoria interactiva en pixel art. Web estática, sin servidor.

```sh
pnpm install       # una vez
pnpm dev           # abre http://localhost:5173
pnpm build         # genera dist/
pnpm hash "TEXTO"  # sha256 para las respuestas de src/content/gate.ts
```

- **Contexto completo del proyecto** (qué es, cómo funciona, contenido,
  pendientes, despliegue, cómo continuar en otra máquina): `docs/CONTEXTO.md`.
- **Estado por etapas**: `PLAN.md`.

Se publica solo en GitHub Pages al hacer `git push` a `main`
(ver `.github/workflows/deploy.yml` y la sección de despliegue en el contexto).
