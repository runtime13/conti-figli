# Conti figli — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA in cui i genitori registrano entrate e uscite dei tre figli e ogni figlio vede in tempo reale solo il proprio conto, potendo impostare il proprio obiettivo di risparmio.

**Architecture:** App statica senza build (moduli ES) pubblicata su GitHub Pages; Firebase Auth (Google) e Firestore con listener `onSnapshot`. Tutta la logica numerica sta in funzioni pure (`js/calcoli.js`) testate con `node:test`; tutta la sicurezza sta in `firestore.rules` testate con l'emulatore. Le viste sono moduli che ricevono dati e callback e restituiscono DOM.

**Tech Stack:** HTML/CSS/JS ES2022, Firebase JS SDK 10.12.2 da `https://www.gstatic.com/firebasejs/10.12.2/`, Node ≥ 20 (`node --test`), `firebase-tools` + `@firebase/rules-unit-testing` (solo sviluppo), Java ≥ 11 per l'emulatore.

**Spec:** `docs/superpowers/specs/2026-11-08-conti-figli-design.md`

## Global Constraints

- Lingua di interfaccia, commenti e documentazione: italiano.
- Importi sempre interi in centesimi (`importoCent`, intero > 0); il segno lo dà `tipo` (`entrata`/`uscita`).
- Formato importi a video: `1.234,56 €`; negativi `−1.234,56 €` in rosso con etichetta "da restituire" sul saldo.
- Date dei movimenti: stringa `AAAA-MM-GG` in ora locale.
- Categorie entrata: `saldo-iniziale` (Saldo iniziale), `paghetta` (Paghetta), `regalo-compleanno` (Regalo di compleanno), `regalo-natale` (Regalo di Natale), `altro-regalo` (Altro regalo), `versamento` (Versamento), `spesa-casa-pagata` (Spesa di casa pagata), `altra-entrata` (Altra entrata).
- Categorie uscita: `prelievo` (Prelievo), `quota-casa` (Quota casa), `altra-uscita` (Altra uscita).
- Limiti: `nota` ≤ 120 caratteri; `obiettivo.descrizione` ≤ 60; `obiettivo.importoCent` intero 1–10.000.000.
- Nessun blocco sul saldo negativo.
- Tutti i percorsi nell'HTML, nel manifest e nel service worker sono relativi (l'app vive in `/conti-figli/`).
- Mai committare credenziali o chiavi di account di servizio; `js/firebase-config.js` (config web pubblica) sì.
- Ogni commit termina con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Importo digitato all'italiana** (`12,50`, `1.234,50`, `1234.5`, `0`, `abc`) → `euroInCent` restituisce 1250, 123450, 123450, `null`, `null`. Test in Task 1.
2. **Data "oggi" vicino alla mezzanotte** → il valore predefinito deve essere la data locale, non quella UTC di `toISOString()`. Test `oggiISO` in Task 1.
3. **Email del figlio con maiuscole** (registrata `Luca.Rossi@gmail.com`, token `luca.rossi@gmail.com`) → l'app salva l'email in minuscolo e le regole confrontano con `.lower()`. Test in Task 1 (`normalizzaEmail`) e Task 2.
4. **Conto vuoto o saldo negativo con obiettivo** → saldo 0 / anni = [anno corrente]; percentuale obiettivo bloccata a 0 e mai sopra 100. Test in Task 1.
5. **Accesso dalla PWA installata** → `signInWithPopup` (il redirect non funziona su domini diversi da `firebaseapp.com` nei browser recenti); se il popup è bloccato, messaggio "Consenti i popup o apri l'app nel browser". Verifica manuale in Task 7.

---

### Task 1: Scheletro del progetto e calcoli puri

**Files:**
- Create: `package.json`, `.gitignore`, `js/calcoli.js`, `test/calcoli.test.js`

