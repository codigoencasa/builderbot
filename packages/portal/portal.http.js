const { join } = require('path')
const { createReadStream, existsSync } = require('fs')
const { bgYellow, cyan } = require('kleur')
const polka = require('polka')

const HTTP_PORT = process.env.PORT || 3000
const QR_FILE = process.env.QR_FILE ?? 'qr.png'
const PUBLIC_URL =
    process.env.PUBLIC_URL ??
    process.env.RAILWAY_STATIC_URL ??
    'http://localhost'

const dir = [join(__dirname, 'dist'), join(__dirname, '..', 'dist')].find((i) =>
    existsSync(i)
)
const serve = require('serve-static')(dir)

/**
 * Iniciamos Portal WEB para escanear QR
 * @param {port:3000, publicSite:'http://mistio.com', qrFile:'qr.png', dir:__dirname}
 */
const start = (args) => {
    const injectArgs = {
        port: HTTP_PORT,
        publicSite: PUBLIC_URL,
        qrFile: QR_FILE,
        ...args,
    }
    const { port, publicSite, qrFile } = injectArgs

    polka()
        .use(serve)
        .get(qrFile, (_, res) => {
            const qrSource = [
                join(process.cwd(), qrFile),
                join(__dirname, '..', qrFile),
                join(__dirname, qrFile),
            ].find((i) => existsSync(i))

            const qrMark = [
                join(__dirname, 'dist', 'water-mark.png'),
                join(__dirname, '..', 'dist', 'water-mark.png'),
            ].find((i) => existsSync(i))
            const fileStream = createReadStream(qrSource ?? qrMark)
            res.writeHead(200, { 'Content-Type': 'image/png' })
            fileStream.pipe(res)
        })
        .listen(port, () => {
            console.log(``)
            console.log(bgYellow(`🚩 ESCANEAR QR 🚩`))
            console.log(cyan(`Existen varias maneras de escanear el QR code`))
            console.log(cyan(`- Se ha creado un archivo /qr.png`))
            console.log(cyan(`- Tambien puedes visitar ${publicSite}:${port}`))
            console.log(``)
        })
}

module.exports = start
