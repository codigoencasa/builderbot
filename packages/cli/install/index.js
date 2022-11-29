const { readFileSync, existsSync } = require('fs')
const { join } = require('path')
const { installDeps, getPkgManage } = require('./tool')

const PATHS_DIR = [
    join(__dirname, 'pkg-to-update.json'),
    join(__dirname, '..', 'pkg-to-update.json'),
    join(__dirname, '..', '..', 'pkg-to-update.json'),
]

const PKG_TO_UPDATE = () => {
    const PATH_INDEX = PATHS_DIR.findIndex((a) => existsSync(a))
    const data = readFileSync(PATHS_DIR[PATH_INDEX], 'utf-8')
    const dataParse = JSON.parse(data)
    const pkg = Object.keys(dataParse).map((n) => `${n}@${dataParse[n]}`)
    return pkg
}

const installAll = async () => {
    const pkg = await getPkgManage()
    installDeps(pkg, PKG_TO_UPDATE()).runInstall()
}

module.exports = { installAll }
