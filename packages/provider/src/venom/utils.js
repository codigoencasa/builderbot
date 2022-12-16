const { writeFile } = require('fs')
const combineImage = require('combine-image')

const venomCleanNumber = (number, full = false) => {
    number = number.replace('@c.us', '')
    number = !full ? `${number}@c.us` : `${number}`
    return number
}

const venomGenerateImage = (base) => {
    const PATH_QR = `${process.cwd()}/qr.png`
    const matches = base.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
    if (matches.length !== 3) {
        return new Error('Invalid input string')
    }

    let response = {}
    response.type = matches[1]
    response.data = new Buffer.from(matches[2], 'base64')

    var imageBuffer = response
    writeFile(PATH_QR, imageBuffer['data'], 'binary', (err) => {
        if (err != null) throw new Error('ERROR_QR_GENERATE')
        combineImage([PATH_QR], { margin: 15, color: 0xffffffff }).then(
            (img) => {
                img.write(PATH_QR)
            }
        )
        return
    })
}

const venomisValidNumber = (rawNumber) => {
    const regexGroup = /\@g.us\b/gm
    const exist = rawNumber.match(regexGroup)
    return !exist
}
module.exports = { venomCleanNumber, venomGenerateImage, venomisValidNumber }
