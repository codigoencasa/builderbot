const { createWriteStream } = require('fs')
const qr = require('qr-image')

const cleanNumber = (number) => {
    number = number.replace('@c.us', '')
    number = `${number}@c.us`
    return number
}

const generateImage = (base64) => {
    let qr_svg = qr.image(base64, { type: 'svg', margin: 4 })
    qr_svg.pipe(createWriteStream(`${process.cwd()}/qr.svg`))
}

const isValidNumber = (rawNumber) => {
    const regexGroup = /\@g.us\b/gm
    const exist = rawNumber.match(regexGroup)
    return !exist
}

module.exports = { cleanNumber, generateImage, isValidNumber }
