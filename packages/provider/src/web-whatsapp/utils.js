const { createWriteStream } = require('fs')
const qr = require('qr-image')
const { tmpdir } = require('os')
const http = require('http')
const https = require('https')

const cleanNumber = (number, full = false) => {
    number = number.replace('@c.us', '')
    number = !full ? `${number}@c.us` : `${number}`
    return number
}

const generateImage = (base64) => {
    let qr_svg = qr.image(base64, { type: 'png', margin: 4 })
    qr_svg.pipe(createWriteStream(`${process.cwd()}/qr.svg`))
}

const isValidNumber = (rawNumber) => {
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
const downloadMedia = (url) => {
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

module.exports = { cleanNumber, generateImage, isValidNumber, downloadMedia }
