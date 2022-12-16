const { createWriteStream } = require('fs')
const combineImage = require('combine-image')
const qr = require('qr-image')

const baileyCleanNumber = (number, full = false) => {
    number = number.replace('@s.whatsapp.net', '')
    number = !full ? `${number}@s.whatsapp.net` : `${number}`
    return number
}

/**
 * Hace promesa el write
 * @param {*} base64
 */
const baileyGenerateImage = (base64) => {
    const PATH_QR = `${process.cwd()}/qr.png`
    let qr_svg = qr.image(base64, { type: 'png', margin: 4 })
    qr_svg.pipe(createWriteStream(PATH_QR))
    combineImage([PATH_QR], { margin: 15, color: 0xffffffff }).then((img) => {
        img.write(PATH_QR)
    })
}

const baileyIsValidNumber = (rawNumber) => {
    const regexGroup = /\@g.us\b/gm
    const exist = rawNumber.match(regexGroup)
    return !exist
}

module.exports = { baileyCleanNumber, baileyGenerateImage, baileyIsValidNumber }
