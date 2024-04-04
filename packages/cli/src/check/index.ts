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
        if (majorVersion < 20) {
            resolve({ pass: false, message: `Node.js 20 or higher is required.. (${version})` })
        }

        resolve({ pass: true, message: `Node: ${version} supported` })
    })
}

const checkOs = (): Promise<string> => {
    return new Promise((resolve) => {
        const os = platform()
        if (!os.includes('win32')) {
            resolve(`OS: ${os}`)
        }
        resolve(`OS: ${os}`)
    })
}

const checkGit = (): Promise<CheckResult> => {
    return new Promise((resolve, reject) => {
        exec('git --version', (error) => {
            if (error) {
                reject({ pass: false, message: `Requires GIT installation` })
            } else {
                resolve({ pass: true, message: `Git: supported` })
            }
        })
    })
}

export { checkNodeVersion, checkOs, checkGit }
