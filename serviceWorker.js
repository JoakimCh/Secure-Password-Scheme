
const prefix = 'SPS' // since the origin could be shared by several PWAs
const build = '5' // (only a change in the service worker will trigger a refresh of the cache)
const mainCache = prefix+'_main' // const mainCache = prefix+'_b'+build+'_main'

self.addEventListener('message', ({source, data}) => {
  switch (data.cmd) {
    case 'hi': source.postMessage({cmd: 'hello', build}); break
  }
})

self.addEventListener('install', event => {
  async function addInitialCache() {
    // await caches.delete(mainCache) // just force a refresh of it here (then we don't need to do anything in the activate event)
    const cache = await caches.open(mainCache)
    const urlPrefix = './' // meaning relative to the path of this service worker
    await cache.addAll([ // cache these URLs (do not cache the serviceWorker)
      urlPrefix, // the index
      urlPrefix+'manifest.json', 
      urlPrefix+'theme.css', 
      urlPrefix+'light.css', 
      urlPrefix+'icon.svg',
      urlPrefix+'icon.png',
      urlPrefix+'code.js', 
    ])
    self.skipWaiting() // to activate an updated service worker immediately
  }
  event.waitUntil(addInitialCache())
})

self.addEventListener('fetch', event => {
  async function returnCachedResource() {
    const cache = await caches.open(mainCache)
    const cachedResponse = await cache.match(event.request.url)
    if (cachedResponse) return cachedResponse
    try {        
      const fetchResponse = await fetch(event.request)
      cache.put(event.request.url, fetchResponse.clone())
      return fetchResponse
    } catch (error) { // here we could do a custom offline response
      return null // or just trigger a network error
    }
  }
  event.respondWith(returnCachedResource())
})
