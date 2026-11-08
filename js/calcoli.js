// Funzioni pure di calcolo: nessuna dipendenza da Firebase o dal DOM.
// Tutti gli importi sono interi in centesimi; il segno lo dà il campo `tipo`.

export const CATEGORIE = {
  entrata: [
    { id: 'saldo-iniziale', etichetta: 'Saldo iniziale' },
    { id: 'paghetta', etichetta: 'Paghetta' },
    { id: 'regalo-compleanno', etichetta: 'Regalo di compleanno' },
    { id: 'regalo-natale', etichetta: 'Regalo di Natale' },
    { id: 'altro-regalo', etichetta: 'Altro regalo' },
    { id: 'versamento', etichetta: 'Versamento' },
    { id: 'spesa-casa-pagata', etichetta: 'Spesa di casa pagata' },
    { id: 'altra-entrata', etichetta: 'Altra entrata' },
  ],
  uscita: [
    { id: 'prelievo', etichetta: 'Prelievo' },
    { id: 'quota-casa', etichetta: 'Quota casa' },
    { id: 'altra-uscita', etichetta: 'Altra uscita' },
  ],
};

const ETICHETTE = new Map(
  [...CATEGORIE.entrata, ...CATEGORIE.uscita].map((c) => [c.id, c.etichetta]),
);

export function etichettaCategoria(id) {
  return ETICHETTE.get(id) ?? id;
}

// Accetta "12,50", "1.234,50", "1234.5", "400". Restituisce null se non valido o non positivo.
export function euroInCent(testo) {
  const t = String(testo ?? '').trim();
  let intera;
  let decimali = '';
  let m;
  if ((m = t.match(/^(\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/))) {
    intera = m[1].replaceAll('.', '');
    decimali = m[2] ?? '';
  } else if ((m = t.match(/^(\d+)(?:[,.](\d{1,2}))?$/))) {
    intera = m[1];
    decimali = m[2] ?? '';
  } else {
    return null;
  }
  const cent = Number(intera) * 100 + Number(decimali.padEnd(2, '0'));
  return Number.isSafeInteger(cent) && cent > 0 ? cent : null;
}

// 123456 -> "1.234,56 €"; i negativi usano il segno meno tipografico (U+2212).
export function formattaEuro(cent) {
  const assoluto = Math.abs(Math.round(cent));
  const intera = String(Math.floor(assoluto / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimali = String(assoluto % 100).padStart(2, '0');
  return `${cent < 0 ? '−' : ''}${intera},${decimali} €`;
}

// Data locale (non UTC) nel formato AAAA-MM-GG.
export function oggiISO(data = new Date()) {
  const a = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const g = String(data.getDate()).padStart(2, '0');
  return `${a}-${m}-${g}`;
}

export function normalizzaEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

export function importoConSegno(mov) {
  return mov.tipo === 'uscita' ? -mov.importoCent : mov.importoCent;
}

export function saldo(movimenti) {
  return movimenti.reduce((somma, m) => somma + importoConSegno(m), 0);
}

const annoDi = (mov) => Number(mov.data.slice(0, 4));

export function anniDisponibili(movimenti, oggi = new Date()) {
  const anni = new Set(movimenti.map(annoDi));
  anni.add(oggi.getFullYear());
  return [...anni].sort((a, b) => b - a);
}

// creatoIl null = scrittura locale non ancora confermata: è la più recente.
const secondiCreazione = (m) => m.creatoIl?.seconds ?? Number.POSITIVE_INFINITY;

export function movimentiAnno(movimenti, anno) {
  return movimenti
    .filter((m) => annoDi(m) === anno)
    .sort((a, b) => b.data.localeCompare(a.data) || secondiCreazione(b) - secondiCreazione(a));
}

export function totaliAnno(movimenti, anno) {
  const totali = {
    entratePerCategoria: {},
    uscitePerCategoria: {},
    totaleEntrate: 0,
    totaleUscite: 0,
    netto: 0,
  };
  for (const m of movimenti) {
    if (annoDi(m) !== anno) continue;
    const entrata = m.tipo === 'entrata';
    const gruppo = entrata ? totali.entratePerCategoria : totali.uscitePerCategoria;
    gruppo[m.categoria] = (gruppo[m.categoria] ?? 0) + m.importoCent;
    if (entrata) totali.totaleEntrate += m.importoCent;
    else totali.totaleUscite += m.importoCent;
  }
  totali.netto = totali.totaleEntrate - totali.totaleUscite;
  return totali;
}

export function avanzamentoObiettivo(saldoCent, obiettivo) {
  if (!obiettivo) return null;
  const percentuale = Math.min(100, Math.max(0, Math.floor((saldoCent / obiettivo.importoCent) * 100)));
  return {
    percentuale,
    raggiunto: saldoCent >= obiettivo.importoCent,
    mancanteCent: Math.max(0, obiettivo.importoCent - saldoCent),
  };
}
