const fs = require('fs-extra')

/**
 * Copy files
 */
const copyFiles = async (from, to) => {
    try {
        await fs.copy(from, to)
        console.log('success!')
    } catch (err) {
        console.error(err)
    }
}

/**
 * Copiar directorio con archivos
 * @param {*} templateName
 */
const copyBaseApp = async (templateName = null, rootDir = process.cwd()) => {
    const BASEP_APP_PATH_FROM = `${rootDir}/starters/apps/${templateName}`
    const BASEP_APP_PATH_TO = `${rootDir}/${templateName}`
    await copyFiles(BASEP_APP_PATH_FROM, BASEP_APP_PATH_TO)
}

module.exports = { copyBaseApp }
