// Schermata di accesso e messaggi per account non abilitati o configurazione mancante.
import { configurato, entraConGoogle, esci } from '../dati.js';
import { el } from '../ui.js';

export function montaAccesso(contenitore, { ruolo } = {}) {
  const messaggio = el('p', { class: 'errore-campo', role: 'alert' });

  if (!configurato) {
    contenitore.replaceChildren(el('section', { class: 'accesso' },
      el('h1', {}, 'Conti figli'),
      el('p', { class: 'tenue' }, 'Configurazione Firebase mancante: compila js/firebase-config.js.'),
    ));
    return () => {};
  }

  if (ruolo === 'nessuno') {
    contenitore.replaceChildren(el('section', { class: 'accesso' },
      el('h1', {}, 'Questo account non è abilitato'),
      el('p', { class: 'tenue' }, 'Chiedi a mamma o papà di aggiungere il tuo indirizzo Google, poi riprova.'),
      el('button', { class: 'pulsante', onclick: () => esci() }, 'Esci'),
    ));
    return () => {};
  }

  const pulsante = el('button', {
    class: 'pulsante primario',
    onclick: async () => {
      pulsante.disabled = true;
      messaggio.textContent = '';
      try {
        await entraConGoogle();
      } catch (e) {
        if (e?.code === 'auth/popup-blocked') messaggio.textContent = 'Consenti i popup o apri l’app nel browser.';
        else if (e?.code !== 'auth/popup-closed-by-user' && e?.code !== 'auth/cancelled-popup-request') {
          messaggio.textContent = 'Accesso non riuscito, riprova.';
        }
      } finally {
        pulsante.disabled = false;
      }
    },
  }, 'Entra con Google');

  contenitore.replaceChildren(el('section', { class: 'accesso' },
    el('h1', {}, 'Conti figli'),
    el('p', { class: 'tenue' }, 'Paghette, regali e spese, sempre aggiornati.'),
    pulsante,
    messaggio,
  ));
  return () => {};
}
