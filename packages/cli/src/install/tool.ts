import kleur from 'kleur'
import spawn from 'cross-spawn'

type PackageManager = 'npm' | 'yarn' | 'pnpm'
const PKG_OPTION: Record<PackageManager, string> = {
    npm: 'install',
    yarn: 'add',
    pnpm: 'add',
}

const getPkgManage = async (): Promise<PackageManager> => {
    return 'npm'
}

const installDeps = (pkgManager: string, packageList: string | string[]) => {
    const errorMessage = `Ocurrió un error instalando ${packageList}`
    let childProcesses: (() => Promise<void>)[] = []

    const installSingle = (pkgInstall: string): (() => Promise<void>) => {
        return () =>
            new Promise<void>((resolve) => {
                try {
                    const childProcess = spawn(pkgManager, [PKG_OPTION[pkgManager], pkgInstall], {
                        stdio: 'inherit',
                    })

                    childProcess.on('error', (e) => {
                        console.error(e)
                        console.error(kleur.red(errorMessage))
                        resolve()
                    })

                    childProcess.on('close', (code) => {
                        if (code === 0) {
                            resolve()
                        } else {
                            console.error(code)
                            console.error(kleur.red(errorMessage))
                        }
                    })
                } catch (e) {
                    console.error(e)
                    console.error(kleur.red(errorMessage))
                    resolve()
                }
            })
    }

    if (typeof packageList === 'string') {
        childProcesses.push(installSingle(packageList))
    } else {
        for (const pkg of packageList) {
            childProcesses.push(installSingle(pkg))
        }
    }

    const runInstall = (): Promise<void[]> => {
        return Promise.all(childProcesses.map((install) => install()))
    }
    return { runInstall }
}

export { getPkgManage, installDeps }
