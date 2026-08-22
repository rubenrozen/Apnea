const CACHE = 'inspir-v34';
const ASSETS = ['./', './index.html',
  './i18n/en.json', './i18n/es.json', './i18n/it.json'];

// Les images sont précachées séparément : une image absente ne doit pas
// faire échouer l'installation du service worker.
const IMAGES = [
  './img/accueil.jpg', './img/tables.jpg', './img/souffle.jpg',
  './img/seances.jpg', './img/guide.jpg', './img/fin.jpg',
  './img/table-co2.jpg', './img/table-o2.jpg', './img/table-custom.jpg',
  './img/prog-max.jpg', './img/prog-premiers.jpg',
  './img/prog-co2.jpg', './img/prog-souffle.jpg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS).then(() =>
        // addAll échoue en bloc : on ajoute les images une par une pour
        // qu'un fichier manquant n'empêche pas l'installation.
        Promise.all(IMAGES.map(u => c.add(u).catch(() => null)))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Jamais de cache sur l'API Supabase : les données doivent être fraîches
  if (req.url.includes('supabase.co')) return;

  // config.js : réseau d'abord, pour qu'une rotation de clé soit prise en compte
  if (req.url.includes('config.js')) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => hit))
  );
});
