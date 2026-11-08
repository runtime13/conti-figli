# Conti figli

Progetto: app web installabile (PWA) per gestire i conti dei tre figli (paghette, regali, prelievi), consultabile in tempo reale dai figli, ognuno solo per il proprio conto.

## Note per Claude
- Lingua dei commenti e della documentazione: italiano
- Non committare mai credenziali, token, file `.env` o chiavi di account di servizio Firebase. La configurazione web di Firebase (`apiKey`, `projectId`, ...) è pubblica per natura e può stare nel repo
- Prima di scrivere codice, proporre il piano e attendere conferma
- Specifica di design: `docs/superpowers/specs/2026-11-08-conti-figli-design.md`
- Piano di implementazione (con caselle di avanzamento): `docs/superpowers/plans/2026-11-08-conti-figli.md`
- Repository: GitHub `runtime13/conti-figli` (pubblico), pubblicato con GitHub Pages su https://runtime13.github.io/conti-figli/
- Progetto Firebase: `conti-figli` (alias `prod` in `.firebaserc`; `default` = `demo-conti-figli` per l'emulatore). Regole: `npx firebase deploy --only firestore:rules --project prod`
- Ogni modifica ai file dell'app richiede di aumentare `VERSIONE` in `sw.js`, altrimenti i telefoni continuano a usare la versione in cache
- Test: `npm test` (calcoli) e `npm run test:regole` (regole, richiede Java in PATH)
