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
    console.log(`⚡ Recuerda que el QR se actualiza cada minuto ⚡'`)
    console.log(`⚡ Actualiza F5 el navegador para mantener el mejor QR⚡`)
}

module.exports = { cleanNumber, generateImage }
