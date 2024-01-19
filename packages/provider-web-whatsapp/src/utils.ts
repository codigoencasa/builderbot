import { utils } from '@bot-whatsapp/bot'
import { createWriteStream } from 'fs'
import * as http from 'http'
import * as https from 'https'
import { tmpdir } from 'os'
import * as qr from 'qr-image'

const wwebCleanNumber = (number: string, full: boolean = false): string => {
    number = number.replace('@c.us', '')
    number = !full ? `${number}@c.us` : `${number}`
    return number
}

const wwebGenerateImage = async (base64: string, name: string = 'qr.png'): Promise<void> => {
    const PATH_QR = `${process.cwd()}/${name}`
    const qr_svg = qr.image(base64, { type: 'png', margin: 4 })

    const writeFilePromise = (): Promise<boolean> =>
        new Promise((resolve, reject) => {
            const file = qr_svg.pipe(createWriteStream(PATH_QR))
            file.on('finish', () => resolve(true))
            file.on('error', reject)
        })

    await writeFilePromise()
    await utils.cleanImage(PATH_QR)
}

const wwebIsValidNumber = (rawNumber: string): boolean => {
    const regexGroup = /\@g.us\b/gm
    const exist = rawNumber.match(regexGroup)
    return !exist
}

const wwebDownloadMedia = async (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const ext = url.split('.').pop() || 'unknown'
        const checkProtocol = url.startsWith('https:')
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
            file.on('error', function (err) {
                console.error('Error downloading media:', err)
                file.close()
                reject(err)
            })
        })
    })
}

export { wwebCleanNumber, wwebGenerateImage, wwebIsValidNumber, wwebDownloadMedia }
