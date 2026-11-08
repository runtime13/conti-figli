// Dettaglio del conto di un figlio: saldo, obiettivo, totali dell'anno, elenco movimenti.
import { osservaFiglio, osservaMovimenti, impostaObiettivo } from '../dati.js';
import {
  saldo, anniDisponibili, movimentiAnno, totaliAnno, formattaEuro, etichettaCategoria,
} from '../calcoli.js';
import { el, avviso, conferma } from '../ui.js';
import { nodoSaldo, nodoObiettivo } from './comuni.js';
import { apriDialogObiettivo } from './obiettivo.js';

export function montaConto(contenitore, contesto) {
  const { figlioId } = contesto;
  const genitore = contesto.ruolo === 'genitore';
  let figlio;            // undefined = in caricamento, null = non trovato
  let movimenti = null;
  let anno = new Date().getFullYear();

  function bloccoObiettivo(s) {
    const azioni = el('div', { class: 'riga-azioni' },
      el('button', { class: 'pulsante', onclick: () => apriDialogObiettivo(figlio) },
        figlio.obiettivo ? 'Modifica obiettivo' : 'Imposta obiettivo'),
      figlio.obiettivo ? el('button', {
        class: 'pulsante pericolo',
        onclick: async () => {
          if (!(await conferma('Rimuovere l’obiettivo?', 'Rimuovi'))) return;
          try { await impostaObiettivo(figlio.id, null); } catch { avviso('Salvataggio non riuscito, riprova', 'errore'); }
        },
      }, 'Rimuovi') : null,
    );
    return el('section', { class: 'scheda' },
      el('h3', {}, 'Obiettivo di risparmio'),
      nodoObiettivo(s, figlio.obiettivo) ?? el('p', { class: 'tenue' }, 'Nessun obiettivo impostato.'),
      azioni,
    );
  }

  function bloccoTotali() {
    const t = totaliAnno(movimenti, anno);
    const righe = (gruppo) => Object.entries(gruppo)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, cent]) => el('tr', {}, el('td', {}, etichettaCategoria(cat)), el('td', { class: 'importo' }, formattaEuro(cent))));
    return el('section', { class: 'scheda' },
      el('h3', {}, `Totali ${anno}`),
      el('table', { class: 'totali' },
        el('tbody', {},
          righe(t.entratePerCategoria),
          el('tr', { class: 'somma' }, el('td', {}, 'Totale entrate'), el('td', { class: 'importo' }, formattaEuro(t.totaleEntrate))),
          righe(t.uscitePerCategoria),
          el('tr', { class: 'somma' }, el('td', {}, 'Totale uscite'), el('td', { class: 'importo' }, formattaEuro(t.totaleUscite))),
          el('tr', { class: 'somma' }, el('td', {}, 'Netto dell’anno'),
            el('td', { class: `importo${t.netto < 0 ? ' negativo' : ''}` }, formattaEuro(t.netto))),
        ),
      ),
    );
  }

  function rigaMovimento(m) {
    const [, mese, giorno] = m.data.split('-');
    const apri = () => contesto.vai(`#/conto/${encodeURIComponent(figlioId)}/movimento/${encodeURIComponent(m.id)}`);
    return el('li', {
      class: `movimento${genitore ? ' cliccabile' : ''}`,
      ...(genitore ? { onclick: apri, tabindex: 0, role: 'button', onkeydown: (e) => { if (e.key === 'Enter') apri(); } } : {}),
    },
      el('span', { class: 'data' }, `${giorno}/${mese}`),
      el('span', { class: 'descrizione' },
        el('div', { class: 'categoria' }, etichettaCategoria(m.categoria), m.inAttesa ? ' ⏲' : ''),
        m.nota ? el('div', { class: 'nota' }, m.nota) : null,
      ),
      el('span', { class: `importo ${m.tipo}` }, `${m.tipo === 'uscita' ? '−' : '+'}${formattaEuro(m.importoCent)}`),
    );
  }

  function disegna() {
    if (figlio === undefined || movimenti === null) return;
    if (figlio === null) {
      contenitore.replaceChildren(el('div', { class: 'vuoto' }, el('p', {}, 'Conto non trovato.'),
        genitore ? el('a', { class: 'pulsante', href: '#/' }, 'Torna ai figli') : null));
      return;
    }
    const s = saldo(movimenti);
    const anni = anniDisponibili(movimenti);
    if (!anni.includes(anno)) anno = anni[0];
    const selettoreAnno = el('select', {
      'aria-label': 'Anno',
      onchange: (e) => { anno = Number(e.target.value); disegna(); },
    }, anni.map((a) => el('option', { value: a, selected: a === anno }, String(a))));
    const elenco = movimentiAnno(movimenti, anno);

    contenitore.replaceChildren(...[
      el('section', { class: 'scheda', style: { borderLeft: `6px solid ${figlio.colore || 'var(--primario)'}` } },
        el('div', { class: 'intestazione-conto' }, el('h1', {}, figlio.nome), el('span', { class: 'tenue' }, 'Saldo')),
        nodoSaldo(s, 'saldo-grande'),
      ),
      bloccoObiettivo(s),
      el('div', { class: 'intestazione-conto', style: { margin: '20px 0 10px' } },
        el('h2', { style: { margin: 0, fontSize: '1.1rem' } }, 'Movimenti'), selettoreAnno),
      bloccoTotali(),
      el('section', { class: 'scheda' },
        elenco.length
          ? el('ul', { class: 'movimenti' }, elenco.map(rigaMovimento))
          : el('p', { class: 'vuoto' }, `Nessun movimento nel ${anno}.`),
      ),
      genitore ? el('button', {
        class: 'fab', 'aria-label': 'Nuovo movimento', title: 'Nuovo movimento',
        onclick: () => contesto.vai(`#/conto/${encodeURIComponent(figlioId)}/nuovo`),
      }, '+') : null,
    ].filter(Boolean));
  }

  const staccaFiglio = osservaFiglio(figlioId, (f) => { figlio = f; if (f === null) contesto.pronto(); disegna(); }, contesto.errore);
  const staccaMovimenti = osservaMovimenti(figlioId, (m) => { movimenti = m; contesto.pronto(); disegna(); }, contesto.errore);
  return () => { staccaFiglio(); staccaMovimenti(); };
}
