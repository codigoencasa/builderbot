const qr = require('qr-image')
const { createWriteStream } = require('fs')

const cleanNumber = (number, full = false) => {
    number = number.replace('@c.us', '')
    number = !full ? `${number}@c.us` : `${number}`
    return number
}

const generateImage = (base64) => {
    let qr_svg = qr.image(base64, { type: 'svg', margin: 4 })
    qr_svg.pipe(createWriteStream(`${process.cwd()}/qr.svg`))
}

module.exports = { cleanNumber, generateImage }
