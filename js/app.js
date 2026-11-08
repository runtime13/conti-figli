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

async function mostraRotta() {
  smonta();
  const { user, ruolo } = contesto;
  if (!user || !ruolo || ruolo === 'nessuno') {
    aggiornaMenu();
    smontaVistaCorrente = montaAccesso(contenitore, { ruolo });
    return;
  }

  let rotta = leggiRotta();
  // Un figlio vede solo il proprio conto.
  if (ruolo === 'figlio' && !(rotta.nome === 'conto' && rotta.figlioId === contesto.figlioId)) {
    location.replace(`#/conto/${encodeURIComponent(contesto.figlioId)}`);
    return;
  }

  aggiornaMenu();
  contenitore.replaceChildren(el('p', { class: 'caricamento' }, 'Caricamento…'));
  timerCaricamento = setTimeout(mostraErroreCaricamento, ATTESA_MASSIMA_MS);
  const montaVista = await VISTE[rotta.nome]();
  if (leggiRotta().nome !== rotta.nome) return; // l'utente ha già cambiato pagina
  rotta = leggiRotta();
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

if (!configurato) {
  mostraRotta();
} else {
  osservaUtente(async (user) => {
    contesto = { user, ruolo: null, figlioId: null };
    if (user) {
      contenitore.replaceChildren(el('p', { class: 'caricamento' }, 'Caricamento…'));
      try {
        const esito = await determinaRuolo(user);
        contesto = { user, ruolo: esito.ruolo, figlioId: esito.figlioId ?? null };
      } catch {
        contesto = { user, ruolo: 'nessuno', figlioId: null };
      }
    }
    mostraRotta();
  });
}
