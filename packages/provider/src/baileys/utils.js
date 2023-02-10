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

module.exports = {
    baileyCleanNumber,
    baileyGenerateImage,
    baileyIsValidNumber,
}
