const polka = require('polka')
const { existsSync } = require('fs')
const { join } = require('path')

/**
 * Servidor HTTP para exponder rutas (endpoints)
 */
class ProviderHTTPServer {
    port = 4000
    constructor() {}

    /**
     * Controlador para exponer la pagina de QR para escanear
     * GET http://localhost:4000/qr
     * @param {*} _
     * @param {*} res
     */
    qrController = (_, res) => {
        try {
            res.end('OK')
        } catch (e) {
            res.end('ERROR_QR_CONTROLLER')
        }
    }

    /**
     * Iniciar Server
     * @returns
     */
    start = () => {
        try {
            const paths = [
                join(__dirname, 'server', 'pages'),
                join(__dirname, '..', 'server', 'pages'),
            ]
            const indexPath = paths.find((i) => existsSync(i))
            const serve = require('serve-static')(indexPath)

            polka()
                .use(serve)
                .get('/qr', this.qrController)
                .listen(this.port, () => {
                    console.log(``)
                    console.log(
                        `[BOT Server]: Visita http://localhost:${this.port}/qr`
                    )
                    console.log(``)
                })
            return Promise.resolve()
        } catch (e) {
            return Promise.reject()
        }
    }
}

module.exports = ProviderHTTPServer
