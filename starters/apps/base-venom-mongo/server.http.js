const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = process.env.PORT || 3000

/**
 * Levantar un HTTP Server
 */
http.createServer(function (req, res) {
    var cssPath = undefined
    var fileStream = undefined
    var imagePath = undefined

    if (req.url === '/') {
        fs.readFile('./public/index.html', 'UTF-8', function (err, html) {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(html)
        })
    } else if (req.url.match('.css$')) {
        cssPath = path.join(__dirname, 'public', req.url)
        fileStream = fs.createReadStream(cssPath, 'UTF-8')
        res.writeHead(200, { 'Content-Type': 'text/css' })
        fileStream.pipe(res)
    } else if (req.url.match('.png$')) {
        imagePath = path.join(__dirname, req.url)
        fileStream = fs.createReadStream(imagePath)
        res.writeHead(200, { 'Content-Type': 'image/png' })
        fileStream.pipe(res)
    } else {
        res.writeHead(404, { 'Content-Type': 'text/html' })
        res.end('No Page Found')
    }
}).listen(PORT, () => console.log(`Escanear QR Code http://localhost:${PORT}`))
