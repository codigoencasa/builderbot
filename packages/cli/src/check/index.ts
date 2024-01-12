import { exec } from 'node:child_process'
import { platform, version as nodeVersion } from 'node:os'

interface CheckResult {
    pass: boolean
    message: string
}

const checkNodeVersion = (): Promise<CheckResult> => {
    return new Promise((resolve) => {
        const version = nodeVersion
        const majorVersion = parseInt(version().replace('v', '').split('.')[0])
        if (majorVersion < 18) {
            resolve({ pass: false, message: `Se requiere Node.js 18 o superior. (${version})` })
        }

        resolve({ pass: true, message: `Node: ${version} compatible` })
    })
}

const checkOs = (): Promise<string> => {
    return new Promise((resolve) => {
        const os = platform()
        if (!os.includes('win32')) {
            resolve(`OS: ${os} (revisar documentación)`)
        }
        resolve(`OS: ${os}`)
    })
}

const checkGit = (): Promise<CheckResult> => {
    return new Promise((resolve, reject) => {
        exec('git --version', (error) => {
            if (error) {
                reject({ pass: false, message: `Requiere instalar GIT` })
            } else {
                resolve({ pass: true, message: `Git: compatible` })
            }
        })
    })
}

export { checkNodeVersion, checkOs, checkGit }
