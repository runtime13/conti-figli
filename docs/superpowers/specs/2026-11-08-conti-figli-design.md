# Conti figli — specifica di design

Data: 2026-11-08 · Stato: in revisione

## Scopo

Il papà tiene in contanti e poi in banca i soldi che i tre figli ricevono (paghette, regali di Natale e compleanno da familiari e genitori) e li preleva quando servono. Oggi la contabilità sta in una nota di Google Keep. L'obiettivo è uno strumento che:

- i genitori (papà e mamma) usano per registrare entrate e uscite di ciascun figlio;
- ogni figlio consulta in tempo reale dal telefono, vedendo **solo il proprio conto**.

**Successo:** ogni figlio apre l'app sul telefono e vede il saldo aggiornato pochi secondi dopo che un genitore ha inserito un movimento; nessun figlio può vedere il conto degli altri né modificare i movimenti.

**Fuori ambito:** importazione dello storico da Keep (si parte da un movimento "Saldo iniziale"; lo storico resta su Keep), paghetta automatica, esportazione CSV, pubblicazione su Play Store/APK (eventuale passo successivo).

## Tecnologia

- App statica HTML + CSS + JavaScript (moduli ES), senza build. SDK Firebase modulare caricato da CDN (`https://www.gstatic.com/firebasejs/<versione>/...`, versione fissata).
- PWA: `manifest.webmanifest`, icone, service worker che mette in cache i file dell'app (i dati arrivano da Firestore, che ha la propria cache offline).
- Hosting: GitHub Pages, repo `runtime13/conti-figli`.
- Firebase (piano gratuito Spark): Authentication con provider Google; Cloud Firestore con listener in tempo reale.
- La configurazione web di Firebase è pubblica e sta nel repo (`js/firebase-config.js`); la sicurezza è affidata alle regole Firestore.

## Modello dati (Firestore)

| Percorso | Campi | Note |
|---|---|---|
| `genitori/{uid}` | `nome` (string), `email` (string) | Un documento per genitore (papà e mamma). Creato a mano dalla console Firebase la prima volta. |
| `figli/{figlioId}` | `nome` (string), `email` (string, minuscola), `colore` (string), `obiettivo` (map o null: `descrizione` string ≤ 60 caratteri, `importoCent` int > 0) | Creato/modificato dai genitori dalla pagina Impostazioni. |
| `figli/{figlioId}/movimenti/{movId}` | `data` (string `AAAA-MM-GG`), `importoCent` (int > 0), `tipo` (`entrata`/`uscita`), `categoria` (vedi sotto), `nota` (string ≤ 120), `creatoDa` (uid), `creatoIl` (timestamp server) | Scritti solo dai genitori. |

Categorie: `saldo-iniziale`, `paghetta`, `regalo-compleanno`, `regalo-natale`, `altro-regalo`, `spesa` (prelievo per un acquisto), `altro`.

Gli importi sono interi in centesimi per evitare errori di arrotondamento. Saldo, totali e avanzamento dell'obiettivo sono **calcolati sul client** sommando i movimenti (poche centinaia per figlio): non esiste un saldo memorizzato che possa disallinearsi.

## Regole di sicurezza

- **Genitore** (esiste `genitori/{request.auth.uid}`): legge e scrive tutto in `figli/**`; legge `genitori/**`.
- **Figlio** (utente con `request.auth.token.email_verified == true` e email uguale a `figli/{figlioId}.email`):
  - legge il proprio documento `figli/{figlioId}` e i propri `movimenti`;
  - può aggiornare **solo il campo `obiettivo`** del proprio documento (`affectedKeys().hasOnly(['obiettivo'])`), con validazione di forma (null oppure `descrizione` stringa ≤ 60 e `importoCent` intero tra 1 e 10.000.000);
  - non può creare, modificare o cancellare movimenti, né leggere gli altri figli.
- **Chiunque altro**: nessun accesso.
- Validazione dei movimenti anche lato regole (tipi, `importoCent` intero positivo, `tipo` e `categoria` tra i valori ammessi).

## Schermate

