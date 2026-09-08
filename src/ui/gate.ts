import { gate } from '../content/gate';
import { sha256 } from '../engine/hash';

const normalize = (v: string) => v.normalize('NFC').trim().replace(/\s+/g, ' ');

export function mountGate(root: HTMLElement, iconUrl: string, onUnlocked: () => void): void {
  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.innerHTML = `
    <header class="panel__head">
      <img class="sprig" src="${iconUrl}" alt="">
      <h1 class="title">${gate.title}</h1>
      <p class="subtitle">${location.hash === '#again' ? gate.subtitleAgain : gate.subtitle}</p>
    </header>
    <div class="rule"></div>
    <form class="step" id="step-name" autocomplete="off" novalidate>
      <label for="name">${gate.namePrompt}</label>
      <input id="name" type="text" placeholder="${gate.namePlaceholder}"
        autocapitalize="characters" autocorrect="off" spellcheck="false" autofocus>
      <p class="msg" aria-live="polite"></p>
      <p class="hint">${gate.enterHint}</p>
    </form>
    <form class="step is-hidden" id="step-date" autocomplete="off" novalidate>
      <label for="date">${gate.datePrompt}</label>
      <input id="date" type="text" inputmode="numeric" placeholder="${gate.datePlaceholder}"
        maxlength="10" spellcheck="false">
      <p class="msg" aria-live="polite"></p>
      <p class="hint">${gate.enterHint}</p>
    </form>`;
  root.appendChild(panel);

  const stepName = panel.querySelector<HTMLFormElement>('#step-name')!;
  const stepDate = panel.querySelector<HTMLFormElement>('#step-date')!;
  const nameInput = panel.querySelector<HTMLInputElement>('#name')!;
  const dateInput = panel.querySelector<HTMLInputElement>('#date')!;
  let current: HTMLInputElement = nameInput;

  // Teclado primero: cualquier clic en la escena devuelve el foco al campo.
  root.parentElement?.addEventListener('pointerdown', (e) => {
    if (!(e.target as HTMLElement).closest('input')) current.focus();
  });
  setTimeout(() => nameInput.focus(), 50);

  stepName.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = normalize(nameInput.value);
    if (!v) return;
    if (sha256(v) === gate.nameHash) {
      advance(stepName, gate.dateHash ? stepDate : null);
    } else if (sha256(v.toUpperCase()) === gate.nameHash) {
      fail(stepName, nameInput, gate.msgUppercase);
    } else {
      fail(stepName, nameInput, gate.msgWrongName);
    }
  });

  // Máscara DD/MM/AAAA mientras escribe.
  dateInput.addEventListener('input', () => {
    const d = dateInput.value.replace(/\D/g, '').slice(0, 8);
    dateInput.value =
      d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
      : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}`
      : d;
  });

  stepDate.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = dateInput.value;
    if (v.length < 10) return;
    if (sha256(v) === gate.dateHash) advance(stepDate, null);
    else fail(stepDate, dateInput, gate.msgWrongDate);
  });

  function fail(step: HTMLFormElement, input: HTMLInputElement, msg: string): void {
    step.querySelector('.msg')!.textContent = msg;
    step.classList.remove('is-shaking');
    void step.offsetWidth; // reinicia la animación
    step.classList.add('is-shaking');
    input.select();
  }

  function advance(from: HTMLFormElement, to: HTMLFormElement | null): void {
    from.querySelector('.msg')!.textContent = '';
    from.classList.add('is-leaving');
    setTimeout(() => {
      from.classList.add('is-hidden');
      if (to) {
        to.classList.remove('is-hidden');
        to.classList.add('is-entering');
        current = to.querySelector('input')!;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          to.classList.remove('is-entering');
          current.focus();
        }));
      } else {
        panel.classList.add('is-gone');
        setTimeout(() => { panel.remove(); onUnlocked(); }, 800);
      }
    }, 380);
  }
}

export function showCaption(root: HTMLElement, text: string, ms?: number): void {
  const p = document.createElement('p');
  p.className = 'caption';
  p.textContent = text;
  root.appendChild(p);
  setTimeout(() => p.classList.add('is-shown'), 400);
  if (ms) {
    setTimeout(() => p.classList.remove('is-shown'), ms);
    setTimeout(() => p.remove(), ms + 1500);
  }
}
