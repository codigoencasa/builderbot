import { writeFile, createWriteStream } from 'fs'
import { utils } from '@bot-whatsapp/bot'
import { tmpdir } from 'os'
import * as http from 'http'
import * as https from 'https'

const venomCleanNumber = (number: string, full: boolean = false): string => {
    number = number.replace('@c.us', '')
    number = !full ? `${number}@c.us` : `${number}`
    return number
}

const venomGenerateImage = async (base: string, name: string = 'qr.png'): Promise<void | Error> => {
    const PATH_QR = `${process.cwd()}/${name}`
    const matches = base.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
    if (!matches || matches.length !== 3) {
        return new Error('Invalid input string')
    }

    const response: { type: string; data: Buffer } = {
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

const venomDownloadMedia = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const ext = url.split('.').pop() || 'unknown'
        const checkProtocol = url.includes('https:')
        const handleHttp = checkProtocol ? https : http
        const name = `tmp-${Date.now()}.${ext}`
        const fullPath = `${tmpdir()}/${name}`
        const file = createWriteStream(fullPath)
        handleHttp.get(url, function (response) {
            response.pipe(file)
            file.on('finish', function () {
                file.close()
                resolve(fullPath)
            })
            file.on('error', function () {
                console.log('error')
                file.close()
                reject(new Error('Download failed'))
            })
        })
    })
}

const venomisValidNumber = (rawNumber: string): boolean => {
    const regexGroup = /\@g.us\b/gm
    const exist = rawNumber.match(regexGroup)
    return !exist
}

export { venomCleanNumber, venomGenerateImage, venomisValidNumber, venomDownloadMedia }