1. **Accesso** — pulsante "Entra con Google". Dopo l'accesso l'app determina il ruolo: genitore se esiste `genitori/{uid}`; altrimenti figlio se una query `figli where email == <email>` restituisce un documento; altrimenti messaggio "Questo account non è abilitato" con pulsante Esci.
2. **Home genitore** — una scheda per figlio con nome, saldo e barra dell'obiettivo; tocco → dettaglio.
3. **Dettaglio conto** (genitore e figlio):
   - saldo in evidenza;
   - obiettivo: descrizione, barra `saldo / importo` (se superato: "Obiettivo raggiunto!"), pulsante "Imposta/modifica obiettivo" (disponibile sia ai genitori sia al figlio proprietario) e "Rimuovi obiettivo";
   - selettore anno; totali dell'anno: entrate per categoria, uscite, saldo netto dell'anno;
   - elenco movimenti dell'anno, dal più recente, con data, categoria, nota, importo (+ verde / − rosso).
   - Solo genitori: pulsante "+" per nuovo movimento; tocco su un movimento → modifica o elimina (con conferma).
4. **Modulo movimento** (solo genitori) — data (default oggi), entrata/uscita, importo in euro (convertito in centesimi), categoria (le opzioni dipendono dal tipo), nota. Un'uscita che porterebbe il saldo sotto zero mostra un avviso ma è consentita.
5. **Impostazioni** (solo genitori) — aggiunta/modifica figli (nome, email Google, colore).
6. **Vista figlio** — all'accesso il figlio va direttamente al proprio Dettaglio conto, in sola lettura tranne l'obiettivo.

Interfaccia in italiano, pensata per il telefono, tema chiaro/scuro automatico, importi in formato `1.234,56 €`.

## Struttura dei file

```
index.html
manifest.webmanifest
sw.js
icons/
css/app.css
js/firebase-config.js   configurazione web Firebase (pubblica)
js/app.js               avvio, accesso, determinazione del ruolo, navigazione
js/dati.js              lettura/scrittura Firestore (listener, CRUD movimenti, obiettivo, figli)
js/calcoli.js           funzioni pure: saldo, totali per anno/categoria, avanzamento obiettivo, formattazione importi
js/viste/*.js           una vista per schermata
firestore.rules
firebase.json           solo per l'emulatore nei test delle regole
test/calcoli.test.js    node:test
test/regole.test.js     @firebase/rules-unit-testing contro l'emulatore
```

## Gestione degli errori

- Errori di rete o di permesso nelle scritture: messaggio non bloccante ("Salvataggio non riuscito, riprova"); il modulo resta compilato.
- Caricamento iniziale: indicatore di caricamento; se dopo 10 secondi non arrivano dati, messaggio con pulsante "Riprova".
- Offline: l'app si apre dalla cache e mostra gli ultimi dati noti con un'etichetta "Offline".

## Test e verifica

- `test/calcoli.test.js`: saldo, totali per anno e categoria, avanzamento obiettivo, conversione euro↔centesimi, formattazione.
- `test/regole.test.js` (emulatore Firestore): genitore legge/scrive tutto; figlio legge solo il proprio conto; figlio non legge un altro figlio; figlio non scrive movimenti; figlio aggiorna solo `obiettivo` e con forma valida; utente non registrato senza accesso.
- Prova manuale finale nel browser come genitore e come figlio, e installazione come PWA sul telefono.

## Configurazione a carico dell'utente (guidata)

1. Creare un progetto Firebase con l'account Google personale; attivare Authentication → Google e Firestore.
2. Aggiungere il dominio `runtime13.github.io` ai domini autorizzati di Authentication.
3. Copiare la configurazione web nell'app (lo fa Claude, una volta ricevuta).
4. Pubblicare le regole Firestore (`firebase deploy --only firestore:rules` o incollandole in console).
5. Primo accesso di papà e mamma all'app → creare a mano `genitori/{uid}` per ciascuno.
6. Dall'app: inserire i tre figli con le loro email Google e un movimento "Saldo iniziale" per ognuno.
