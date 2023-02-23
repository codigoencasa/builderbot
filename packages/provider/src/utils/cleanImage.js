const sharp = require('sharp')
const { readFile } = require('fs')

/**
 * Agregar un borde alrededor para mejorar la lectura de QR
 * @param {*} FROM
 * @returns
 */
const cleanImage = async (FROM = null) => {
    const readBuffer = () => {
        return new Promise((resolve, reject) => {
            readFile(FROM, (err, data) => {
                if (err) reject(err)
                const imageBuffer = Buffer.from(data)
                resolve(imageBuffer)
            })
        })
    }

    const imgBuffer = await readBuffer()

    return new Promise((resolve, reject) => {
        sharp(imgBuffer)
            .extend({
                top: 15,
                bottom: 15,
                left: 15,
                right: 15,
                background: { r: 255, g: 255, b: 255, alpha: 1 },
            })
            .toFile(FROM, (err) => {
                if (err) reject(err)
                resolve()
            })
    })
}

module.exports = { cleanImage }