**Interfaces:**
- Produces (tutte esportate da `js/calcoli.js`):
  - `CATEGORIE: { entrata: Array<{id:string, etichetta:string}>, uscita: Array<{id,etichetta}> }` (valori da Global Constraints)
  - `etichettaCategoria(id: string): string` (id sconosciuto → id stesso)
  - `euroInCent(testo: string): number | null`
  - `formattaEuro(cent: number): string`
  - `oggiISO(data?: Date): string`
  - `normalizzaEmail(email: string): string` (trim + minuscolo)
  - `importoConSegno(mov: {tipo, importoCent}): number`
  - `saldo(movimenti: Mov[]): number`
  - `anniDisponibili(movimenti: Mov[], oggi?: Date): number[]` (decrescenti, include sempre l'anno corrente)
  - `movimentiAnno(movimenti: Mov[], anno: number): Mov[]` (ordinati per `data` desc, poi `creatoIl` desc)
  - `totaliAnno(movimenti: Mov[], anno: number): { entratePerCategoria: Record<string,number>, uscitePerCategoria: Record<string,number>, totaleEntrate: number, totaleUscite: number, netto: number }`
  - `avanzamentoObiettivo(saldoCent: number, obiettivo: {descrizione, importoCent} | null): { percentuale: number, raggiunto: boolean, mancanteCent: number } | null`
  - `Mov = { id, data: 'AAAA-MM-GG', importoCent, tipo: 'entrata'|'uscita', categoria, nota, creatoIl?: {seconds:number}|null }`

- [ ] **Step 1: Crea `package.json`** con `"type": "module"`, `"private": true`, script `"test": "node --test test/calcoli.test.js"` e `"test:regole": "firebase emulators:exec --only firestore \"node --test test/regole.test.js\""`. `.gitignore`: `node_modules/`, `.env*`, `*-debug.log`, `service-account*.json`.

- [ ] **Step 2: Scrivi i test che falliscono** in `test/calcoli.test.js` (`node:test` + `node:assert/strict`):

```js
test('euroInCent', () => {
  assert.equal(euroInCent('12,50'), 1250);
  assert.equal(euroInCent('1.234,50'), 123450);
  assert.equal(euroInCent('1234.5'), 123450);
  assert.equal(euroInCent(' 400 '), 40000);
  assert.equal(euroInCent('0'), null);
  assert.equal(euroInCent('-5'), null);
  assert.equal(euroInCent('abc'), null);
  assert.equal(euroInCent('12,345'), null); // più di due decimali
});
test('formattaEuro', () => {
  assert.equal(formattaEuro(123456), '1.234,56 €');
  assert.equal(formattaEuro(500), '5,00 €');
  assert.equal(formattaEuro(-40000), '−400,00 €');
});
test('oggiISO usa la data locale', () => {
  assert.equal(oggiISO(new Date(2026, 0, 1, 0, 30)), '2026-01-01');
});
test('normalizzaEmail', () => assert.equal(normalizzaEmail(' Luca.Rossi@Gmail.com '), 'luca.rossi@gmail.com'));
const M = [
  { id:'a', data:'2025-12-20', importoCent:5000,  tipo:'entrata', categoria:'regalo-natale' },
  { id:'b', data:'2026-01-31', importoCent:40000, tipo:'uscita',  categoria:'quota-casa' },
  { id:'c', data:'2026-01-15', importoCent:8500,  tipo:'entrata', categoria:'spesa-casa-pagata' },
  { id:'d', data:'2026-02-01', importoCent:30000, tipo:'entrata', categoria:'versamento' },
];
test('saldo', () => { assert.equal(saldo(M), 3500); assert.equal(saldo([]), 0); });
test('anniDisponibili', () => {
  assert.deepEqual(anniDisponibili(M, new Date(2026, 5, 1)), [2026, 2025]);
  assert.deepEqual(anniDisponibili([], new Date(2026, 5, 1)), [2026]);
});
test('movimentiAnno ordina dal più recente', () =>
  assert.deepEqual(movimentiAnno(M, 2026).map(m => m.id), ['d', 'b', 'c']));
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
test('etichettaCategoria', () => {
  assert.equal(etichettaCategoria('quota-casa'), 'Quota casa');
  assert.equal(etichettaCategoria('boh'), 'boh');
});
```

- [ ] **Step 3: Esegui** `npm test` → FAIL (modulo `js/calcoli.js` mancante).

- [ ] **Step 4: Implementa `js/calcoli.js`.** `euroInCent`: accetta solo `^\d{1,3}(\.\d{3})+(,\d{1,2})?$`, `^\d+(,\d{1,2})?$` o `^\d+(\.\d{1,2})?$` (il punto seguito da 3 cifre è separatore delle migliaia), converte senza `parseFloat` (separa parte intera e decimali), risultato 0 → `null`. `formattaEuro`: costruisci la stringa a mano (raggruppamento a 3 con `.`, sempre 2 decimali, segno `−` U+2212) — non usare `Intl` perché `it-IT` non raggruppa le cifre sotto 10.000. `percentuale` = `Math.round(saldo / obiettivo * 100)` limitato a 0–100; `mancanteCent` = `max(0, obiettivo − saldo)`.

- [ ] **Step 5: Esegui** `npm test` → tutti PASS.

- [ ] **Step 6: Commit** `feat: calcoli di saldo, totali e obiettivo`.

---

### Task 2: Regole Firestore con test sull'emulatore

**Files:**
- Create: `firestore.rules`, `firebase.json`, `.firebaserc`, `test/regole.test.js`

**Interfaces:**
- Consumes: modello dati della spec; categorie da Global Constraints (ripetute nelle regole come lista letterale).
- Produces: `firestore.rules` pubblicabile.

- [ ] **Step 1: Prerequisiti.** Esegui `java -version` (≥ 11) e `node --version` (≥ 20). Se Java manca, fermati e chiedi all'utente di installarlo (Temurin 21). Poi `npm i -D firebase-tools @firebase/rules-unit-testing firebase@10.12.2`. `firebase.json`: `{ "firestore": { "rules": "firestore.rules" }, "emulators": { "firestore": { "port": 8080 }, "auth": { "port": 9099 } } }`; `.firebaserc` con progetto predefinito `demo-conti-figli` (i progetti `demo-*` non richiedono login).

- [ ] **Step 2: Scrivi i test che falliscono** in `test/regole.test.js` con `initializeTestEnvironment({ projectId: 'demo-conti-figli', firestore: { rules: readFileSync('firestore.rules','utf8') } })`. Dati di partenza (con `withSecurityRulesDisabled`): `genitori/papa`, `genitori/mamma`; `figli/f1 {nome:'Luca', email:'luca@gmail.com', colore:'#3b82f6', obiettivo:null}`, `figli/f2 {nome:'Anna', email:'anna@gmail.com', colore:'#ec4899', obiettivo:null}`, un movimento valido in ciascuno. Contesti: `papa` e `mamma` (`authenticatedContext(uid)`), `luca` (`authenticatedContext('u-luca', { email: 'Luca@gmail.com', email_verified: true })`), `lucaNonVerificato` (`email_verified: false`), `estraneo` (email non registrata, verificata), `anonimo` (`unauthenticatedContext`). Casi (`assertSucceeds`/`assertFails`):
  - `papa` e `mamma`: leggono `figli/f1`, `figli/f2`, i movimenti; creano/modificano/cancellano movimenti validi; creano `figli/f3`.
  - movimento non valido rifiutato anche al genitore: `importoCent: 12.5`, `importoCent: 0`, `tipo: 'boh'`, `categoria: 'quota-casa'` con `tipo: 'entrata'`, `nota` di 121 caratteri, `data: '8/11/2026'`.
  - `luca`: legge `figli/f1` e i suoi movimenti; la query `collection('figli').where('email','==','luca@gmail.com')` riesce; legge `figli/f2` → FAIL; query su tutta `figli` → FAIL; crea/modifica/cancella un movimento in `f1` → FAIL; `update(figli/f1, {obiettivo:{descrizione:'Bici', importoCent:30000}})` → OK; `update(figli/f1, {obiettivo:null})` → OK; `update(figli/f1, {nome:'X'})` → FAIL; obiettivo con `importoCent: 0` o descrizione di 61 caratteri → FAIL; obiettivo su `figli/f2` → FAIL.
  - `lucaNonVerificato`, `estraneo`, `anonimo`: nessuna lettura di `figli/**` → FAIL.
  - `genitori/{uid}`: ognuno può leggere il proprio documento (anche se non esiste) → OK; `estraneo` legge `genitori/papa` → FAIL; nessuno (nemmeno `papa`) scrive in `genitori` → FAIL.

- [ ] **Step 3: Esegui** `npm run test:regole` → FAIL (regole mancanti).

- [ ] **Step 4: Scrivi `firestore.rules`** (`rules_version = '2'`) con funzioni `eGenitore()` (`exists(/databases/$(database)/documents/genitori/$(request.auth.uid))`), `emailUtente()` (`request.auth.token.email.lower()`, usata solo se `request.auth.token.email_verified == true`), `eFiglio(dati)` (`dati.email == emailUtente()`), `movimentoValido(d)` (chiavi ammesse esatte, tipi, `importoCent is int && > 0`, `tipo` in lista, categoria nella lista del proprio tipo, `nota.size() <= 120`, `data.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')`), `obiettivoValido(o)` (`o == null` o mappa con sole chiavi `descrizione` (string ≤ 60) e `importoCent` (int 1–10000000)), `figlioValido(d)` (genitore: chiavi `nome`, `email`, `colore`, `obiettivo`). Sui movimenti il figlio legge con `get(/databases/$(database)/documents/figli/$(figlioId)).data`. `genitori/{uid}`: `allow get: if request.auth.uid == uid || eGenitore()`; nessuna scrittura dal client.

- [ ] **Step 5: Esegui** `npm run test:regole` → tutti PASS.

- [ ] **Step 6: Commit** `feat: regole Firestore con test sull'emulatore`.

---

### Task 3: Accesso ai dati Firestore

**Files:**
- Create: `js/firebase-config.js`, `js/dati.js`

**Interfaces:**
- Consumes: `normalizzaEmail` (Task 1).
- Produces (da `js/dati.js`, su un'unica istanza inizializzata con `firebaseConfig` da `js/firebase-config.js`, `initializeFirestore(app, { localCache: persistentLocalCache() })` per l'offline e, quando `location.hostname === 'localhost'`, `connectFirestoreEmulator(db,'localhost',8080)` + `connectAuthEmulator(auth,'http://localhost:9099')`):
  - `configurato: boolean` (false se `firebaseConfig.apiKey` manca)
  - `entraConGoogle(): Promise<void>` (`signInWithPopup` + `GoogleAuthProvider`; gli errori `auth/popup-blocked`, `auth/popup-closed-by-user` arrivano al chiamante con il loro `code`)
  - `esci(): Promise<void>`
  - `osservaUtente(cb: (user | null) => void): () => void`
  - `determinaRuolo(user): Promise<{ ruolo: 'genitore' } | { ruolo: 'figlio', figlioId: string } | { ruolo: 'nessuno' }>`
  - `osservaFigli(cb: (figli: Figlio[]) => void, errore: (e) => void): () => void` (ordinati per `nome`)
  - `osservaFiglio(figlioId, cb: (Figlio | null) => void, errore): () => void`
  - `osservaMovimenti(figlioId, cb: (movimenti: Mov[], daSincronizzare: boolean) => void, errore): () => void` (con `includeMetadataChanges`; ogni `Mov` ha anche `inAttesa: boolean` = `doc.metadata.hasPendingWrites`)
  - `aggiungiMovimento(figlioId, {data, importoCent, tipo, categoria, nota}): Promise<void>` (aggiunge `creatoDa: auth.currentUser.uid`, `creatoIl: serverTimestamp()`)
  - `modificaMovimento(figlioId, movId, {data, importoCent, tipo, categoria, nota}): Promise<void>`, `eliminaMovimento(figlioId, movId): Promise<void>`
  - `impostaObiettivo(figlioId, obiettivo | null): Promise<void>`
  - `salvaFiglio(figlioId | null, {nome, email, colore}): Promise<void>` (email passata da `normalizzaEmail`; nuovo figlio con `obiettivo: null`)
  - `Figlio = { id, nome, email, colore, obiettivo }`

- [ ] **Step 1:** Crea `js/firebase-config.js` con `export const firebaseConfig = {};` e un commento che spiega che va compilato in Task 7 con la config web (pubblica) del progetto.
- [ ] **Step 2:** Implementa `js/dati.js` importando dal CDN 10.12.2 (`firebase-app.js`, `firebase-auth.js`, `firebase-firestore.js`). Nessun altro modulo importa Firebase direttamente. Le scritture del figlio (solo `impostaObiettivo`) e del genitore usano gli stessi metodi: la differenza la fanno le regole.
- [ ] **Step 3: Verifica** `node --check js/dati.js` → nessun errore di sintassi. (Il comportamento si verifica dal browser in Task 5–7; le regole sono già coperte in Task 2.)
- [ ] **Step 4: Commit** `feat: livello di accesso ai dati Firestore`.

---

### Task 4: Guscio dell'app, accesso e navigazione

**Files:**
- Create: `index.html`, `css/app.css`, `js/app.js`, `js/ui.js`, `js/viste/accesso.js`

**Interfaces:**
- Consumes: `dati.js` (Task 3).
- Produces:
  - `js/ui.js`: `el(tag, attributi?, ...figli): HTMLElement` (testo sempre via `textContent`, mai `innerHTML` con dati), `avviso(messaggio: string, tipo?: 'errore'|'ok')` (toast non bloccante, 4 s), `conferma(messaggio): Promise<boolean>` (`<dialog>`).
  - `js/app.js`: router su hash — `#/` (home genitore; per il figlio redirect a `#/conto/{figlioId}`), `#/conto/{id}`, `#/conto/{id}/nuovo`, `#/conto/{id}/movimento/{movId}`, `#/impostazioni`. Stato `contesto = { user, ruolo, figlioId? }`. Ogni vista: `montaX(contenitore: HTMLElement, contesto): () => void` (restituisce la funzione che stacca i listener; il router la chiama al cambio rotta). Un figlio che naviga verso rotte da genitore o verso il conto di un altro viene rimandato al proprio conto.
  - `js/viste/accesso.js`: `montaAccesso(contenitore, { ruolo })` — pulsante "Entra con Google"; con `ruolo === 'nessuno'` mostra "Questo account non è abilitato" + "Esci"; popup bloccato → "Consenti i popup o apri l'app nel browser"; `configurato === false` → "Configurazione Firebase mancante".

- [ ] **Step 1:** `index.html` con `<meta name="viewport">`, `<link rel="manifest" href="manifest.webmanifest">`, `<meta name="theme-color">`, intestazione con titolo "Conti figli" e menu (Impostazioni solo per il genitore, Esci), `<main id="app">`, `<script type="module" src="js/app.js">`.
- [ ] **Step 2:** `css/app.css` con variabili colore su `:root` e `@media (prefers-color-scheme: dark)`, colonna singola max 640 px, `--entrata` (verde) e `--uscita` (rosso), pulsante "+" fisso in basso a destra, indicatore di caricamento, etichetta "Offline" (`navigator.onLine` + eventi `online`/`offline`).
- [ ] **Step 3:** In `app.js`, se una vista non riceve dati entro 10 s mostra "Impossibile caricare i dati" con "Riprova" (rimonta la vista).
- [ ] **Step 4: Verifica** con `npx serve .` e il browser: nessun errore non gestito in console; con config vuota compare "Configurazione Firebase mancante"; con l'emulatore Auth avviato (`npx firebase emulators:start --only firestore,auth`) l'accesso con un utente di prova senza ruolo mostra "Questo account non è abilitato".
- [ ] **Step 5: Commit** `feat: guscio dell'app, accesso e navigazione`.

---

### Task 5: Home genitore e dettaglio conto con obiettivo

**Files:**
- Create: `js/viste/home.js`, `js/viste/conto.js`, `js/viste/obiettivo.js`

**Interfaces:**
- Consumes: `osservaFigli`, `osservaFiglio`, `osservaMovimenti`, `impostaObiettivo` (Task 3); `saldo`, `anniDisponibili`, `movimentiAnno`, `totaliAnno`, `avanzamentoObiettivo`, `formattaEuro`, `etichettaCategoria`, `euroInCent` (Task 1); `el`, `avviso`, `conferma` (Task 4).
- Produces: `montaHome(contenitore, contesto)`, `montaConto(contenitore, contesto & { figlioId })`, `apriDialogObiettivo(figlio: Figlio): void`.

- [ ] **Step 1: Home** — una scheda per figlio (bordo del suo `colore`): nome, saldo (`formattaEuro`; se < 0 rosso con "da restituire"), se c'è obiettivo descrizione + barra + "X% di Y". Un `osservaMovimenti` per figlio, tutti staccati allo smontaggio. Nessun figlio → "Aggiungi i figli da Impostazioni".
- [ ] **Step 2: Conto** — nome e saldo grande; blocco obiettivo (barra, "Ti mancano X" o "Obiettivo raggiunto!", "Imposta obiettivo"/"Modifica" e "Rimuovi" con `conferma`) visibile ai genitori e al figlio proprietario; selettore anno (`anniDisponibili`, predefinito anno corrente); riquadro totali dell'anno (righe per categoria con `etichettaCategoria`, totale entrate, totale uscite, netto); elenco `movimentiAnno` con data `GG/MM`, categoria, nota, importo con segno e colore; movimenti `inAttesa` con icona orologio. Solo genitore: pulsante "+" → `#/conto/{id}/nuovo`, tocco su riga → `#/conto/{id}/movimento/{movId}`; per il figlio le righe non sono cliccabili.
- [ ] **Step 3: Dialog obiettivo** — descrizione (maxlength 60) e importo in euro (`euroInCent`; `null` → errore inline "Importo non valido"); salva con `impostaObiettivo`; errore → `avviso('Salvataggio non riuscito, riprova', 'errore')` e il dialog resta aperto.
- [ ] **Step 4: Verifica** nel browser con l'emulatore e dati di prova (genitore e figlio creati con la UI dell'emulatore Auth, documenti con la UI dell'emulatore Firestore): il saldo coincide con la somma attesa; il cambio anno aggiorna elenco e totali; il figlio imposta l'obiettivo e la barra si aggiorna in tempo reale nella scheda del genitore aperta in un'altra finestra.
- [ ] **Step 5: Commit** `feat: home genitore, dettaglio conto e obiettivo`.

---

### Task 6: Modulo movimento e impostazioni figli

**Files:**
- Create: `js/viste/movimento.js`, `js/viste/impostazioni.js`

**Interfaces:**
- Consumes: `aggiungiMovimento`, `modificaMovimento`, `eliminaMovimento`, `osservaFigli`, `osservaMovimenti`, `salvaFiglio` (Task 3); `CATEGORIE`, `euroInCent`, `oggiISO`, `normalizzaEmail` (Task 1); `el`, `avviso`, `conferma` (Task 4).
- Produces: `montaMovimento(contenitore, contesto & { figlioId, movId? })`, `montaImpostazioni(contenitore, contesto)`.

- [ ] **Step 1: Modulo movimento** — data (`<input type="date">`, predefinita `oggiISO()`), interruttore Entrata/Uscita, importo (`inputmode="decimal"`, `euroInCent`; `null` → "Importo non valido"), categoria (opzioni da `CATEGORIE[tipo]`; al cambio tipo si torna alla prima), nota (maxlength 120). Salva → torna a `#/conto/{id}`; errore → `avviso` e il modulo resta compilato. In modifica precompila e mostra "Elimina" (con `conferma('Eliminare questo movimento?')`).
- [ ] **Step 2: Impostazioni** — elenco figli con modifica; modulo nome, email Google, colore (`<input type="color">`); email validata con `/^[^@\s]+@[^@\s]+\.[^@\s]+$/` e salvata con `normalizzaEmail`. Testo a video: "Ogni figlio entra con questo account Google e vede solo il proprio conto".
- [ ] **Step 3: Verifica** nell'emulatore: aggiungere tre figli; inserire "Saldo iniziale" 120 €, "Quota casa" 400 € (uscita), "Spesa di casa pagata" 85,50 € → saldo `−194,50 €` "da restituire"; modificare ed eliminare un movimento; con il conto aperto in un'altra finestra i cambiamenti compaiono senza ricaricare.
- [ ] **Step 4: Commit** `feat: modulo movimenti e impostazioni figli`.

---

### Task 7: PWA, pubblicazione e collegamento a Firebase

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `icons/icona-192.png`, `icons/icona-512.png`, `icons/icona-maskable-512.png`, `README.md`
- Modify: `js/app.js` (registrazione del service worker), `js/firebase-config.js`, `.firebaserc`, `CLAUDE.md` (link al piano)

**Interfaces:**
- Consumes: tutti i file dell'app.

- [ ] **Step 1: Manifest** — `name` "Conti figli", `short_name` "Conti", `start_url` "./", `scope` "./", `display` "standalone", `lang` "it", colori coerenti con `app.css`, le tre icone (la maskable con `purpose: "maskable"`), generate da un SVG semplice (salvadanaio con "€").
- [ ] **Step 2: Service worker** — `const VERSIONE = 'v1'`; precache di HTML, CSS, JS, manifest e icone (percorsi relativi) e dei moduli SDK da `gstatic.com/firebasejs/10.12.2/`; stale-while-revalidate per questi file; nessuna intercettazione di altre richieste (Firestore e Auth passano diretti); in `activate` cancella le cache con versione diversa. Registrazione in `js/app.js` solo se `'serviceWorker' in navigator` e non su `localhost`.
- [ ] **Step 3: README** — cos'è l'app, avvio locale con l'emulatore, comandi di test, guida passo passo "Configurazione a carico dell'utente" della spec.
- [ ] **Step 4: Configurazione Firebase (con l'utente).** Guida l'utente a creare il progetto con il suo account Google personale, attivare Auth → Google e Firestore (località `eur3`), registrare l'app web e passare la config. Inserisci la config in `js/firebase-config.js`, aggiungi il progetto reale come alias `prod` in `.firebaserc` e pubblica le regole con `npx firebase deploy --only firestore:rules --project prod` (per il login chiedi all'utente di eseguire `! npx firebase login`).
- [ ] **Step 5: GitHub Pages (chiedi conferma prima di creare il repo e pubblicare).** `gh repo create runtime13/conti-figli --public --source . --push` (Pages gratuito richiede repo pubblico: il codice non contiene dati né segreti, i dati stanno su Firestore); abilita Pages da `main` cartella `/`; aggiungi `runtime13.github.io` ai domini autorizzati di Firebase Auth.
- [ ] **Step 6: Verifica finale con l'utente:**
  - `npm test` e `npm run test:regole` → tutti PASS.
  - Papà e mamma entrano e vedono "Questo account non è abilitato"; si creano `genitori/{uid}` dalla console; dopo il ricaricamento vedono la home.
  - Inserimento dei tre figli e dei saldi iniziali.
  - Un figlio entra dal suo telefono: vede solo il suo conto, imposta un obiettivo, vede comparire entro pochi secondi un movimento inserito dal genitore; installa l'app ("Aggiungi a schermata Home") e l'accesso dalla PWA installata funziona.
  - Modalità aereo: l'app si apre con gli ultimi dati e l'etichetta "Offline".
- [ ] **Step 7: Commit e push** `feat: PWA, pubblicazione e configurazione Firebase`.
