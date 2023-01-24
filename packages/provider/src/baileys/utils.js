const { createWriteStream, rename } = require('fs')
const combineImage = require('combine-image')
const qr = require('qr-image')
const { tmpdir } = require('os')
const http = require('http')
const https = require('https')

const { fileTypeFromFile } = require('../../common/fileType')

const baileyCleanNumber = (number, full = false) => {
    number = number.replace('@s.whatsapp.net', '')
    number = !full ? `${number}@s.whatsapp.net` : `${number}`
    return number
}

/**
 * Hace promesa el write
 * @param {*} base64
 */
const baileyGenerateImage = async (base64, name = 'qr.png') => {
    const PATH_QR = `${process.cwd()}/${name}`
    let qr_svg = qr.image(base64, { type: 'png', margin: 4 })

    const writeFilePromise = () =>
        new Promise((resolve, reject) => {
            const file = qr_svg.pipe(createWriteStream(PATH_QR))
            file.on('finish', () => resolve(true))
            file.on('error', reject)
        })

    await writeFilePromise()

    const cleanImage = await combineImage([PATH_QR], {
        margin: 15,
        color: 0xffffffff,
    })
    cleanImage.write(PATH_QR)
}

const baileyIsValidNumber = (rawNumber) => {
    const regexGroup = /\@g.us\b/gm
    const exist = rawNumber.match(regexGroup)
    return !exist
}

/**
 * Incompleta
 * Descargar archivo multimedia para enviar
 * @param {*} url
 * @returns
 */
const baileyDownloadMedia = async (url) => {
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

module.exports = {
    baileyCleanNumber,
    baileyGenerateImage,
    baileyIsValidNumber,
    baileyDownloadMedia,
}
