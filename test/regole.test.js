// Test delle regole di sicurezza Firestore sull'emulatore (npm run test:regole).
import test, { before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, query, where, serverTimestamp,
} from 'firebase/firestore';

let ambiente;

const movimento = (extra = {}) => ({
  data: '2026-11-08', importoCent: 1000, tipo: 'entrata', categoria: 'paghetta', nota: '',
  creatoDa: 'papa', creatoIl: serverTimestamp(), ...extra,
});

before(async () => {
  ambiente = await initializeTestEnvironment({
    projectId: 'demo-conti-figli',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});

after(() => ambiente.cleanup());

beforeEach(async () => {
  await ambiente.clearFirestore();
  await ambiente.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'genitori/papa'), { nome: 'Papà', email: 'papa@gmail.com' });
    await setDoc(doc(db, 'genitori/mamma'), { nome: 'Mamma', email: 'mamma@gmail.com' });
    await setDoc(doc(db, 'figli/f1'), { nome: 'Luca', email: 'luca@gmail.com', colore: '#3b82f6', obiettivo: null });
    await setDoc(doc(db, 'figli/f2'), { nome: 'Anna', email: 'anna@gmail.com', colore: '#ec4899', obiettivo: null });
    await setDoc(doc(db, 'figli/f1/movimenti/m1'), movimento());
    await setDoc(doc(db, 'figli/f2/movimenti/m1'), movimento());
  });
});

const papa = () => ambiente.authenticatedContext('papa', { email: 'papa@gmail.com', email_verified: true }).firestore();
const mamma = () => ambiente.authenticatedContext('mamma', { email: 'mamma@gmail.com', email_verified: true }).firestore();
const luca = () => ambiente.authenticatedContext('u-luca', { email: 'Luca@gmail.com', email_verified: true }).firestore();
const lucaNonVerificato = () => ambiente.authenticatedContext('u-luca2', { email: 'luca@gmail.com', email_verified: false }).firestore();
const estraneo = () => ambiente.authenticatedContext('u-x', { email: 'x@gmail.com', email_verified: true }).firestore();
const anonimo = () => ambiente.unauthenticatedContext().firestore();

// --- Genitori ---

for (const [nome, db] of [['papà', papa], ['mamma', mamma]]) {
  test(`${nome} legge tutti i figli e i movimenti`, async () => {
    await assertSucceeds(getDoc(doc(db(), 'figli/f1')));
    await assertSucceeds(getDoc(doc(db(), 'figli/f2')));
    await assertSucceeds(getDocs(collection(db(), 'figli')));
    await assertSucceeds(getDocs(collection(db(), 'figli/f2/movimenti')));
  });

  test(`${nome} crea, modifica ed elimina movimenti validi`, async () => {
    const rif = await assertSucceeds(addDoc(collection(db(), 'figli/f1/movimenti'),
      movimento({ tipo: 'uscita', categoria: 'quota-casa', importoCent: 40000 })));
    await assertSucceeds(updateDoc(rif, { importoCent: 35000, nota: 'corretto' }));
    await assertSucceeds(deleteDoc(rif));
  });
}

test('genitore crea e modifica un figlio', async () => {
  await assertSucceeds(setDoc(doc(papa(), 'figli/f3'), { nome: 'Marco', email: 'marco@gmail.com', colore: '#f59e0b', obiettivo: null }));
  await assertSucceeds(updateDoc(doc(mamma(), 'figli/f3'), { nome: 'Marco R.' }));
});

test('genitore non salva un figlio con campi non ammessi', async () => {
  await assertFails(setDoc(doc(papa(), 'figli/f3'), { nome: 'Marco', email: 'marco@gmail.com', colore: '#f59e0b', obiettivo: null, admin: true }));
});

test('movimenti non validi rifiutati anche al genitore', async () => {
  const c = collection(papa(), 'figli/f1/movimenti');
  await assertFails(addDoc(c, movimento({ importoCent: 12.5 })));
  await assertFails(addDoc(c, movimento({ importoCent: 0 })));
  await assertFails(addDoc(c, movimento({ importoCent: -100 })));
  await assertFails(addDoc(c, movimento({ tipo: 'boh' })));
  await assertFails(addDoc(c, movimento({ tipo: 'entrata', categoria: 'quota-casa' })));
  await assertFails(addDoc(c, movimento({ tipo: 'uscita', categoria: 'paghetta' })));
  await assertFails(addDoc(c, movimento({ nota: 'x'.repeat(121) })));
  await assertFails(addDoc(c, movimento({ data: '8/11/2026' })));
  await assertFails(addDoc(c, movimento({ extra: 1 })));
  await assertSucceeds(addDoc(c, movimento({ nota: 'x'.repeat(120) })));
});

