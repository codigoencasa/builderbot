const mimeDep = require('mime-types')
const { tmpdir } = require('os')
const http = require('http')
const https = require('https')
const { rename, createWriteStream } = require('fs')

/**
 * Extrar el mimetype from buffer
 * @param {string} response
 * @returns
 */
const fileTypeFromFile = async (response) => {
    const type = response.headers['content-type'] ?? null
    const ext = mimeDep.extension(type)
    return {
        type,
        ext,
    }
}

/**
 * Descargar archivo binay en tmp
 * @param {*} url
 * @returns
 */
const generalDownload = async (url) => {
    const handleDownload = () => {
        const checkProtocol = url.includes('https:')
        const handleHttp = checkProtocol ? https : http
        const name = `tmp-${Date.now()}-dat`
        const fullPath = `${tmpdir()}/${name}`
        const file = createWriteStream(fullPath)

        return new Promise((res, rej) => {
            handleHttp.get(url, function (response) {
                response.pipe(file)
                file.on('finish', async function () {
                    file.close()
                    res({ response, fullPath })
                })
                file.on('error', function () {
                    file.close()
                    rej(null)
                })
            })
        })
    }

    const handleFile = (pathInput, ext) =>
        new Promise((resolve, reject) => {
            const fullPath = `${pathInput}.${ext}`
            rename(pathInput, fullPath, (err) => {
                if (err) reject(null)
                resolve(fullPath)
            })
        })

    const httpResponse = await handleDownload()
    const { ext } = await fileTypeFromFile(httpResponse.response)
    const getPath = await handleFile(httpResponse.fullPath, ext)

    return getPath
}

module.exports = { generalDownload }
