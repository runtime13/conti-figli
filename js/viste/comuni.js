// Elementi grafici condivisi tra home e dettaglio conto.
import { formattaEuro, avanzamentoObiettivo } from '../calcoli.js';
import { el } from '../ui.js';

export function nodoSaldo(saldoCent, classe = 'saldo') {
  const negativo = saldoCent < 0;
  return el('div', {},
    el('div', { class: `importo ${classe}${negativo ? ' negativo' : ''}` }, formattaEuro(saldoCent)),
    negativo ? el('div', { class: 'nota-saldo' }, 'da restituire') : null,
  );
}

export function nodoObiettivo(saldoCent, obiettivo) {
  const av = avanzamentoObiettivo(saldoCent, obiettivo);
  if (!av) return null;
  return el('div', { class: 'obiettivo' },
    el('div', { class: 'tenue' },
      `Obiettivo: ${obiettivo.descrizione} · ${av.percentuale}% di ${formattaEuro(obiettivo.importoCent)}`),
    el('div', {
      class: 'barra', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': av.percentuale,
    }, el('span', { style: { width: `${av.percentuale}%` } })),
    el('div', { class: av.raggiunto ? '' : 'tenue' },
      av.raggiunto ? 'Obiettivo raggiunto!' : `Ti mancano ${formattaEuro(av.mancanteCent)}`),
  );
}
