import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas: funciona en usuario.github.io/grecia/ o en cualquier carpeta.
  base: './',
  build: {
    // Piso conservador para navegadores viejos en PCs de bajos recursos.
    target: 'es2020',
    assetsInlineLimit: 0,
  },
});
