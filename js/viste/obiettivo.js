// Finestra per impostare o modificare l'obiettivo di risparmio (genitori e figlio proprietario).
import { impostaObiettivo } from '../dati.js';
import { euroInCent } from '../calcoli.js';
import { el, avviso } from '../ui.js';

export function apriDialogObiettivo(figlio) {
  const attuale = figlio.obiettivo;
  const descrizione = el('input', {
    id: 'ob-descrizione', maxlength: 60, required: true, value: attuale?.descrizione ?? '', placeholder: 'Es. bicicletta',
  });
  const importo = el('input', {
    id: 'ob-importo', inputmode: 'decimal', required: true, placeholder: 'Es. 300',
    value: attuale ? String(attuale.importoCent / 100).replace('.', ',') : '',
  });
  const erroreImporto = el('div', { class: 'errore-campo' });
  const salva = el('button', { class: 'pulsante primario', type: 'submit' }, 'Salva');

  const dialog = el('dialog', {},
    el('form', {
      onsubmit: async (evento) => {
        evento.preventDefault();
        const cent = euroInCent(importo.value);
        if (cent === null || cent > 10_000_000) { erroreImporto.textContent = 'Importo non valido'; return; }
        const testo = descrizione.value.trim();
        if (!testo) return;
        erroreImporto.textContent = '';
        salva.disabled = true;
        try {
          await impostaObiettivo(figlio.id, { descrizione: testo, importoCent: cent });
          dialog.close();
        } catch {
          avviso('Salvataggio non riuscito, riprova', 'errore');
        } finally {
          salva.disabled = false;
        }
      },
    },
      el('h3', {}, attuale ? 'Modifica obiettivo' : 'Imposta obiettivo'),
      el('div', { class: 'campo' }, el('label', { for: 'ob-descrizione' }, 'Per cosa risparmi?'), descrizione),
      el('div', { class: 'campo' }, el('label', { for: 'ob-importo' }, 'Quanto serve (€)'), importo, erroreImporto),
      el('div', { class: 'riga-azioni', style: { justifyContent: 'flex-end' } },
        el('button', { class: 'pulsante', type: 'button', onclick: () => dialog.close() }, 'Annulla'),
        salva,
      ),
    ),
  );
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}
