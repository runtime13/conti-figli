// Test delle funzioni pure di calcolo (saldo, totali, obiettivo, formattazione)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIE, etichettaCategoria, euroInCent, formattaEuro, oggiISO, normalizzaEmail,
  importoConSegno, saldo, anniDisponibili, movimentiAnno, totaliAnno, avanzamentoObiettivo,
} from '../js/calcoli.js';

test('euroInCent', () => {
  assert.equal(euroInCent('12,50'), 1250);
  assert.equal(euroInCent('1.234,50'), 123450);
  assert.equal(euroInCent('1234.5'), 123450);
  assert.equal(euroInCent(' 400 '), 40000);
  assert.equal(euroInCent('0,05'), 5);
  assert.equal(euroInCent('0'), null);
  assert.equal(euroInCent('-5'), null);
  assert.equal(euroInCent('abc'), null);
  assert.equal(euroInCent(''), null);
  assert.equal(euroInCent('12,345'), null); // più di due decimali
});

test('formattaEuro', () => {
  assert.equal(formattaEuro(123456), '1.234,56 €');
  assert.equal(formattaEuro(500), '5,00 €');
  assert.equal(formattaEuro(0), '0,00 €');
  assert.equal(formattaEuro(-40000), '−400,00 €');
  assert.equal(formattaEuro(123456789), '1.234.567,89 €');
});

test('oggiISO usa la data locale', () => {
  assert.equal(oggiISO(new Date(2026, 0, 1, 0, 30)), '2026-01-01');
  assert.equal(oggiISO(new Date(2026, 11, 31, 23, 59)), '2026-12-31');
});

test('normalizzaEmail', () =>
  assert.equal(normalizzaEmail(' Luca.Rossi@Gmail.com '), 'luca.rossi@gmail.com'));

const M = [
  { id: 'a', data: '2025-12-20', importoCent: 5000, tipo: 'entrata', categoria: 'regalo-natale' },
  { id: 'b', data: '2026-01-31', importoCent: 40000, tipo: 'uscita', categoria: 'quota-casa' },
  { id: 'c', data: '2026-01-15', importoCent: 8500, tipo: 'entrata', categoria: 'spesa-casa-pagata' },
  { id: 'd', data: '2026-02-01', importoCent: 30000, tipo: 'entrata', categoria: 'versamento' },
];

test('importoConSegno', () => {
  assert.equal(importoConSegno(M[0]), 5000);
  assert.equal(importoConSegno(M[1]), -40000);
});

test('saldo', () => {
  assert.equal(saldo(M), 3500);
  assert.equal(saldo([]), 0);
});

test('anniDisponibili', () => {
  assert.deepEqual(anniDisponibili(M, new Date(2026, 5, 1)), [2026, 2025]);
  assert.deepEqual(anniDisponibili([], new Date(2026, 5, 1)), [2026]);
});

test('movimentiAnno ordina dal più recente', () =>
  assert.deepEqual(movimentiAnno(M, 2026).map((m) => m.id), ['d', 'b', 'c']));

test('movimentiAnno a parità di data usa creatoIl decrescente', () => {
  const stessi = [
    { id: 'x', data: '2026-03-01', importoCent: 1, tipo: 'entrata', categoria: 'paghetta', creatoIl: { seconds: 10 } },
    { id: 'y', data: '2026-03-01', importoCent: 1, tipo: 'entrata', categoria: 'paghetta', creatoIl: { seconds: 20 } },
    { id: 'z', data: '2026-03-01', importoCent: 1, tipo: 'entrata', categoria: 'paghetta', creatoIl: null },
  ];
  // creatoIl null = scrittura appena fatta, non ancora confermata dal server: va in cima
  assert.deepEqual(movimentiAnno(stessi, 2026).map((m) => m.id), ['z', 'y', 'x']);
});

test('totaliAnno', () => assert.deepEqual(totaliAnno(M, 2026), {
  entratePerCategoria: { 'spesa-casa-pagata': 8500, versamento: 30000 },
  uscitePerCategoria: { 'quota-casa': 40000 },
  totaleEntrate: 38500, totaleUscite: 40000, netto: -1500,
}));

test('avanzamentoObiettivo', () => {
  const o = { descrizione: 'Bici', importoCent: 30000 };
  assert.deepEqual(avanzamentoObiettivo(12000, o), { percentuale: 40, raggiunto: false, mancanteCent: 18000 });
  assert.deepEqual(avanzamentoObiettivo(-500, o), { percentuale: 0, raggiunto: false, mancanteCent: 30500 });
  assert.deepEqual(avanzamentoObiettivo(35000, o), { percentuale: 100, raggiunto: true, mancanteCent: 0 });
  assert.equal(avanzamentoObiettivo(1000, null), null);
});

test('avanzamentoObiettivo non mostra 100% se mancano ancora dei centesimi', () => {
  const o = { descrizione: 'Bici', importoCent: 30000 };
  assert.deepEqual(avanzamentoObiettivo(29960, o), { percentuale: 99, raggiunto: false, mancanteCent: 40 });
});

test('etichettaCategoria e CATEGORIE', () => {
  assert.equal(etichettaCategoria('quota-casa'), 'Quota casa');
  assert.equal(etichettaCategoria('spesa-casa-pagata'), 'Spesa di casa pagata');
  assert.equal(etichettaCategoria('boh'), 'boh');
  assert.deepEqual(CATEGORIE.entrata.map((c) => c.id), [
    'saldo-iniziale', 'paghetta', 'regalo-compleanno', 'regalo-natale',
    'altro-regalo', 'versamento', 'spesa-casa-pagata', 'altra-entrata',
  ]);
  assert.deepEqual(CATEGORIE.uscita.map((c) => c.id), ['prelievo', 'quota-casa', 'altra-uscita']);
});
