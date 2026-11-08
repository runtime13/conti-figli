// Service worker: tiene in cache i file dell'app e l'SDK Firebase, così l'app si apre anche offline.
// I dati non passano di qui: Firestore ha la propria cache locale.
// Quando si modificano i file dell'app, aumentare VERSIONE.
const VERSIONE = 'v1';
const CACHE = `conti-figli-${VERSIONE}`;

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const FILE_APP = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/ui.js',
  'js/calcoli.js',
  'js/dati.js',
  'js/firebase-config.js',
  'js/viste/accesso.js',
  'js/viste/comuni.js',
  'js/viste/home.js',
  'js/viste/conto.js',
  'js/viste/obiettivo.js',
  'js/viste/movimento.js',
  'js/viste/impostazioni.js',
  'icons/icona-192.png',
  'icons/icona-512.png',
  'icons/icona-maskable-512.png',
  `${SDK}firebase-app.js`,
  `${SDK}firebase-auth.js`,
  `${SDK}firebase-firestore.js`,
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILE_APP)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((chiavi) => Promise.all(chiavi.filter((k) => k.startsWith('conti-figli-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const stessoSito = url.origin === self.location.origin;
  const sdk = request.url.startsWith(SDK);
  if (!stessoSito && !sdk) return; // Firestore, Auth e Google passano diretti

  // SDK con versione fissata: prima la cache. File dell'app: cache subito, aggiornata in background.
  evento.respondWith(caches.open(CACHE).then(async (cache) => {
    const inCache = await cache.match(request, { ignoreSearch: stessoSito });
    if (inCache && sdk) return inCache;
    const daRete = fetch(request).then((risposta) => {
      if (risposta.ok) cache.put(request, risposta.clone());
      return risposta;
    }).catch(() => inCache ?? (request.mode === 'navigate' ? cache.match('index.html') : Response.error()));
    return inCache ?? daRete;
  }));
});
