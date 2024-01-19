import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

import { installDeps, getPkgManage } from './tool'

interface PackageToUpdate {
    [packageName: string]: string
}

const PATHS_DIR: string[] = [
    join(__dirname, 'pkg-to-update.json'),
    join(__dirname, '..', 'pkg-to-update.json'),
    join(__dirname, '..', '..', 'pkg-to-update.json'),
]

const PKG_TO_UPDATE = (): string[] => {
    const PATH_INDEX: number = PATHS_DIR.findIndex((a: string) => existsSync(a))
    if (PATH_INDEX === -1) {
        throw new Error('No package update file found.')
    }
    const data: string = readFileSync(PATHS_DIR[PATH_INDEX], 'utf-8')
    const dataParse: PackageToUpdate = JSON.parse(data)
    const pkg: string[] = Object.keys(dataParse).map((n: string) => `${n}@${dataParse[n]}`)
    return pkg
}

const installAll = async (): Promise<void> => {
    const pkgManager: string = await getPkgManage()
    installDeps(pkgManager, PKG_TO_UPDATE()).runInstall()
}

export { installAll }
