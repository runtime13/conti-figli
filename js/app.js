// Avvio dell'app: accesso, determinazione del ruolo, navigazione su hash.
import { configurato, osservaUtente, determinaRuolo, esci } from './dati.js';
import { el } from './ui.js';
import { montaAccesso } from './viste/accesso.js';

const contenitore = document.getElementById('app');
const menu = document.getElementById('menu');
const etichettaOffline = document.getElementById('offline');

const ATTESA_MASSIMA_MS = 10_000;

let contesto = { user: null, ruolo: null, figlioId: null };
let smontaVistaCorrente = () => {};
let timerCaricamento = null;

// --- Offline ---
const aggiornaOffline = () => { etichettaOffline.hidden = navigator.onLine; };
addEventListener('online', aggiornaOffline);
addEventListener('offline', aggiornaOffline);
aggiornaOffline();

// --- Rotte ---
// #/  ·  #/conto/{id}  ·  #/conto/{id}/nuovo  ·  #/conto/{id}/movimento/{movId}  ·  #/impostazioni
function leggiRotta() {
  const parti = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parti[0] === 'conto' && parti[1]) {
    if (parti[2] === 'nuovo') return { nome: 'movimento', figlioId: parti[1] };
    if (parti[2] === 'movimento' && parti[3]) return { nome: 'movimento', figlioId: parti[1], movId: parti[3] };
    return { nome: 'conto', figlioId: parti[1] };
  }
  if (parti[0] === 'impostazioni') return { nome: 'impostazioni' };
  return { nome: 'home' };
}

export function vai(hash) {
  if (location.hash === hash) mostraRotta();
  else location.hash = hash;
}

const VISTE = {
  home: () => import('./viste/home.js').then((m) => m.montaHome),
  conto: () => import('./viste/conto.js').then((m) => m.montaConto),
  movimento: () => import('./viste/movimento.js').then((m) => m.montaMovimento),
  impostazioni: () => import('./viste/impostazioni.js').then((m) => m.montaImpostazioni),
};

function smonta() {
  clearTimeout(timerCaricamento);
  smontaVistaCorrente();
  smontaVistaCorrente = () => {};
}

function mostraErroreCaricamento() {
  smonta();
  contenitore.replaceChildren(el('div', { class: 'vuoto' },
    el('p', {}, 'Impossibile caricare i dati.'),
    el('button', { class: 'pulsante', onclick: () => mostraRotta() }, 'Riprova'),
  ));
}

// Ogni navigazione ha un numero: se nel frattempo ne è partita un'altra, quella vecchia si ferma
// (evita due viste montate insieme con listener mai staccati).
let turnoNavigazione = 0;

async function mostraRotta() {
  const turno = ++turnoNavigazione;
  smonta();
  const { user, ruolo } = contesto;
  if (user && ruolo === null) { // ruolo ancora in verifica
    contenitore.replaceChildren(el('p', { class: 'caricamento' }, 'Caricamento…'));
    return;
  }
  if (!user || ruolo === 'nessuno' || ruolo === 'errore') {
    aggiornaMenu();
    smontaVistaCorrente = montaAccesso(contenitore, { ruolo, riprova: verificaRuolo });
    return;
  }

  const rotta = leggiRotta();
  // Un figlio vede solo il proprio conto.
  if (ruolo === 'figlio' && !(rotta.nome === 'conto' && rotta.figlioId === contesto.figlioId)) {
    location.replace(`#/conto/${encodeURIComponent(contesto.figlioId)}`);
    return;
  }

  aggiornaMenu();
  contenitore.replaceChildren(el('p', { class: 'caricamento' }, 'Caricamento…'));
  timerCaricamento = setTimeout(mostraErroreCaricamento, ATTESA_MASSIMA_MS);
  let montaVista;
  try {
    montaVista = await VISTE[rotta.nome]();
  } catch {
    if (turno === turnoNavigazione) mostraErroreCaricamento();
    return;
  }
  if (turno !== turnoNavigazione) return; // nel frattempo l'utente ha cambiato pagina
  smontaVistaCorrente = montaVista(contenitore, {
    ...contesto,
    ...rotta,
    vai,
    pronto: () => clearTimeout(timerCaricamento),
    errore: () => mostraErroreCaricamento(),
  });
}

function aggiornaMenu() {
  const voci = [];
  if (contesto.ruolo === 'genitore') {
    voci.push(el('a', { class: 'pulsante piatto', href: '#/' }, 'Figli'));
    voci.push(el('a', { class: 'pulsante piatto', href: '#/impostazioni' }, 'Impostazioni'));
  }
  if (contesto.user) voci.push(el('button', { class: 'pulsante piatto', onclick: () => esci() }, 'Esci'));
  menu.replaceChildren(...voci);
}

addEventListener('hashchange', mostraRotta);

// Service worker (app installabile e apribile offline); non in locale, per non avere file vecchi in cache durante lo sviluppo.
// Quando una nuova versione prende il controllo, si ricarica la pagina per non mescolare moduli vecchi e nuovi.
if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  const avevaController = Boolean(navigator.serviceWorker.controller);
  let ricaricata = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (avevaController && !ricaricata) { ricaricata = true; location.reload(); }
  });
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Ogni cambio di utente ha un numero: una verifica del ruolo arrivata in ritardo per un utente
// precedente viene ignorata.
let turnoUtente = 0;

async function verificaRuolo() {
  const turno = ++turnoUtente;
  const { user } = contesto;
  contesto = { user, ruolo: null, figlioId: null };
  if (user) {
    mostraRotta();
    let nuovo;
    try {
      const esito = await determinaRuolo(user);
      nuovo = { user, ruolo: esito.ruolo, figlioId: esito.figlioId ?? null };
    } catch {
      // Errore di rete o temporaneo: non è un "account non abilitato".
      nuovo = { user, ruolo: 'errore', figlioId: null };
    }
    if (turno !== turnoUtente) return;
    contesto = nuovo;
  }
  mostraRotta();
}

if (!configurato) {
  mostraRotta();
} else {
  osservaUtente((user) => {
    contesto = { user, ruolo: null, figlioId: null };
    verificaRuolo();
  });
}
