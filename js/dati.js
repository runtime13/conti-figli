// Unico punto di accesso a Firebase (Auth + Firestore). Le viste non importano Firebase direttamente.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, connectAuthEmulator,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator,
  doc, getDoc, getDocs, collection, query, where, limit, onSnapshot, addDoc, updateDoc, deleteDoc,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { normalizzaEmail } from './calcoli.js';

const inLocale = ['localhost', '127.0.0.1'].includes(location.hostname);

// In locale si usa l'emulatore anche senza configurazione reale.
export const configurato = Boolean(firebaseConfig.apiKey) || inLocale;

let auth = null;
let db = null;

if (configurato) {
  const app = initializeApp(firebaseConfig.apiKey ? firebaseConfig : { apiKey: 'demo', projectId: 'demo-conti-figli' });
  auth = getAuth(app);
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  if (inLocale) {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);
  }
}

// --- Accesso ---

export async function entraConGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(auth, provider);
}

export function esci() {
  return signOut(auth);
}

export function osservaUtente(cb) {
  return onAuthStateChanged(auth, cb);
}

export async function determinaRuolo(user) {
  const genitore = await getDoc(doc(db, 'genitori', user.uid));
  if (genitore.exists()) return { ruolo: 'genitore' };
  if (user.email && user.emailVerified) {
    const q = query(collection(db, 'figli'), where('email', '==', normalizzaEmail(user.email)), limit(1));
    const risultato = await getDocs(q).catch(() => null);
    if (risultato && !risultato.empty) return { ruolo: 'figlio', figlioId: risultato.docs[0].id };
  }
  return { ruolo: 'nessuno' };
}

// --- Letture in tempo reale ---

const conId = (d) => ({ id: d.id, ...d.data() });

export function osservaFigli(cb, errore) {
  return onSnapshot(collection(db, 'figli'), (snap) => {
    cb(snap.docs.map(conId).sort((a, b) => a.nome.localeCompare(b.nome, 'it')));
  }, errore);
}

export function osservaFiglio(figlioId, cb, errore) {
  return onSnapshot(doc(db, 'figli', figlioId), (d) => cb(d.exists() ? conId(d) : null), errore);
}

export function osservaMovimenti(figlioId, cb, errore) {
  return onSnapshot(
    collection(db, 'figli', figlioId, 'movimenti'),
    { includeMetadataChanges: true },
    (snap) => {
      const movimenti = snap.docs.map((d) => ({
        ...conId(d),
        creatoIl: d.data({ serverTimestamps: 'none' }).creatoIl ?? null,
        inAttesa: d.metadata.hasPendingWrites,
      }));
      cb(movimenti, snap.metadata.hasPendingWrites);
    },
    errore,
  );
}

// --- Scritture ---

const campiMovimento = ({ data, importoCent, tipo, categoria, nota }) =>
  ({ data, importoCent, tipo, categoria, nota: nota ?? '' });

export async function aggiungiMovimento(figlioId, movimento) {
  await addDoc(collection(db, 'figli', figlioId, 'movimenti'), {
    ...campiMovimento(movimento),
    creatoDa: auth.currentUser.uid,
    creatoIl: serverTimestamp(),
  });
}

export async function modificaMovimento(figlioId, movId, movimento) {
  await updateDoc(doc(db, 'figli', figlioId, 'movimenti', movId), campiMovimento(movimento));
}

export async function eliminaMovimento(figlioId, movId) {
  await deleteDoc(doc(db, 'figli', figlioId, 'movimenti', movId));
}

export async function impostaObiettivo(figlioId, obiettivo) {
  await updateDoc(doc(db, 'figli', figlioId), {
    obiettivo: obiettivo ? { descrizione: obiettivo.descrizione, importoCent: obiettivo.importoCent } : null,
  });
}

export async function salvaFiglio(figlioId, { nome, email, colore }) {
  const campi = { nome: nome.trim(), email: normalizzaEmail(email), colore };
  if (figlioId) await updateDoc(doc(db, 'figli', figlioId), campi);
  else await addDoc(collection(db, 'figli'), { ...campi, obiettivo: null });
}
