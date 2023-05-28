const mimeDep = require('mime-types')
const { tmpdir } = require('os')
const http = require('follow-redirects').http
const https = require('follow-redirects').https
const { rename, createWriteStream, existsSync } = require('fs')
const { extname } = require('path')

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
    const checkIsLocal = existsSync(url)

    const handleDownload = () => {
        const checkProtocol = url.includes('https:')
        const handleHttp = checkProtocol ? https : http

        const name = `tmp-${Date.now()}-dat`
        const fullPath = `${tmpdir()}/${name}`
        const file = createWriteStream(fullPath)

        if (checkIsLocal) {
            /**
             * From Local
             */
            return new Promise((res) => {
                const response = {
                    headers: {
                        'content-type': mimeDep.contentType(extname(url)),
                    },
                }
                res({ response, fullPath: url })
            })
        } else {
            /**
             * From URL
             */
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
    }

    const handleFile = (pathInput, ext) =>
        new Promise((resolve, reject) => {
            const fullPath = checkIsLocal ? `${pathInput}` : `${pathInput}.${ext}`
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
