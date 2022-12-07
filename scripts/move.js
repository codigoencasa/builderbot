const fs = require('fs-extra')
const PACKAGES_PATH = `${process.cwd()}/packages`
const NAME_PREFIX = `@bot-whatsapp`

const [, , appDir] = process.argv || []

const copyLibPkg = async (pkgName, to) => {
    const FROM = `${PACKAGES_PATH}/${pkgName}`
    const TO = `${process.cwd()}/${to}/node_modules/${NAME_PREFIX}/${pkgName}`
    await fs.copy(FROM, TO)
}

Promise.all([
    copyLibPkg('create-bot-whatsapp', appDir),
    copyLibPkg('bot', appDir),
    copyLibPkg('database', appDir),
    copyLibPkg('provider', appDir),
]).then(() => console.log('Todas las lib copiadas'))
