const { writeFile, createWriteStream } = require('fs')
const { tmpdir } = require('os')
const http = require('http')
const https = require('https')
const combineImage = require('combine-image')

const venomCleanNumber = (number, full = false) => {
    number = number.replace('@c.us', '')
    number = !full ? `${number}@c.us` : `${number}`
    return number
}

const venomGenerateImage = async (base, name = 'qr.png') => {
    const PATH_QR = `${process.cwd()}/${name}`
    const matches = base.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
    if (matches.length !== 3) {
        return new Error('Invalid input string')
    }

    let response = {}
    response.type = matches[1]
    response.data = new Buffer.from(matches[2], 'base64')

    const writeFilePromise = () =>
        new Promise((resolve, reject) => {
            writeFile(PATH_QR, response['data'], 'binary', (err) => {
                if (err != null) reject('ERROR_QR_GENERATE')
                resolve(true)
            })
        })

    await writeFilePromise()

    const cleanImage = await combineImage([PATH_QR], {
        margin: 15,
        color: 0xffffffff,
    })
    cleanImage.write(PATH_QR)
}

/**
 * Incompleta
 * Descargar archivo multimedia para enviar
 * @param {*} url
 * @returns
 */
const venomDownloadMedia = (url) => {
    return new Promise((resolve, reject) => {
        const ext = url.split('.').pop()
        const checkProtocol = url.includes('https:')
        const handleHttp = checkProtocol ? https : http
        const name = `tmp-${Date.now()}.${ext}`
        const fullPath = `${tmpdir()}/${name}`
        const file = createWriteStream(fullPath)
        handleHttp.get(url, function (response) {
            response.pipe(file)
            file.on('finish', function () {
                file.close()
                resolve(fullPath)
            })
            file.on('error', function () {
                console.log('errro')
                file.close()
                reject(null)
            })
        })
    })
}

const venomisValidNumber = (rawNumber) => {
    const regexGroup = /\@g.us\b/gm
    const exist = rawNumber.match(regexGroup)
    return !exist
}
module.exports = {
    venomCleanNumber,
    venomGenerateImage,
    venomisValidNumber,
    venomDownloadMedia,
}
