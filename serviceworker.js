/*
https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps-chromium/how-to/service-workers
https://web.dev/learn/pwa/caching/
https://developer.mozilla.org/en-US/docs/Web/API/Cache
*/

const prefix = 'SPS' // since the origin is https://joakimch.github.io which could be shared by several PWA's
const build = 'b1'
const mainCache = prefix+build+'_main'

self.addEventListener('install', event => {
  async function addInitialCache() {
    const urlPrefix = './' // meaning relative to the path of this service worker
    const cache = await caches.open(mainCache)
    await cache.addAll([ // cache these URLs
      urlPrefix, // the index
      urlPrefix+'code.js', 
      urlPrefix+'manifest.json', 
      urlPrefix+'theme.css', 
      urlPrefix+'lights_on.css', 
      urlPrefix+'icon.svg'
    ])
  }
  self.skipWaiting() // activate any updated service worker immediately
  event.waitUntil(addInitialCache())
})

// clean up stuff from old workers
self.addEventListener('activate', event => {
  async function deleteOldCaches() {
    // await clients.claim() // see: https://stackoverflow.com/a/72376913/4216153
    const names = await caches.keys()
    await Promise.all(names.map(name => {
      if (name.startsWith(prefix)) { // for this PWA
        if (!name.startsWith(prefix+build)) { // but wrong build
          return caches.delete(name) // then delete the whole cache
        }
      }
    }))
  }
  event.waitUntil(deleteOldCaches())
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
    } catch (error) { // here we could do custom offline response
      return null // or trigger a network error
    }
  }
  event.respondWith(returnCachedResource())
})

