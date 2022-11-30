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

const copyBaseApp = async () => {
    const BASEP_APP_PATH_FROM = `${process.cwd()}/starters/apps/base`
    const BASEP_APP_PATH_TO = `${process.cwd()}/example-app-base`
    await copyFiles(BASEP_APP_PATH_FROM, BASEP_APP_PATH_TO)
}

module.exports = { copyBaseApp }
