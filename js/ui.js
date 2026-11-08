// Piccoli aiuti per costruire il DOM in sicurezza (mai innerHTML con i dati).

// el('a', { class: 'x', href: '#', onclick: fn }, 'testo', altroNodo)
export function el(tag, attributi = {}, ...figli) {
  const nodo = document.createElement(tag);
  for (const [chiave, valore] of Object.entries(attributi ?? {})) {
    if (valore === null || valore === undefined || valore === false) continue;
    if (chiave.startsWith('on') && typeof valore === 'function') nodo.addEventListener(chiave.slice(2), valore);
    else if (chiave === 'style' && typeof valore === 'object') {
      for (const [proprieta, v] of Object.entries(valore)) {
        // Le variabili CSS (--nome) si impostano solo con setProperty.
        if (proprieta.startsWith('--')) nodo.style.setProperty(proprieta, v);
        else nodo.style[proprieta] = v;
      }
    }
    else if (valore === true) nodo.setAttribute(chiave, '');
    else nodo.setAttribute(chiave, String(valore));
  }
  for (const figlio of figli.flat()) {
    if (figlio === null || figlio === undefined || figlio === false) continue;
    nodo.append(figlio instanceof Node ? figlio : document.createTextNode(String(figlio)));
  }
  return nodo;
}

export function avviso(messaggio, tipo = 'ok') {
  const contenitore = document.getElementById('avvisi');
  const nodo = el('div', { class: `avviso ${tipo}`, role: tipo === 'errore' ? 'alert' : 'status' }, messaggio);
  contenitore.append(nodo);
  setTimeout(() => nodo.remove(), 4000);
}

export function conferma(messaggio, testoConferma = 'Conferma') {
  return new Promise((risolvi) => {
    const dialog = el('dialog', {},
      el('p', {}, messaggio),
      el('div', { class: 'riga-azioni', style: { justifyContent: 'flex-end' } },
        el('button', { class: 'pulsante', value: 'no', onclick: () => dialog.close('no') }, 'Annulla'),
        el('button', { class: 'pulsante primario', value: 'si', onclick: () => dialog.close('si') }, testoConferma),
      ),
    );
    dialog.addEventListener('close', () => { risolvi(dialog.returnValue === 'si'); dialog.remove(); });
    document.body.append(dialog);
    dialog.showModal();
  });
}
