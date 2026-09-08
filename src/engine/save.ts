// Progreso guardado en el navegador de ella. Sin servidor.
const KEY = 'grecia:v1';

export interface Save {
  unlocked?: boolean;
  muted?: boolean;
}

export function loadSave(): Save {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Save;
  } catch {
    return {};
  }
}

export function writeSave(patch: Save): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...loadSave(), ...patch }));
  } catch {
    /* modo privado o storage lleno: seguimos sin guardar */
  }
}

export function resetSave(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignorar */ }
}
