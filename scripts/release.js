const { writeFile, readFileSync } = require('fs')
const { join } = require('path')
const PATH_PACKAGES = join(__dirname, '..', `packages`)
const [PKG_ARG, PKG_ARG_VERSION] = process.argv.slice(2) || [null]

/**
 * Actualizar ramdon version de package
 * @param {*} packageName
 */
const updateVersion = (packageName = null, number = null) => {
    if (!packageName) throw new Error(`PATH_ERROR_PACKAGE: ${packageName}`)
    const pkgJson = join(PATH_PACKAGES, packageName, 'package.json')
    const rawFile = readFileSync(pkgJson, 'utf-8')

    if (!rawFile) throw new Error(`ERROR_FILE_READ`)
    let pkgJsonObject = JSON.parse(rawFile)
    const build = !number ? Date.now() : number
    let [versionNumber] = pkgJsonObject.version.split('-')
    pkgJsonObject.version = !number ? `${versionNumber}-${build}` : `${number}`
    pkgJsonObject = JSON.stringify(pkgJsonObject)
    writeFile(pkgJson, pkgJsonObject, (err) => {
        if (err) throw err
    })
}

/**
 * Recibe los argumentos entrantes
 */
if (PKG_ARG) {
    const pkgName = PKG_ARG ? PKG_ARG.split('=').at(1) : null
    const pkgNumber = PKG_ARG_VERSION ? PKG_ARG_VERSION.split('=').at(1) : null
    updateVersion(pkgName, pkgNumber)
}
