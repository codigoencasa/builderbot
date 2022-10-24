const {red, yellow} = require('kleur')

const checkNodeVersion = () => {
    const version = process.version;
    const majorVersion = parseInt(version.replace('v','').split('.').shift())
    if(majorVersion < 16){
        console.error(
            red(`🔴 Se require Node.js 16 o superior. Actualmente esta ejecutando Node.js ${version}`)
        )
        process.exit(1)
    }

}

const checkOs = () => {
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
}


module.exports ={ checkNodeVersion, checkOs }