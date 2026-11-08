// Modulo per inserire, modificare o eliminare un movimento (solo genitori).
import { aggiungiMovimento, modificaMovimento, eliminaMovimento, osservaMovimenti } from '../dati.js';
import { CATEGORIE, euroInCent, oggiISO } from '../calcoli.js';
import { el, avviso, conferma } from '../ui.js';

export function montaMovimento(contenitore, contesto) {
  const { figlioId, movId } = contesto;
  const indietro = () => contesto.vai(`#/conto/${encodeURIComponent(figlioId)}`);
  let tipo = 'entrata';

  const data = el('input', { id: 'mv-data', type: 'date', required: true, value: oggiISO() });
  const importo = el('input', { id: 'mv-importo', inputmode: 'decimal', required: true, placeholder: '0,00', autocomplete: 'off' });
  const erroreImporto = el('div', { class: 'errore-campo' });
  const categoria = el('select', { id: 'mv-categoria' });
  const nota = el('input', { id: 'mv-nota', maxlength: 120, placeholder: 'Es. nonna Rita, scarpe da calcio…' });
  const pulsanteEntrata = el('button', { type: 'button', class: 'entrata', onclick: () => impostaTipo('entrata') }, 'Entrata');
  const pulsanteUscita = el('button', { type: 'button', class: 'uscita', onclick: () => impostaTipo('uscita') }, 'Uscita');
  const salva = el('button', { class: 'pulsante primario', type: 'submit' }, 'Salva');

  function impostaTipo(nuovo, categoriaScelta) {
    tipo = nuovo;
    pulsanteEntrata.setAttribute('aria-pressed', String(tipo === 'entrata'));
    pulsanteUscita.setAttribute('aria-pressed', String(tipo === 'uscita'));
    categoria.replaceChildren(...CATEGORIE[tipo].map((c) => el('option', { value: c.id }, c.etichetta)));
    if (categoriaScelta) categoria.value = categoriaScelta;
  }
  impostaTipo('entrata');

  const elimina = movId ? el('button', {
    class: 'pulsante pericolo', type: 'button',
    onclick: async () => {
      if (!(await conferma('Eliminare questo movimento?', 'Elimina'))) return;
      try {
        await eliminaMovimento(figlioId, movId);
        indietro();
      } catch {
        avviso('Eliminazione non riuscita, riprova', 'errore');
      }
    },
  }, 'Elimina') : null;

  const modulo = el('form', {
    class: 'scheda',
    onsubmit: async (evento) => {
      evento.preventDefault();
      const cent = euroInCent(importo.value);
      if (cent === null) { erroreImporto.textContent = 'Importo non valido'; importo.focus(); return; }
      erroreImporto.textContent = '';
      const valori = { data: data.value, importoCent: cent, tipo, categoria: categoria.value, nota: nota.value.trim() };
      salva.disabled = true;
      try {
        // Offline la scrittura resta in coda e viene inviata appena torna la connessione:
        // non si aspetta la conferma del server per tornare al conto.
        const scrittura = movId ? modificaMovimento(figlioId, movId, valori) : aggiungiMovimento(figlioId, valori);
        if (!navigator.onLine) { scrittura.catch(() => avviso('Salvataggio non riuscito', 'errore')); indietro(); return; }
        await scrittura;
        indietro();
      } catch {
        avviso('Salvataggio non riuscito, riprova', 'errore');
      } finally {
        salva.disabled = false;
      }
    },
  },
    el('h1', { style: { marginTop: 0, fontSize: '1.3rem' } }, movId ? 'Modifica movimento' : 'Nuovo movimento'),
    el('div', { class: 'campo' }, el('span', { class: 'etichetta' }, 'Tipo'),
      el('div', { class: 'interruttore', role: 'group', 'aria-label': 'Tipo' }, pulsanteEntrata, pulsanteUscita)),
    el('div', { class: 'campo' }, el('label', { for: 'mv-importo' }, 'Importo (€)'), importo, erroreImporto),
    el('div', { class: 'campo' }, el('label', { for: 'mv-categoria' }, 'Categoria'), categoria),
    el('div', { class: 'campo' }, el('label', { for: 'mv-data' }, 'Data'), data),
    el('div', { class: 'campo' }, el('label', { for: 'mv-nota' }, 'Nota'), nota),
    el('div', { class: 'riga-azioni', style: { justifyContent: 'space-between' } },
      elimina ?? el('span'),
      el('div', { class: 'riga-azioni', style: { marginTop: 0 } },
        el('button', { class: 'pulsante', type: 'button', onclick: indietro }, 'Annulla'),
        salva,
      ),
    ),
  );

  if (!movId) {
    contesto.pronto();
    contenitore.replaceChildren(modulo);
    importo.focus();
    return () => {};
  }

  // Modifica: precompila una sola volta, poi non sovrascrive ciò che l'utente sta scrivendo.
  let precompilato = false;
  const stacca = osservaMovimenti(figlioId, (movimenti) => {
    if (precompilato) return;
    contesto.pronto();
    const m = movimenti.find((x) => x.id === movId);
    if (!m) {
      contenitore.replaceChildren(el('div', { class: 'vuoto' }, el('p', {}, 'Movimento non trovato.'),
        el('button', { class: 'pulsante', onclick: indietro }, 'Torna al conto')));
      return;
    }
    precompilato = true;
    impostaTipo(m.tipo, m.categoria);
    data.value = m.data;
    importo.value = (m.importoCent / 100).toFixed(2).replace('.', ',');
    nota.value = m.nota ?? '';
    contenitore.replaceChildren(modulo);
  }, contesto.errore);
  return stacca;
}
