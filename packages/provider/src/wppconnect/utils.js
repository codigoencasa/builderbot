const { writeFile } = require('fs')
const { cleanImage } = require('../utils/cleanImage')

const WppConnectCleanNumber = (number, full = false) => {
    number = number.replace('@c.us', '')
    number = full ? `${number}@c.us` : `${number}`
    return number
}

const WppConnectGenerateImage = async (base, name = 'qr.png') => {
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
    await cleanImage(PATH_QR)
}

const WppConnectValidNumber = (rawNumber) => {
    const regexGroup = /\@g.us\b/gm
    const exist = rawNumber.match(regexGroup)
    return !exist
}

module.exports = {
    WppConnectValidNumber,
    WppConnectGenerateImage,
    WppConnectCleanNumber,
}
