const ProviderHTTPServer = require('./providerhttp.class')

/**
 * Instanciamos clase de Server
 * podriamos pasar port?
 * @returns
 */
const createHttpServer = () => {
    return new ProviderHTTPServer().start()
}

module.exports = { createHttpServer }
