// Impostazioni (solo genitori): aggiunta e modifica dei figli.
import { osservaFigli, salvaFiglio } from '../dati.js';
import { normalizzaEmail } from '../calcoli.js';
import { el, avviso } from '../ui.js';

const EMAIL_VALIDA = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const COLORI = ['#3b82f6', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6'];

export function montaImpostazioni(contenitore, contesto) {
  let figli = [];
  let inModifica = null; // id del figlio in modifica, 'nuovo', oppure null

  function modulo(figlio) {
    const nome = el('input', { id: 'f-nome', required: true, maxlength: 40, value: figlio?.nome ?? '' });
    const email = el('input', { id: 'f-email', type: 'email', required: true, autocomplete: 'off', value: figlio?.email ?? '' });
    const colore = el('input', { id: 'f-colore', type: 'color', value: figlio?.colore ?? COLORI[figli.length % COLORI.length] });
    const erroreEmail = el('div', { class: 'errore-campo' });
    const salva = el('button', { class: 'pulsante primario', type: 'submit' }, 'Salva');
    return el('form', {
      class: 'scheda',
      onsubmit: (evento) => {
        evento.preventDefault();
        const indirizzo = normalizzaEmail(email.value);
        if (!EMAIL_VALIDA.test(indirizzo)) { erroreEmail.textContent = 'Indirizzo email non valido'; return; }
        if (figli.some((f) => f.email === indirizzo && f.id !== figlio?.id)) {
          erroreEmail.textContent = 'Questo indirizzo è già usato da un altro figlio'; return;
        }
        erroreEmail.textContent = '';
        if (!nome.value.trim()) { nome.focus(); return; }
        // Scrittura applicata subito in locale; il server conferma quando può.
        salvaFiglio(figlio?.id ?? null, { nome: nome.value, email: indirizzo, colore: colore.value })
          .catch(() => avviso('Salvataggio non riuscito, riprova', 'errore'));
        inModifica = null;
        disegna();
      },
    },
      el('h3', {}, figlio ? `Modifica ${figlio.nome}` : 'Nuovo figlio'),
      el('div', { class: 'campo' }, el('label', { for: 'f-nome' }, 'Nome'), nome),
      el('div', { class: 'campo' }, el('label', { for: 'f-email' }, 'Email Google'), email, erroreEmail),
      el('div', { class: 'campo' }, el('label', { for: 'f-colore' }, 'Colore'), colore),
      el('div', { class: 'riga-azioni', style: { justifyContent: 'flex-end' } },
        el('button', { class: 'pulsante', type: 'button', onclick: () => { inModifica = null; disegna(); } }, 'Annulla'),
        salva,
      ),
    );
  }

  function disegna() {
    contenitore.replaceChildren(
      el('h1', { style: { fontSize: '1.4rem', marginTop: 0 } }, 'Impostazioni'),
      el('p', { class: 'tenue' }, 'Ogni figlio entra con questo account Google e vede solo il proprio conto.'),
      ...figli.map((f) => (inModifica === f.id ? modulo(f) : el('section', {
        class: 'scheda', style: { borderLeft: `6px solid ${f.colore}` },
      },
        el('h3', {}, f.nome),
        el('div', { class: 'tenue' }, f.email),
        el('div', { class: 'riga-azioni' },
          el('button', { class: 'pulsante', onclick: () => { inModifica = f.id; disegna(); } }, 'Modifica')),
      ))),
      inModifica === 'nuovo'
        ? modulo(null)
        : el('button', { class: 'pulsante primario', onclick: () => { inModifica = 'nuovo'; disegna(); } }, 'Aggiungi figlio'),
    );
  }

  return osservaFigli((elenco) => {
    figli = elenco;
    contesto.pronto();
    // Non ridisegna mentre si sta compilando un modulo, per non perdere quanto scritto.
    if (inModifica === null) disegna();
  }, contesto.errore);
}
