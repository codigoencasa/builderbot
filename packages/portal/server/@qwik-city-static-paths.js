const staticPaths = new Set([
    '/',
    '/favicon.svg',
    '/manifest.json',
    '/q-manifest.json',
    '/robots.txt',
    '/service-worker.js',
    '/sitemap.xml',
    '/water-mark.png',
])
function isStaticPath(p) {
    if (p.startsWith('/build/')) {
        return true
    }
    if (p.startsWith('/assets/')) {
        return true
    }
    if (staticPaths.has(p)) {
        return true
    }
    return false
}
export { isStaticPath }
