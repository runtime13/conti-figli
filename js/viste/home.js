// Home del genitore: una scheda per figlio con saldo e obiettivo.
import { osservaFigli, osservaMovimenti } from '../dati.js';
import { saldo } from '../calcoli.js';
import { el } from '../ui.js';
import { nodoSaldo, nodoObiettivo } from './comuni.js';

export function montaHome(contenitore, contesto) {
  let figli = null;
  const movimentiPerFiglio = new Map();
  const listenerMovimenti = new Map();

  function disegna() {
    if (!figli) return;
    if (figli.length === 0) {
      contenitore.replaceChildren(el('div', { class: 'vuoto' },
        el('p', {}, 'Nessun figlio inserito.'),
        el('a', { class: 'pulsante primario', href: '#/impostazioni' }, 'Aggiungi i figli da Impostazioni'),
      ));
      return;
    }
    contenitore.replaceChildren(...figli.map((f) => {
      const movimenti = movimentiPerFiglio.get(f.id);
      const s = movimenti ? saldo(movimenti) : null;
      return el('a', {
        class: 'scheda', href: `#/conto/${encodeURIComponent(f.id)}`, style: { '--colore': f.colore || '' },
      },
        el('h2', {}, f.nome),
        s === null ? el('div', { class: 'tenue' }, 'Caricamento…') : nodoSaldo(s),
        s === null ? null : nodoObiettivo(s, f.obiettivo),
      );
    }));
  }

  const staccaFigli = osservaFigli((elenco) => {
    figli = elenco;
    contesto.pronto();
    const ids = new Set(elenco.map((f) => f.id));
    for (const [id, stacca] of listenerMovimenti) {
      if (!ids.has(id)) { stacca(); listenerMovimenti.delete(id); movimentiPerFiglio.delete(id); }
    }
    for (const f of elenco) {
      if (listenerMovimenti.has(f.id)) continue;
      listenerMovimenti.set(f.id, osservaMovimenti(f.id, (movimenti) => {
        movimentiPerFiglio.set(f.id, movimenti);
        disegna();
      }, contesto.errore));
    }
    disegna();
  }, contesto.errore);

  return () => {
    staccaFigli();
    for (const stacca of listenerMovimenti.values()) stacca();
  };
}
