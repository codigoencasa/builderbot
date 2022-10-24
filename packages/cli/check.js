const {red, yellow, green, bgCyan} = require('kleur')

const checkNodeVersion = () => {
    console.log(bgCyan('🚀 Revisando tu Node.js'))
    const version = process.version;
    const majorVersion = parseInt(version.replace('v','').split('.').shift())
    if(majorVersion < 16){
        console.error(
            red(`🔴 Se require Node.js 16 o superior. Actualmente esta ejecutando Node.js ${version}`)
        )
        process.exit(1)
    }
    console.log(green(`Node.js combatible ${version}`))
    console.log(``)

}

const checkOs = () => {
    console.log(bgCyan('🙂 Revisando tu Sistema Operativo'))
    const os = process.platform
    if(!os.includes('win32')){
        const messages = [
            `El sistema operativo actual (${os}) posiblemente requiera`,
            `una confiuración adicional referente al puppeter`,
            ``,
            `Recuerda pasar por el WIKI`,
            `🔗 https://github.com/leifermendez/bot-whatsapp/wiki/Instalaci%C3%B3n`,
            ``
        ]

        console.log(
            yellow(messages.join(' \n'))
        )
    }

    console.log(``)
}


module.exports ={ checkNodeVersion, checkOs }