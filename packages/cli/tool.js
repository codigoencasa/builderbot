const { red } = require('kleur')
const spawn = require('cross-spawn')
const { detect } = require('detect-package-manager')
const PKG_OPTION = {
    npm: 'install',
    yarn: 'add',
    pnpm: 'add'
}

const getPkgManage = async () => {
    const pkg = await detect()
    return pkg
}

const installDeps = (pkgManager, package) => {
    const errorMessage = `Ocurrio un error instalando ${package}`
    let childProcess = []

    const installSingle = (pkgInstall) => () => {
        new Promise((resolve, reject) => {
            try {
                childProcess = spawn(pkgManager, [PKG_OPTION[pkgManager], pkgInstall], {
                    stdio: 'inherit'
                })

                childProcess.on('error', (e) => {
                    console.error(e)
                    console.error(
                        red(errorMessage)
                    )
                    resolve()
                })

                childProcess.on('close', (code) => {
                    if (code === 0) {
                        resolve()
                    } else {
                        console.error(code)
                        console.error(
                            red(errorMessage)
                        )
                    }
                })

                resolve()
            } catch (e) {
                console.error(e)
                console.error(
                    red(errorMessage)
                )
            }

        })
    }

    if (typeof package === 'string') {
        childProcess.push(installSingle(package))
    } else {
        for (const pkg of package) {
            childProcess.push(installSingle(pkg))
        }
    }


    const runInstall = () => {
        return Promise.all(childProcess.map((i) => i()))
    }
    return { runInstall }

}

module.exports = { getPkgManage, installDeps }