const { writeFile, readFileSync } = require('fs')
const { join } = require('path')
const { execFile } = require('node:child_process')
const process = require('node:process')
const util = require('node:util')

const OS_ENVIROMENT_WIN = process.platform.includes('win32')
const semver = require('semver')

const NPM_COMMAND = OS_ENVIROMENT_WIN ? 'npm.cmd' : 'npm'
const [PKG_ARG, PKG_ARG_VERSION, NPM_TOKEN] = process.argv.slice(2) || [null]
const PATH_PACKAGES = join(__dirname, '..', `packages`)

const cmd = util.promisify(execFile)

/**
 * Create Token
 */
const npmToken = (token = null) =>
    new Promise((resolve, reject) => {
        writeFile(
            `${process.cwd()}/.npmrc`,
            `//registry.npmjs.org/:_authToken=${token}`,
            (error) => {
                if (error) reject(error)
                resolve()
            }
        )
    })

/**
 * Leer package json
 * @param {*} packageName
 * @returns
 */
const readPackage = (packageName = null) => {
    const pkgJson = join(PATH_PACKAGES, packageName, 'package.json')
    const rawFile = readFileSync(pkgJson, 'utf-8')
    if (!rawFile) throw new Error(`ERROR_FILE_READ`)

    return JSON.parse(rawFile)
}

/**
 * Actualizar package json
 * @param {*} packageName
 * @param {*} newPkgJson
 */
const updatePackage = (packageName = null, newPkgJson) => {
    return new Promise((resolve, reject) => {
        const pkgJson = join(PATH_PACKAGES, packageName, 'package.json')
        if (!Object.keys(newPkgJson).length) throw new Error(`ERROR_FILE_READ`)
        writeFile(pkgJson, newPkgJson, (err) => {
            if (err) reject(err)
            resolve(true)
        })
    })
}

/**
 * Actualizar version
 * @param {*} packageName
 */
const updateVersion = async (packageName = null, number = null) => {
    if (!packageName) throw new Error(`PATH_ERROR_PACKAGE: ${packageName}`)

    const pkgJsonObject = readPackage(packageName)
    const { version } = pkgJsonObject
    const newVersion = !number
        ? semver.inc(version, 'prepatch', 'alpha')
        : `${number}`

    if (!semver.valid(newVersion))
        throw new Error(`VERSION_ERROR: ${newVersion}`)

    const newPkgJson = JSON.stringify(
        { ...pkgJsonObject, version: newVersion },
        null,
        2
    )
    await updatePackage(packageName, newPkgJson)
    return { version: newVersion }
}

/**
 * Revisar si la version nueva existe o no en npmjs
 * @param {*} packageName
 * @param {*} version
 * @returns
 */
const checkExistVersion = async (packageName = null, version = null) => {
    try {
        const pkgJson = join(PATH_PACKAGES, packageName)
        const pkgJsonObject = readPackage(packageName)
        const { stdout } = await cmd(
            NPM_COMMAND,
            ['view', `${pkgJsonObject.name}@${version}`],
            {
                stdio: 'inherit',
                cwd: pkgJson,
            }
        )
        return true
    } catch (e) {
        return false
    }
}

/**
 * Empaquetar
 * @param {*} packageName
 * @returns
 */
const packRelease = async (packageName) => {
    const pkgJson = join(PATH_PACKAGES, packageName)
    const { stdout } = await cmd(NPM_COMMAND, ['pack'], {
        stdio: 'inherit',
        cwd: pkgJson,
    })
    return stdout
}

/**
 * Lanzar release
 * @param {*} packageName
 * @param {*} latest
 * @returns
 */
const publishRelease = async (packageName, latest = null) => {
    const args = !latest ? ['--tag', 'dev'] : ['--access', 'public']
    const pkgJson = join(PATH_PACKAGES, packageName)
    const { stdout } = await cmd(NPM_COMMAND, ['publish'].concat(args), {
        stdio: 'inherit',
        cwd: pkgJson,
    })
    console.log(stdout)
    return stdout
}

/**
 * Recibe los argumentos entrantes
 */

/**
 * Init
 */
const main = async () => {
    if (PKG_ARG) {
        let EXIST_VERSION = true
        const tokenNpm = NPM_TOKEN ? NPM_TOKEN.split('=').at(1) : null
        const pkgName = PKG_ARG ? PKG_ARG.split('=').at(1) : null
        const pkgNumber = PKG_ARG_VERSION
            ? PKG_ARG_VERSION.split('=').at(1)
            : null
        if (tokenNpm) await npmToken(tokenNpm)

        while (EXIST_VERSION) {
            const { version } = await updateVersion(pkgName, pkgNumber)
            EXIST_VERSION = await checkExistVersion(pkgName, version)
            console.log(`[${pkgName} - Version]: `, version, EXIST_VERSION)
        }
        await packRelease(pkgName)
        await publishRelease(pkgName, pkgNumber)
    }
}

main()
