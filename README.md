# Conti figli

App web installabile sul telefono (PWA) per tenere i conti dei figli: paghette, regali, versamenti, quota casa e prelievi. I genitori registrano i movimenti; ogni figlio entra con il proprio account Google e vede in tempo reale **solo il proprio conto**, e può impostare il proprio obiettivo di risparmio.

- Specifica: `docs/superpowers/specs/2026-11-08-conti-figli-design.md`
- Piano di implementazione: `docs/superpowers/plans/2026-11-08-conti-figli.md`

## Come è fatta

- HTML, CSS e JavaScript senza build, pubblicati su GitHub Pages.
- Firebase: accesso con Google (Authentication) e dati in Cloud Firestore.
- La sicurezza è nelle regole `firestore.rules`: i genitori (documenti in `genitori/{uid}`) leggono e scrivono tutto; un figlio legge solo `figli/{id}` con la propria email e può cambiare solo il campo `obiettivo`.
- `js/firebase-config.js` contiene la configurazione web di Firebase, che è pubblica per natura (non è una password).

## Sviluppo in locale

Servono Node.js 20+ e Java 11+ (per l'emulatore di Firestore).

```bash
npm install
npm test                 # test dei calcoli
npm run test:regole      # test delle regole di sicurezza sull'emulatore
npx firebase emulators:start --only firestore,auth --project demo-conti-figli
python -m http.server 5173   # poi apri http://localhost:5173
```

In locale l'app si collega da sola agli emulatori (Firestore sulla porta 8080, Auth sulla 9099). Dalla UI dell'emulatore (http://localhost:4000) si creano utenti di prova e il documento `genitori/{uid}`.

## Messa in funzione (una volta sola)

1. **Progetto Firebase.** Su https://console.firebase.google.com crea un progetto con il tuo account Google personale (Google Analytics non serve).
2. **Accesso con Google.** Build → Authentication → Inizia → Metodo di accesso → Google → Attiva.
3. **Database.** Build → Firestore Database → Crea database → località `eur3 (Europe)` → modalità produzione.
4. **App web.** Impostazioni progetto → Le tue app → icona `</>` → registra l'app "Conti figli" (senza Hosting) → copia l'oggetto `firebaseConfig` in `js/firebase-config.js`.
5. **Regole.** `npx firebase login`, poi `npx firebase deploy --only firestore:rules --project <id-progetto>`.
6. **Dominio autorizzato.** Authentication → Impostazioni → Domini autorizzati → aggiungi `runtime13.github.io`.
7. **Genitori.** Papà e mamma aprono l'app ed entrano con Google: compare "Questo account non è abilitato". In console: Authentication → Utenti → copia l'UID; Firestore → Avvia raccolta `genitori` → ID documento = UID, campi `nome` e `email`. Ricaricando l'app compare la home.
8. **Figli.** Dall'app: Impostazioni → Aggiungi figlio (nome, email Google, colore). Poi per ognuno un movimento "Saldo iniziale" con il saldo attuale.
9. **Sul telefono.** Apri l'indirizzo dell'app e scegli "Aggiungi a schermata Home" (Android: menu ⋮ → Installa app; iPhone: Condividi → Aggiungi alla schermata Home).

## Aggiornare l'app

Dopo una modifica ai file, aumenta `VERSIONE` in `sw.js`: i telefoni scaricano la nuova versione alla successiva apertura.
