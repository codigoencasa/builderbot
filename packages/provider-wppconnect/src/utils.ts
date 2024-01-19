import { utils } from '@bot-whatsapp/bot'
import { writeFile } from 'fs'

const WppConnectCleanNumber = (number: string, full: boolean = false): string => {
    number = number.replace('@c.us', '')
    number = full ? `${number}@c.us` : `${number}`
    return number
}

const WppConnectGenerateImage = async (base: string, name: string = 'qr.png'): Promise<void | Error> => {
    const PATH_QR: string = `${process.cwd()}/${name}`
    const matches: RegExpMatchArray | null = base.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
    if (!matches || matches.length !== 3) {
        return new Error('Invalid input string')
    }

    interface Response {
        type: string
        data: Buffer
    }

    const response: Response = {
        type: matches[1],
        data: Buffer.from(matches[2], 'base64'),
    }

    const writeFilePromise = (): Promise<boolean> =>
        new Promise((resolve, reject) => {
            writeFile(PATH_QR, response.data, 'binary', (err) => {
                if (err != null) reject('ERROR_QR_GENERATE')
                resolve(true)
            })
        })

    await writeFilePromise()
    await utils.cleanImage(PATH_QR)
}

const WppConnectValidNumber = (rawNumber: string): boolean => {
    const regexGroup: RegExp = /\@g.us\b/gm
    const exist: RegExpMatchArray | null = rawNumber.match(regexGroup)
    return !exist
}

export { WppConnectValidNumber, WppConnectGenerateImage, WppConnectCleanNumber }
