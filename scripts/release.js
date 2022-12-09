const { writeFile, readFileSync } = require('fs')
const { join } = require('path')
const { exec, spawn } = require('node:child_process')
const semver = require('semver')

const [PKG_ARG, PKG_ARG_VERSION] = process.argv.slice(2) || [null]
const PATH_PACKAGES = join(__dirname, '..', `packages`)

const readPackage = (packageName = null) => {
    const pkgJson = join(PATH_PACKAGES, packageName, 'package.json')
    const rawFile = readFileSync(pkgJson, 'utf-8')
    if (!rawFile) throw new Error(`ERROR_FILE_READ`)

    return JSON.parse(rawFile)
}

const updatePackage = (packageName = null, newPkgJson) => {
    const pkgJson = join(PATH_PACKAGES, packageName, 'package.json')
    writeFile(pkgJson, newPkgJson, (err) => {
        if (err) throw err
    })
}

/**
 * Actualizar ramdon version de package
 * @param {*} packageName
 */
const updateVersion = (packageName = null, number = null) => {
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
    updatePackage(packageName, newPkgJson)
    return { version: newVersion }
}

// const publishRelease = async (packageName) => {
//     const pkgTarName = `builder.io-qwik-${version}.tgz`
//     await execa('npm', ['pack'], { cwd: distPkgDir })
// }

/**
 * Recibe los argumentos entrantes
 */
if (PKG_ARG) {
    const pkgName = PKG_ARG ? PKG_ARG.split('=').at(1) : null
    const pkgNumber = PKG_ARG_VERSION ? PKG_ARG_VERSION.split('=').at(1) : null
    updateVersion(pkgName, pkgNumber)
}
