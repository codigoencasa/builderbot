const { readFileSync } = require('fs')
const { join } = require('path')
const { installDeps } = require('./tool')

const PKG_TO_UPDATE = () => {
    const data = readFileSync(join(__dirname, 'pkg-to-update.json'), 'utf-8')
    const dataParse = JSON.parse(data)
    const pkg = Object.keys(dataParse).map((n) => `${n}@${dataParse[n]}`)
    return pkg
}

const installAll = async () => {
    // const pkg = await getPkgManage()
    installDeps('npm', PKG_TO_UPDATE()).runInstall()
}

module.exports = { installAll }
