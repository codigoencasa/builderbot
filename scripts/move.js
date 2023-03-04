const fs = require('fs-extra')
const PACKAGES_PATH = `${process.cwd()}/packages`
const NAME_PREFIX = `@bot-whatsapp`

const [, , appDir] = process.argv || []

const copyLibPkg = async (pkgName, to) => {
    const FROM = `${PACKAGES_PATH}/${pkgName}`
    const TO = `${process.cwd()}/${to}/node_modules/${NAME_PREFIX}/${pkgName}`
    await fs.copy(`${FROM}/lib`, `${TO}/lib`, { overwrite: true })
    await fs.copy(`${FROM}/package.json`, `${TO}/package.json`)
}

const listLib = ['create-bot-whatsapp', 'bot', 'database', 'provider', 'contexts', 'portal']

const main = async () => {
    for (const iterator of listLib) {
        await copyLibPkg(iterator, appDir)
        console.log(`${iterator}: Copiado ✅`)
    }
}

main()
