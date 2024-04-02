import { utils } from '@builderbot/bot'
import type { WriteStream } from 'fs'
import { createWriteStream } from 'fs'
import { emptyDir } from 'fs-extra'
import * as qr from 'qr-image'

const emptyDirSessions = async (pathBase: string) =>
    new Promise((resolve, reject) => {
        emptyDir(pathBase, (err) => {
            if (err) reject(err)
            resolve(true)
        })
    })
/**
 * Cleans the WhatsApp number format.
 * @param number The WhatsApp number to be cleaned.
 * @param full Whether to return the full number format or not.
 * @returns The cleaned number.
 */
const baileyCleanNumber = (number: string, full: boolean = false): string => {
    number = number.replace('@s.whatsapp.net', '').replace('+', '').replace(/\s/g, '')
    number = !full ? `${number}@s.whatsapp.net` : number
    return number
}

/**
 * Generates an image from a base64 string.
 * @param base64 The base64 string to generate the image from.
 * @param name The name of the file to write the image to.
 */
const baileyGenerateImage = async (base64: string, name: string = 'qr.png'): Promise<void> => {
    const PATH_QR: string = `${process.cwd()}/${name}`
    const qr_svg = qr.image(base64, { type: 'png', margin: 4 })

    const writeFilePromise = (): Promise<boolean> =>
        new Promise((resolve, reject) => {
            const file: WriteStream = qr_svg.pipe(createWriteStream(PATH_QR))
            file.on('finish', () => resolve(true))
            file.on('error', reject)
        })

    await writeFilePromise()
    await utils.cleanImage(PATH_QR)
}

/**
 * Validates if the given number is a valid WhatsApp number and not a group ID.
 * @param rawNumber The number to validate.
 * @returns True if it's a valid number, false otherwise.
 */
const baileyIsValidNumber = (rawNumber: string): boolean => {
    const regexGroup: RegExp = /\@g.us\b/gm
    const exist = rawNumber.match(regexGroup)
    return !exist
}

export { baileyCleanNumber, baileyGenerateImage, baileyIsValidNumber, emptyDirSessions }
