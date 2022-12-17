const { writeFile } = require('fs')
const combineImage = require('combine-image')

const venomCleanNumber = (number, full = false) => {
    number = number.replace('@c.us', '')
    number = !full ? `${number}@c.us` : `${number}`
    return number
}

const venomGenerateImage = async (base) => {
    const PATH_QR = `${process.cwd()}/qr.png`
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

const venomisValidNumber = (rawNumber) => {
    const regexGroup = /\@g.us\b/gm
    const exist = rawNumber.match(regexGroup)
    return !exist
}
module.exports = { venomCleanNumber, venomGenerateImage, venomisValidNumber }
