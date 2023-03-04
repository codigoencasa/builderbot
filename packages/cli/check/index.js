const { exec } = require('node:child_process')

const checkNodeVersion = () => {
    return new Promise((resolve) => {
        const version = process.version
        const majorVersion = parseInt(version.replace('v', '').split('.').shift())
        if (majorVersion < 16) {
            resolve({ pass: false, message: `Se require Node.js 16 o superior. (${version})` })
        }

        resolve({ pass: true, message: `Node: ${version} compatible` })
    })
}

const checkOs = () => {
    return new Promise((resolve) => {
        const os = process.platform
        if (!os.includes('win32')) {
            resolve(`OS: ${os} (revisar documentacion)`)
        }
        resolve(`OS: ${os}`)
    })
}

const checkGit = () => {
    return new Promise((resolve, reject) => {
        exec('git --version', (error) => {
            if (error) {
                reject({ pass: false, message: `Require instalar GIT` })
            } else {
                resolve({ pass: true, message: `Git: compatible` })
            }
        })
    })
}

module.exports = { checkNodeVersion, checkOs, checkGit }
