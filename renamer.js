const fs = require('fs')
const path = require('path')

const BUSCAR = '@builderbot/'
const REEMPLAZAR = '@japcon-bot/'
const CARPETA_PACKAGES = path.join(__dirname, 'packages')

function actualizarObjetoDependencias(obj) {
    if (!obj) return
    for (const key in obj) {
        if (key.startsWith(BUSCAR)) {
            const nuevoNombre = key.replace(BUSCAR, REEMPLAZAR)
            obj[nuevoNombre] = obj[key]
            delete obj[key]
        }
    }
}

function procesarPackageJson(rutaArchivo) {
    try {
        const contenido = fs.readFileSync(rutaArchivo, 'utf8')
        const json = JSON.parse(contenido)
        let modificado = false

        if (json.name && json.name.startsWith(BUSCAR)) {
            json.name = json.name.replace(BUSCAR, REEMPLAZAR)
            modificado = true
        }

        if (json.dependencies) {
            actualizarObjetoDependencias(json.dependencies)
            modificado = true
        }
        if (json.devDependencies) {
            actualizarObjetoDependencias(json.devDependencies)
            modificado = true
        }
        if (json.peerDependencies) {
            actualizarObjetoDependencias(json.peerDependencies)
            modificado = true
        }

        if (modificado) {
            fs.writeFileSync(rutaArchivo, JSON.stringify(json, null, 2) + '\n', 'utf8')
            console.log(`✅ Modificado: ${path.relative(__dirname, rutaArchivo)}`)
        }
    } catch (error) {
        console.error(`❌ Error en ${rutaArchivo}:`, error.message)
    }
}

function buscarPackages(dir) {
    if (!fs.existsSync(dir)) return
    const archivos = fs.readdirSync(dir)

    for (const archivo of archivos) {
        // FILTRO CRÍTICO: Ignorar node_modules y carpetas de compilación dist
        if (archivo === 'node_modules' || archivo === 'dist' || archivo === '.turbo') {
            continue
        }

        const rutaCompleta = path.join(dir, archivo)
        const stat = fs.statSync(rutaCompleta)

        if (stat.isDirectory()) {
            buscarPackages(rutaCompleta)
        } else if (archivo === 'package.json') {
            procesarPackageJson(rutaCompleta)
        }
    }
}

console.log('🚀 Iniciando renombrado masivo (evitando node_modules)...')
buscarPackages(CARPETA_PACKAGES)
console.log('🏁 ¡Proceso terminado!')