// --- Figlio ---

test('figlio legge il proprio conto e i propri movimenti', async () => {
  await assertSucceeds(getDoc(doc(luca(), 'figli/f1')));
  await assertSucceeds(getDocs(collection(luca(), 'figli/f1/movimenti')));
  await assertSucceeds(getDocs(query(collection(luca(), 'figli'), where('email', '==', 'luca@gmail.com'))));
});

test('figlio non vede il conto degli altri', async () => {
  await assertFails(getDoc(doc(luca(), 'figli/f2')));
  await assertFails(getDocs(collection(luca(), 'figli/f2/movimenti')));
  await assertFails(getDocs(collection(luca(), 'figli')));
  await assertFails(getDocs(query(collection(luca(), 'figli'), where('email', '==', 'anna@gmail.com'))));
});

test('figlio non scrive movimenti', async () => {
  await assertFails(addDoc(collection(luca(), 'figli/f1/movimenti'), movimento()));
  await assertFails(updateDoc(doc(luca(), 'figli/f1/movimenti/m1'), { importoCent: 999999 }));
  await assertFails(deleteDoc(doc(luca(), 'figli/f1/movimenti/m1')));
});

test('figlio imposta e rimuove il proprio obiettivo', async () => {
  await assertSucceeds(updateDoc(doc(luca(), 'figli/f1'), { obiettivo: { descrizione: 'Bici', importoCent: 30000 } }));
  await assertSucceeds(updateDoc(doc(luca(), 'figli/f1'), { obiettivo: null }));
});

test('figlio non cambia altri campi né obiettivi non validi', async () => {
  await assertFails(updateDoc(doc(luca(), 'figli/f1'), { nome: 'X' }));
  await assertFails(updateDoc(doc(luca(), 'figli/f1'), { email: 'altro@gmail.com' }));
  await assertFails(updateDoc(doc(luca(), 'figli/f1'), { obiettivo: { descrizione: 'Bici', importoCent: 0 } }));
  await assertFails(updateDoc(doc(luca(), 'figli/f1'), { obiettivo: { descrizione: 'x'.repeat(61), importoCent: 100 } }));
  await assertFails(updateDoc(doc(luca(), 'figli/f1'), { obiettivo: { descrizione: 'Bici', importoCent: 10000001 } }));
  await assertFails(updateDoc(doc(luca(), 'figli/f1'), { obiettivo: { descrizione: 'Bici', importoCent: 100, extra: 1 } }));
  await assertFails(updateDoc(doc(luca(), 'figli/f2'), { obiettivo: { descrizione: 'Bici', importoCent: 100 } }));
  await assertFails(deleteDoc(doc(luca(), 'figli/f1')));
  await assertFails(setDoc(doc(luca(), 'figli/f9'), { nome: 'Luca2', email: 'luca@gmail.com', colore: '#000000', obiettivo: null }));
});

// --- Esterni ---

test('email non verificata, estranei e anonimi non vedono nulla', async () => {
  for (const db of [lucaNonVerificato, estraneo, anonimo]) {
    await assertFails(getDoc(doc(db(), 'figli/f1')));
    await assertFails(getDocs(collection(db(), 'figli/f1/movimenti')));
  }
});

// --- Documenti genitori ---

test('ognuno legge solo il proprio documento genitore, nessuno lo scrive', async () => {
  await assertSucceeds(getDoc(doc(papa(), 'genitori/papa')));
  await assertSucceeds(getDoc(doc(estraneo(), 'genitori/u-x'))); // non esiste, ma la lettura è permessa
  await assertSucceeds(getDoc(doc(luca(), 'genitori/u-luca')));
  await assertFails(getDoc(doc(estraneo(), 'genitori/papa')));
  await assertFails(setDoc(doc(estraneo(), 'genitori/u-x'), { nome: 'Io' }));
  await assertFails(setDoc(doc(papa(), 'genitori/nuovo'), { nome: 'Altro' }));
});
