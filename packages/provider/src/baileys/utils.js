const { createWriteStream } = require('fs')
const qr = require('qr-image')

const baileyCleanNumber = (number, full = false) => {
    number = number.replace('@s.whatsapp.net', '')
    number = !full ? `${number}@s.whatsapp.net` : `${number}`
    return number
}

const baileyGenerateImage = (base64) => {
    let qr_svg = qr.image(base64, { type: 'png', margin: 4 })
    qr_svg.pipe(createWriteStream(`${process.cwd()}/qr.png`))
}

const baileyIsValidNumber = (rawNumber) => {
    const regexGroup = /\@g.us\b/gm
    const exist = rawNumber.match(regexGroup)
    return !exist
}

module.exports = { baileyCleanNumber, baileyGenerateImage, baileyIsValidNumber }
