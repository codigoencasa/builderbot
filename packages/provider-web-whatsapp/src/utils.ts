import { utils } from '@builderbot/bot'
import { createWriteStream, existsSync } from 'fs'
import { emptyDir } from 'fs-extra'
import * as http from 'http'
import * as https from 'https'
import { tmpdir, platform } from 'os'
import { join } from 'path'
import * as qr from 'qr-image'

const emptyDirSessions = async (pathBase: string) =>
    new Promise((resolve, reject) => {
        emptyDir(pathBase, (err) => {
            if (err) reject(err)
            resolve(true)
        })
    })

const wwebGetChromeExecutablePath = () => {
    const myPlatform = platform()
    switch (myPlatform) {
        case 'win32':
            return wwebGetWindowsChromeExecutablePath()
        case 'darwin':
            return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        case 'linux':
            return '/usr/bin/google-chrome'
        default:
            console.error('Could not find browser.')
            return null
    }
}

const wwebGetWindowsChromeExecutablePath = () => {
    const programFilesPath = process.env.ProgramFiles || ''
    const programFiles86Path = process.env['ProgramFiles(x86)'] || ''
    const pathProgramFiles86Path = join(programFiles86Path, 'Google', 'Chrome', 'Application', 'chrome.exe')
    const pathProgramFiles64Path = join(programFilesPath, 'Google', 'Chrome', 'Application', 'chrome.exe')

    if (existsSync(pathProgramFiles86Path)) return pathProgramFiles86Path
    if (existsSync(pathProgramFiles64Path)) return pathProgramFiles64Path
    return ''
}

const wwebCleanNumber = (number: string, full: boolean = false): string => {
    number = number.replace('@c.us', '').replace('+', '').replace(/\s/g, '')
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

const wwebDeleteTokens = (session: string) => {
    try {
        const pathTokens = join(process.cwd(), session)
        emptyDirSessions(pathTokens)
        console.log('Tokens clean..')
    } catch (e) {
        return
    }
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

export {
    wwebCleanNumber,
    wwebGenerateImage,
    wwebDeleteTokens,
    wwebIsValidNumber,
    wwebDownloadMedia,
    wwebGetChromeExecutablePath,
    emptyDirSessions,
    wwebGetWindowsChromeExecutablePath,
}
