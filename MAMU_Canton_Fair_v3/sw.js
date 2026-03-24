/*
  MAMU Canton Fair — Service Worker
  Caches the app shell on first load.
  Every subsequent open loads from cache — works fully offline.
  Version bump CACHE_NAME to force re-download after an update.
*/
var CACHE_NAME = 'mamu-canton-v1';
var APP_SHELL  = ['./'];   /* caches index.html */

/* Install: cache the app shell */
self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache){ return cache.addAll(APP_SHELL); })
      .then(function(){ return self.skipWaiting(); })
  );
});

/* Activate: remove old caches */
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE_NAME; })
            .map(function(k){ return caches.delete(k); })
      );
    }).then(function(){ return self.clients.claim(); })
  );
});

/* Fetch: cache-first for app shell, network-first for Firebase/Google/Drive */
self.addEventListener('fetch', function(e){
  var url = e.request.url;

  /* Always go to network for Firebase, Google auth, Drive APIs */
  if(url.indexOf('firestore.googleapis.com') !== -1 ||
     url.indexOf('firebase') !== -1 ||
     url.indexOf('gstatic.com') !== -1 ||
     url.indexOf('accounts.google.com') !== -1 ||
     url.indexOf('googleapis.com/drive') !== -1 ||
     url.indexOf('googleapis.com/upload') !== -1){
    e.respondWith(
      fetch(e.request).catch(function(){
        /* Offline — return empty response so app keeps running */
        return new Response('', {status: 200});
      })
    );
    return;
  }

  /* Cache-first for everything else (the app itself) */
  e.respondWith(
    caches.match(e.request).then(function(cached){
      if(cached) return cached;
      /* Not in cache — fetch and cache it */
      return fetch(e.request).then(function(response){
        if(!response || response.status !== 200 || response.type === 'opaque'){
          return response;
        }
        var toCache = response.clone();
        caches.open(CACHE_NAME).then(function(cache){
          cache.put(e.request, toCache);
        });
        return response;
      }).catch(function(){
        /* Truly offline and not cached — nothing we can do */
        return new Response('Offline — open the app from the home screen shortcut.', {
          status: 503,
          headers: {'Content-Type':'text/plain'}
        });
      });
    })
  );
});
