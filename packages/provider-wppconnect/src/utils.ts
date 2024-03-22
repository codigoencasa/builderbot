import { utils } from '@builderbot/bot'
import { writeFile } from 'fs'

import type { Response } from './types'

const WppConnectCleanNumber = (number: string, full: boolean = false): string => {
    number = number.replace('@c.us', '').replace('+', '')
    number = full ? `${number}@c.us` : `${number}`
    return number
}

const notMatches = (matches: RegExpMatchArray | null): boolean => {
    return !matches || matches.length !== 3
}

const writeFilePromise = (pathQr: string, response: Response): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        writeFile(pathQr, response.data, 'binary', (err) => {
            if (err !== null) reject('ERROR_QR_GENERATE')
            resolve(true)
        })
    })
}

const WppConnectGenerateImage = async (base: string, name: string = 'qr.png'): Promise<void | Error> => {
    const PATH_QR: string = `${process.cwd()}/${name}`
    const matches: RegExpMatchArray | null = base.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)

    if (notMatches(matches)) {
        return new Error('Invalid input string')
    }
    const response: Response = {
        type: matches[1],
        data: Buffer.from(matches[2], 'base64'),
    }

    await writeFilePromise(PATH_QR, response)
    await utils.cleanImage(PATH_QR)
}

const WppConnectValidNumber = (rawNumber: string): boolean => {
    const regexGroup: RegExp = /\@g.us\b/gm
    const exist: RegExpMatchArray | null = rawNumber.match(regexGroup)
    return !exist
}

export { WppConnectValidNumber, WppConnectGenerateImage, WppConnectCleanNumber, notMatches, writeFilePromise }
