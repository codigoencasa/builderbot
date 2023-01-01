const { execFile } = require('node:child_process')
const { readFileSync, writeFileSync, readdirSync } = require('node:fs')
const { join } = require('path')
const process = require('node:process')
const util = require('node:util')
const semver = require('semver')

const cmd = util.promisify(execFile)
const OS_ENVIROMENT_WIN = process.platform.includes('win32')

const PATH_PACKAGES = join(__dirname, '..', `packages`)
const PATH_STARTERS = join(__dirname, '..', `starters`, `apps`)
const NPM_COMMAND = OS_ENVIROMENT_WIN ? 'npm.cmd' : 'npm'
const [PKG_NAME] = process.argv.slice(2) || [null]

/**
 * Revisar ultima version de una paquetes
 * @param {*} pkgName
 */
const checkPkg = async (pkgName = '') => {
    const { stdout } = await cmd(
        NPM_COMMAND,
        ['show', `${pkgName}`, 'version'],
        {
            stdio: 'inherit',
        }
    )

    return stdout.trim().replace('\n', '')
}

/**
 * Revisar todas las dependencias del provider
 * @param {*} provider
 * @returns
 */
const checkEveryProvider = async (provider = '') => {
    const pkgDependencies = readFileSync(
        join(PATH_PACKAGES, 'provider', 'src', provider, 'package.json')
    )
    try {
        const { dependencies } = JSON.parse(pkgDependencies)
        const devParse = Object.entries(dependencies)
        const newDevParse = {}
        for (const [pkgName] of devParse) {
            const lastVersion = await checkPkg(pkgName)
            newDevParse[pkgName] = lastVersion
        }
        return newDevParse
    } catch (e) {
        console.log(e)
        return {}
    }
}

/**
 * Actualizar depedencias con nuevas versiones
 * @param {*} provider
 * @param {*} list
 * @returns
 */
const updateDependencies = async (provider = '', list = {}) => {
    const pathProvider = join(
        PATH_PACKAGES,
        'provider',
        'src',
        provider,
        'package.json'
    )

    try {
        const pkgDependencies = readFileSync(pathProvider)
        const { dependencies } = JSON.parse(pkgDependencies)
        writeFileSync(
            pathProvider,
            JSON.stringify(
                { dependencies: { ...dependencies, ...list } },
                null,
                2
            )
        )
    } catch (e) {
        console.log(e)
        return {}
    }
}

/**
 * Actualizar starters
 * @param {*} provider
 * @returns
 */
const updateStarters = async (provider = '', updateDev = {}) => {
    provider = provider === 'web-whatsapp' ? 'wweb' : provider
    const allStarters = readdirSync(PATH_STARTERS).filter((n) =>
        n.includes(provider)
    )

    try {
        for (const base of allStarters) {
            const pkgDependenciesBase = readFileSync(
                join(PATH_STARTERS, base, 'package.json')
            )
            const pkgBase = JSON.parse(pkgDependenciesBase)
            writeFileSync(
                join(PATH_STARTERS, base, 'package.json'),
                JSON.stringify(
                    {
                        ...pkgBase,
                        dependencies: { ...pkgBase.dependencies, ...updateDev },
                    },
                    null,
                    2
                )
            )
        }
    } catch (e) {
        console.log(e)
        return
    }
}

const main = async () => {
    if (PKG_NAME) {
        const list = await checkEveryProvider(PKG_NAME)
        await updateDependencies(PKG_NAME, list)
        await updateStarters(PKG_NAME, list)
    }
}

main()
