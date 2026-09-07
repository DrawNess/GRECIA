// Uso: pnpm hash "TEXTO EXACTO"  → imprime el sha256 para pegar en src/content/gate.ts
import { createHash } from 'node:crypto';
const text = process.argv.slice(2).join(' ');
if (!text) {
  console.error('Uso: pnpm hash "TEXTO EXACTO"');
  process.exit(1);
}
console.log(createHash('sha256').update(text, 'utf8').digest('hex'));
