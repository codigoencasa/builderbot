const process = require('node:process')
const { execSync } = require('node:child_process')
const fs = require('fs-extra')
const path = require('node:path')
const { OpenAI } = require('openai')

/**
 * Obtener el tag anterior desde git
 * @param {string} currentVersion
 * @returns {string|null}
 */
const getPreviousTag = (currentVersion) => {
    try {
        // Normalizar la versión actual (con y sin prefijo v)
        const currentTagWithV = currentVersion.startsWith('v') ? currentVersion : `v${currentVersion}`
        const currentTagWithoutV = currentVersion.startsWith('v') ? currentVersion.substring(1) : currentVersion

        // Obtener todos los tags ordenados por versión
        const tags = execSync('git tag --sort=-version:refname', { encoding: 'utf-8' })
            .trim()
            .split('\n')
            .filter(Boolean)

        if (tags.length === 0) {
            return null
        }

        // Encontrar el índice del tag actual
        const currentIndex = tags.findIndex(
            (tag) => tag === currentVersion || tag === currentTagWithV || tag === currentTagWithoutV
        )

        if (currentIndex === -1) {
            // Si no se encuentra el tag actual, intentar obtener el último tag antes del HEAD
            try {
                const previousTag = execSync('git describe --tags --abbrev=0 HEAD^ 2>/dev/null', {
                    encoding: 'utf-8',
                }).trim()
                return previousTag || tags[0] || null
            } catch {
                return tags[0] || null
            }
        }

        // Si es el primer tag, no hay anterior
        if (currentIndex === tags.length - 1) {
            return null
        }

        // Retornar el tag anterior en la lista
        return tags[currentIndex + 1] || null
    } catch (error) {
        console.warn('⚠️ No se pudo obtener el tag anterior:', error.message)
        return null
    }
}

/**
 * Obtener commits entre dos tags
 * @param {string} previousTag
 * @param {string} currentTag
 * @returns {Array<{hash: string, message: string, author: string, date: string}>}
 */
const getCommitsBetweenTags = (previousTag, currentTag) => {
    try {
        let range
        if (previousTag) {
            range = `${previousTag}..${currentTag}`
        } else {
            // Si no hay tag anterior, obtener commits desde el tag actual hasta HEAD
            // o todos los commits si el tag no existe aún
            try {
                execSync(`git rev-parse ${currentTag}`, { encoding: 'utf-8', stdio: 'ignore' })
                range = `${currentTag}..HEAD`
            } catch {
                // El tag no existe aún, obtener los últimos commits
                range = `HEAD~50..HEAD`
            }
        }

        const format = '%h|%s|%an|%ad'
        const log = execSync(`git log ${range} --pretty=format:"${format}" --date=short`, {
            encoding: 'utf-8',
        }).trim()

        if (!log) {
            return []
        }

        return log.split('\n').map((line) => {
            const [hash, ...rest] = line.split('|')
            const date = rest.pop()
            const author = rest.pop()
            const message = rest.join('|')

            return {
                hash,
                message,
                author,
                date,
            }
        })
    } catch (error) {
        console.warn('⚠️ No se pudieron obtener los commits:', error.message)
        return []
    }
}

/**
 * Obtener estadísticas de cambios entre tags
 * @param {string} previousTag
 * @param {string} currentTag
 * @returns {string}
 */
const getChangeStats = (previousTag, currentTag) => {
    try {
        let range
        if (previousTag) {
            range = `${previousTag}..${currentTag}`
        } else {
            // Si no hay tag anterior, intentar obtener stats desde el tag actual hasta HEAD
            // o desde HEAD~50 hasta HEAD si el tag no existe
            try {
                execSync(`git rev-parse ${currentTag}`, { encoding: 'utf-8', stdio: 'ignore' })
                range = `${currentTag}..HEAD`
            } catch {
                range = `HEAD~50..HEAD`
            }
        }
        const stats = execSync(`git diff --stat ${range}`, { encoding: 'utf-8' }).trim()
        return stats || 'No hay estadísticas disponibles'
    } catch (error) {
        console.warn('⚠️ No se pudieron obtener las estadísticas:', error.message)
        return 'No hay estadísticas disponibles'
    }
}

/**
 * Obtener lista de archivos modificados entre tags
 * @param {string} previousTag
 * @param {string} currentTag
 * @returns {Array<string>}
 */
const getChangedFiles = (previousTag, currentTag) => {
    try {
        let range
        if (previousTag) {
            range = `${previousTag}..${currentTag}`
        } else {
            try {
                execSync(`git rev-parse ${currentTag}`, { encoding: 'utf-8', stdio: 'ignore' })
                range = `${currentTag}..HEAD`
            } catch {
                range = `HEAD~50..HEAD`
            }
        }
        const files = execSync(`git diff --name-status ${range}`, { encoding: 'utf-8' }).trim()
        if (!files) {
            return []
        }
        return files.split('\n').filter(Boolean)
    } catch (error) {
        console.warn('⚠️ No se pudieron obtener los archivos modificados:', error.message)
        return []
    }
}

/**
 * Obtener cambios de código relevantes (resumen de diff)
 * @param {string} previousTag
 * @param {string} currentTag
 * @returns {string}
 */
const getCodeChanges = (previousTag, currentTag) => {
    try {
        let range
        if (previousTag) {
            range = `${previousTag}..${currentTag}`
        } else {
            try {
                execSync(`git rev-parse ${currentTag}`, { encoding: 'utf-8', stdio: 'ignore' })
                range = `${currentTag}..HEAD`
            } catch {
                range = `HEAD~50..HEAD`
            }
        }
        // Obtener un resumen de los cambios (solo archivos .ts, .js, .tsx, .jsx)
        const diff = execSync(`git diff ${range} -- '*.ts' '*.js' '*.tsx' '*.jsx' | head -500`, {
            encoding: 'utf-8',
            maxBuffer: 1024 * 1024 * 5,
        }).trim()
        return diff || 'No hay cambios de código relevantes'
    } catch (error) {
        console.warn('⚠️ No se pudieron obtener los cambios de código:', error.message)
        return 'No hay cambios de código disponibles'
    }
}

/**
 * Obtener snippets de código relevantes de archivos modificados
 * @param {string} previousTag
 * @param {string} currentTag
 * @param {Array} changedFiles
 * @returns {Array<{file: string, snippets: string}>}
 */
const getCodeSnippets = (previousTag, currentTag, changedFiles) => {
    const snippets = []
    let range
    if (previousTag) {
        range = `${previousTag}..${currentTag}`
    } else {
        try {
            execSync(`git rev-parse ${currentTag}`, { encoding: 'utf-8', stdio: 'ignore' })
            range = `${currentTag}..HEAD`
        } catch {
            range = `HEAD~50..HEAD`
        }
    }

    // Filtrar solo archivos de código relevantes
    const codeFiles = changedFiles
        .map((f) => {
            const parts = f.split('\t')
            return parts.length > 1 ? parts[1] : parts[0]
        })
        .filter(
            (file) =>
                file &&
                (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.tsx') || file.endsWith('.jsx')) &&
                !file.includes('node_modules') &&
                !file.includes('dist/') &&
                !file.includes('.test.') &&
                !file.includes('__tests__')
        )
        .slice(0, 10) // Limitar a 10 archivos más importantes

    for (const file of codeFiles) {
        try {
            // Obtener diff específico del archivo
            const diff = execSync(`git diff ${range} -- "${file}"`, {
                encoding: 'utf-8',
                maxBuffer: 1024 * 1024 * 2,
            }).trim()

            if (diff && diff.length > 100) {
                // Extraer solo las partes relevantes del diff (hunks con contexto)
                const lines = diff.split('\n')
                const relevantLines = []
                let inHunk = false
                let hunkLines = 0

                for (let i = 0; i < lines.length && relevantLines.length < 100; i++) {
                    const line = lines[i]
                    if (line.startsWith('@@')) {
                        inHunk = true
                        hunkLines = 0
                        relevantLines.push(line)
                    } else if (inHunk) {
                        if (line.startsWith('+') || line.startsWith('-')) {
                            relevantLines.push(line)
                            hunkLines++
                            if (hunkLines > 30) {
                                // Limitar el tamaño de cada hunk
                                inHunk = false
                            }
                        } else if (line.startsWith(' ')) {
                            // Líneas de contexto
                            if (hunkLines < 30) {
                                relevantLines.push(line)
                            }
                        }
                    }
                }

                if (relevantLines.length > 0) {
                    snippets.push({
                        file,
                        snippets: relevantLines.join('\n').substring(0, 2000), // Limitar tamaño
                    })
                }
            }
        } catch (error) {
            // Ignorar errores en archivos individuales
            continue
        }
    }

    return snippets
}

/**
 * Obtener ejemplos de uso de nuevas funcionalidades
 * @param {Array} commits
 * @param {Array} codeSnippets
 * @returns {Array<string>}
 */
const getUsageExamples = (commits, codeSnippets) => {
    const examples = []
    const featureCommits = commits.filter(
        (c) =>
            c.message.toLowerCase().includes('feat') ||
            c.message.toLowerCase().includes('add') ||
            c.message.toLowerCase().includes('nuevo') ||
            c.message.toLowerCase().includes('implement')
    )

    // Buscar en los snippets funciones o métodos nuevos
    for (const snippet of codeSnippets) {
        const lines = snippet.snippets.split('\n')
        for (const line of lines) {
            if (
                line.startsWith('+') &&
                (line.includes('function') || line.includes('export') || line.includes('class'))
            ) {
                // Intentar extraer el nombre de la función/clase
                const match = line.match(/(?:function|export\s+(?:function|class|const|let)\s+)(\w+)/)
                if (match) {
                    examples.push(`Nueva funcionalidad detectada: ${match[1]}`)
                }
            }
        }
    }

    return examples
}

/**
 * Generar resumen con OpenAI
 * @param {string} openaiApiKey
 * @param {Array} commits
 * @param {string} changeStats
 * @param {Array} changedFiles
 * @param {string} codeChanges
 * @param {Array} codeSnippets
 * @param {string} previousVersion
 * @param {string} currentVersion
 * @returns {Promise<string>}
 */
const generateAISummary = async (
    openaiApiKey,
    commits,
    changeStats,
    changedFiles,
    codeChanges,
    codeSnippets,
    previousVersion,
    currentVersion
) => {
    const openai = new OpenAI({
        apiKey: openaiApiKey,
    })

    const commitsText = commits
        .map((c) => `- ${c.hash.substring(0, 7)}: ${c.message} (${c.author}, ${c.date})`)
        .join('\n')

    const filesText = changedFiles
        .slice(0, 50)
        .map((f) => {
            const [status, ...fileParts] = f.split('\t')
            const file = fileParts.join('\t')
            const statusEmoji = status === 'A' ? '➕' : status === 'D' ? '➖' : status === 'M' ? '📝' : '🔄'
            return `${statusEmoji} ${status}: ${file}`
        })
        .join('\n')

    // Limitar el tamaño de codeChanges para no exceder tokens
    const codeChangesSummary = codeChanges.length > 3000 ? codeChanges.substring(0, 3000) + '...' : codeChanges

    // Formatear snippets para el prompt
    const snippetsText = codeSnippets
        .map((s) => {
            return `### Archivo: ${s.file}\n\`\`\`diff\n${s.snippets.substring(0, 1500)}\n\`\`\``
        })
        .join('\n\n')

    const prompt = `Eres un experto en documentación técnica orientada a desarrolladores. Tu objetivo es crear un resumen de release que sea CLARO, PRÁCTICO y ORIENTADO AL USUARIO/DEVELOPER. Escribe como si estuvieras explicando a un desarrollador qué puede hacer ahora con esta nueva versión, qué problemas resuelve y cómo puede usarlo. Usa un lenguaje cercano, práctico y enfocado en beneficios.

Versión anterior: ${previousVersion || 'N/A'}
Versión nueva: ${currentVersion}

## Commits realizados:
${commitsText || 'No hay commits disponibles'}

## Estadísticas de cambios:
${changeStats}

## Archivos modificados:
${filesText || 'No hay archivos modificados'}

## Cambios de código (resumen):
\`\`\`
${codeChangesSummary || 'No hay cambios de código disponibles'}
\`\`\`

## Snippets de código relevantes:
${snippetsText || 'No hay snippets disponibles'}

## Instrucciones:

Analiza TODOS los commits, archivos modificados y cambios de código para generar un resumen DETALLADO que incluya:

1. **Título**: # Release v${currentVersion}

2. **Resumen Ejecutivo** (3-5 líneas): 
   - Escribe de forma clara qué incluye esta versión
   - Usa frases como "Se implementó...", "Ahora puedes...", "Es más fácil...", "Ya no necesitas..."
   - Enfócate en los beneficios prácticos para el desarrollador

3. **🚀 Nuevas Funcionalidades** (si aplica):
   - Para cada nueva funcionalidad, explica de forma práctica:
     * **Qué se implementó**: Describe la funcionalidad de forma clara
     * **Para qué sirve**: Explica el caso de uso o problema que resuelve
     * **Cómo usarlo**: Proporciona ejemplos prácticos de código
     * **Beneficios**: "Ahora puedes...", "Es más fácil...", "Ya no necesitas..."
     * **INCLUYE UN SNIPPET DE CÓDIGO** con un ejemplo de uso real y práctico
     * Si es posible, muestra código antes/después o un ejemplo completo de implementación
     * Usa frases como: "Puedes usar X para Y", "Ahora puedes hacer Z de esta forma..."

4. **🐛 Correcciones de Bugs** (si aplica):
   - Para cada bug corregido, explica de forma práctica:
     * **Qué problema se solucionó**: Describe el problema que tenían los usuarios
     * **Qué causaba el problema**: Explica brevemente la causa
     * **Cómo se corrigió**: Muestra el cambio técnico
     * **Beneficio para el usuario**: "Ahora ya no ocurre...", "Es más estable...", "Funciona correctamente..."
     * **INCLUYE UN SNIPPET DE CÓDIGO** mostrando el código corregido o la diferencia antes/después

5. **⚡ Mejoras y Optimizaciones** (si aplica):
   - Para cada mejora, explica de forma práctica:
     * **Qué se mejoró**: Describe la mejora
     * **Por qué era necesario**: Explica el problema o limitación anterior
     * **Beneficios prácticos**: "Es más rápido...", "Consume menos recursos...", "Es más eficiente...", "Mejor rendimiento..."
     * **Cómo afecta al usuario**: Explica qué nota el desarrollador al usar la librería
     * **INCLUYE UN SNIPPET DE CÓDIGO** mostrando el código mejorado si es relevante

6. **📝 Cambios Técnicos** (si aplica):
   - Refactorizaciones
   - Actualizaciones de dependencias
   - Cambios en la arquitectura
   - Mejoras en el código

7. **🔄 Archivos Modificados** (resumen):
   - Lista de los archivos más importantes que cambiaron
   - Explica brevemente qué cambió en cada uno

8. **📋 Detalles de Commits**:
   - Lista los commits más relevantes con una breve explicación de cada uno

ESTILO DE ESCRITURA (MUY IMPORTANTE):
- **Lenguaje orientado al desarrollador/usuario**: Escribe como si le estuvieras hablando directamente a un desarrollador que usa la librería
- **Usa frases prácticas**: 
  * "Se implementó X que ahora permite Y"
  * "Ahora puedes usar Z para hacer W"
  * "Es más fácil hacer A porque B"
  * "Ya no necesitas hacer C manualmente"
  * "Puedes usar D para E"
  * "Esto resuelve el problema de F"
- **Enfócate en beneficios**: Siempre explica QUÉ puede hacer el usuario ahora, no solo qué cambió técnicamente
- **Ejemplos prácticos**: Cada funcionalidad debe tener un ejemplo de código que muestre cómo usarla
- **Lenguaje cercano pero profesional**: No seas demasiado formal, pero mantén la profesionalidad

REQUISITOS TÉCNICOS:
- **SIEMPRE INCLUYE SNIPPETS DE CÓDIGO** en las secciones relevantes con ejemplos REALES y PRÁCTICOS
- Usa bloques de código con sintaxis highlighting apropiado (typescript, javascript, diff, etc.)
- Para nuevas funcionalidades, muestra un ejemplo COMPLETO de uso que un desarrollador pueda copiar y usar
- Para correcciones, muestra el código antes/después cuando sea posible
- Sé ESPECÍFICO y DETALLADO. No uses frases genéricas como "mejoras generales"
- Analiza los mensajes de commit y los cambios de código para entender qué se hizo realmente
- Si un commit dice "fix: version", explica qué problema tenía el usuario y cómo se solucionó
- Si hay merges, ignóralos a menos que sean relevantes
- Si hay commits de release/chore, explícalos brevemente desde la perspectiva del usuario
- Los snippets de código deben ser relevantes, prácticos y mostrar cómo usar las nuevas funcionalidades

El formato debe ser profesional, bien estructurado, fácil de leer, con ejemplos de código PRÁCTICOS y un lenguaje que hable directamente al desarrollador explicando QUÉ PUEDE HACER AHORA con esta versión.`

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content:
                        'Eres un experto en documentación técnica orientada a desarrolladores. Tu especialidad es explicar cambios técnicos de forma clara, práctica y enfocada en los beneficios para el usuario. Escribes como si le estuvieras hablando directamente a un desarrollador, explicándole qué puede hacer ahora, qué problemas se resolvieron y cómo puede usar las nuevas funcionalidades. Usas un lenguaje cercano, práctico, con ejemplos de código reales y siempre enfocas en los beneficios prácticos.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.7,
            max_tokens: 4000,
        })

        return response.choices[0].message.content.trim()
    } catch (error) {
        console.error('❌ Error al generar resumen con IA:', error.message)
        throw error
    }
}

/**
 * Categorizar commits por tipo
 * @param {Array} commits
 * @returns {Object}
 */
const categorizeCommits = (commits) => {
    const categories = {
        features: [],
        fixes: [],
        improvements: [],
        chore: [],
        docs: [],
        refactor: [],
        other: [],
    }

    commits.forEach((commit) => {
        const msg = commit.message.toLowerCase()
        if (msg.startsWith('feat:') || msg.startsWith('feature:') || msg.includes('add') || msg.includes('nuevo')) {
            categories.features.push(commit)
        } else if (
            msg.startsWith('fix:') ||
            msg.startsWith('bugfix:') ||
            msg.includes('fix') ||
            msg.includes('correg')
        ) {
            categories.fixes.push(commit)
        } else if (
            msg.startsWith('improve:') ||
            msg.startsWith('perf:') ||
            msg.includes('mejor') ||
            msg.includes('optimiz')
        ) {
            categories.improvements.push(commit)
        } else if (msg.startsWith('refactor:') || msg.includes('refactor')) {
            categories.refactor.push(commit)
        } else if (msg.startsWith('docs:') || msg.includes('document')) {
            categories.docs.push(commit)
        } else if (msg.startsWith('chore:') || msg.includes('release') || msg.includes('version')) {
            categories.chore.push(commit)
        } else {
            categories.other.push(commit)
        }
    })

    return categories
}

/**
 * Generar resumen fallback si OpenAI falla
 * @param {Array} commits
 * @param {Array} changedFiles
 * @param {Array} codeSnippets
 * @param {string} currentVersion
 * @param {string} previousVersion
 * @returns {string}
 */
const generateFallbackSummary = (commits, changedFiles, codeSnippets, currentVersion, previousVersion) => {
    const date = new Date().toISOString().split('T')[0]
    const categories = categorizeCommits(commits)

    let content = `# Release v${currentVersion}\n\n`
    content += `**Fecha:** ${date}\n\n`
    content += `**Versión anterior:** ${previousVersion || 'N/A'}\n\n`

    // Resumen ejecutivo
    content += `## 📋 Resumen Ejecutivo\n\n`
    const totalChanges = categories.features.length + categories.fixes.length + categories.improvements.length
    if (totalChanges > 0) {
        content += `Esta versión incluye ${commits.length} commit(s) con `
        const parts = []
        if (categories.features.length > 0) parts.push(`${categories.features.length} nueva(s) funcionalidad(es)`)
        if (categories.fixes.length > 0) parts.push(`${categories.fixes.length} corrección(es)`)
        if (categories.improvements.length > 0) parts.push(`${categories.improvements.length} mejora(s)`)
        content += parts.join(', ') + '.\n\n'
    } else {
        content += `Esta versión incluye ${commits.length} commit(s) con mejoras y correcciones.\n\n`
    }

    // Nuevas funcionalidades
    if (categories.features.length > 0) {
        content += `## 🚀 Nuevas Funcionalidades\n\n`
        categories.features.forEach((commit) => {
            content += `- **${commit.message}**\n`
            content += `  - Commit: \`${commit.hash.substring(0, 7)}\` | Autor: ${commit.author} | Fecha: ${
                commit.date
            }\n`

            // Buscar snippets relacionados con este commit
            const relatedSnippets = codeSnippets.filter((s) => {
                // Intentar encontrar archivos relacionados con el commit
                return true // Por ahora mostrar todos los snippets relevantes
            })

            if (relatedSnippets.length > 0) {
                const snippet = relatedSnippets[0]
                content += `\n  **Código relacionado:**\n\n`
                content += `  \`\`\`diff\n`
                content += `  ${snippet.snippets.split('\n').slice(0, 15).join('\n  ')}\n`
                content += `  \`\`\`\n\n`
            } else {
                content += `\n`
            }
        })
    }

    // Correcciones
    if (categories.fixes.length > 0) {
        content += `## 🐛 Correcciones de Bugs\n\n`
        categories.fixes.forEach((commit) => {
            content += `- **${commit.message}**\n`
            content += `  - Commit: \`${commit.hash.substring(0, 7)}\` | Autor: ${commit.author} | Fecha: ${
                commit.date
            }\n`

            // Buscar snippets relacionados
            if (codeSnippets.length > 0) {
                const snippet = codeSnippets[0]
                content += `\n  **Código corregido:**\n\n`
                content += `  \`\`\`diff\n`
                content += `  ${snippet.snippets.split('\n').slice(0, 15).join('\n  ')}\n`
                content += `  \`\`\`\n\n`
            } else {
                content += `\n`
            }
        })
    }

    // Mejoras
    if (categories.improvements.length > 0) {
        content += `## ⚡ Mejoras y Optimizaciones\n\n`
        categories.improvements.forEach((commit) => {
            content += `- **${commit.message}**\n`
            content += `  - Commit: \`${commit.hash.substring(0, 7)}\` | Autor: ${commit.author} | Fecha: ${
                commit.date
            }\n\n`
        })
    }

    // Refactorizaciones
    if (categories.refactor.length > 0) {
        content += `## 🔄 Refactorizaciones\n\n`
        categories.refactor.forEach((commit) => {
            content += `- **${commit.message}**\n`
            content += `  - Commit: \`${commit.hash.substring(0, 7)}\` | Autor: ${commit.author} | Fecha: ${
                commit.date
            }\n\n`
        })
    }

    // Archivos modificados
    if (changedFiles.length > 0) {
        content += `## 📁 Archivos Modificados\n\n`
        const importantFiles = changedFiles
            .filter((f) => {
                const file = f.split('\t')[1] || f
                return (
                    !file.includes('node_modules') &&
                    !file.includes('.log') &&
                    !file.includes('dist/') &&
                    !file.includes('.lock')
                )
            })
            .slice(0, 30)

        importantFiles.forEach((file) => {
            const [status, ...fileParts] = file.split('\t')
            const fileName = fileParts.join('\t')
            const statusEmoji = status === 'A' ? '➕' : status === 'D' ? '➖' : status === 'M' ? '📝' : '🔄'
            content += `- ${statusEmoji} \`${fileName}\`\n`
        })
        content += `\n`
    }

    // Otros commits
    if (categories.other.length > 0 || categories.chore.length > 0) {
        content += `## 📝 Otros Cambios\n\n`
        ;[...categories.chore, ...categories.other].forEach((commit) => {
            content += `- \`${commit.hash.substring(0, 7)}\` ${commit.message} (_${commit.author}_, ${commit.date})\n`
        })
    }

    return content
}

/**
 * Obtener comandos de actualización para todos los paquetes
 * @param {string} currentVersion
 * @returns {string}
 */
const getUpdateCommands = (currentVersion) => {
    try {
        const lernaConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'lerna.json'), 'utf-8'))
        const packages = lernaConfig.packages || []
        const commands = []

        for (const packagePath of packages) {
            try {
                const packageJsonPath = path.join(process.cwd(), packagePath, 'package.json')
                if (fs.existsSync(packageJsonPath)) {
                    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
                    const packageName = packageJson.name

                    if (packageName) {
                        commands.push(`pnpm add ${packageName}@latest`)
                    }
                }
            } catch (error) {
                // Ignorar errores en paquetes individuales
                continue
            }
        }

        if (commands.length === 0) {
            return ''
        }

        // Siempre mostrar @builderbot/bot y @builderbot/provider-baileys como ejemplos
        let content = `\n## 📦 Actualizar a la última versión\n\n`
        content += `Para actualizar a la versión \`${currentVersion}\`, ejecuta:\n\n`
        content += `\`\`\`bash\n`
        content += `pnpm add @builderbot/bot@${currentVersion} @builderbot/provider-baileys@${currentVersion}\n`
        content += `\`\`\`\n\n`
        content += `Si quieres actualizar otro paquete, reemplaza el nombre del paquete y agrega \`@${currentVersion}\`.\n`

        return content
    } catch (error) {
        console.warn('⚠️ No se pudieron obtener los comandos de actualización:', error.message)
        return ''
    }
}

/**
 * Función principal
 */
const main = async () => {
    const args = process.argv.slice(2)
    const versionArg = args.find((arg) => arg.startsWith('--version='))
    const apiKeyArg = args.find((arg) => arg.startsWith('--api-key='))

    if (!versionArg) {
        console.error('❌ Error: Se requiere --version=VERSION')
        process.exit(1)
    }

    const currentVersion = versionArg.split('=')[1]
    const openaiApiKey = apiKeyArg ? apiKeyArg.split('=')[1] : process.env.OPENAI_API_KEY

    if (!openaiApiKey) {
        console.warn('⚠️ OPENAI_API_KEY no proporcionada. Se generará un resumen básico.')
    }

    console.log(`📦 Generando resumen para versión: ${currentVersion}`)

    // Obtener tag anterior
    const previousTag = getPreviousTag(currentVersion)
    // Lerna crea tags sin prefijo 'v', pero también puede haber tags con 'v'
    const currentTag = currentVersion.startsWith('v') ? currentVersion : currentVersion
    const currentTagWithV = currentVersion.startsWith('v') ? currentVersion : `v${currentVersion}`

    console.log(`🔍 Tag anterior: ${previousTag || 'No encontrado (primera versión)'}`)
    console.log(`🔍 Tag actual: ${currentTag}`)

    // Obtener commits - intentar con y sin prefijo v
    // Primero verificar si el tag existe
    let tagExists = false
    try {
        execSync(`git rev-parse ${currentTag}`, { encoding: 'utf-8', stdio: 'ignore' })
        tagExists = true
    } catch {
        try {
            execSync(`git rev-parse ${currentTagWithV}`, { encoding: 'utf-8', stdio: 'ignore' })
            tagExists = true
        } catch {
            tagExists = false
        }
    }

    let commits = []
    if (tagExists) {
        commits = getCommitsBetweenTags(previousTag, currentTag)
        if (commits.length === 0 && currentTag !== currentTagWithV) {
            commits = getCommitsBetweenTags(previousTag, currentTagWithV)
        }
    } else {
        // Si el tag no existe aún, obtener commits desde el tag anterior hasta HEAD
        if (previousTag) {
            commits = getCommitsBetweenTags(previousTag, 'HEAD')
        } else {
            // Si no hay tag anterior, obtener los últimos commits
            commits = getCommitsBetweenTags(null, 'HEAD')
        }
    }
    console.log(`📝 Commits encontrados: ${commits.length}`)

    // Obtener estadísticas - usar el tag correcto según si existe o no
    const tagForStats = tagExists ? currentTag : 'HEAD'
    const changeStats = getChangeStats(previousTag, tagForStats)

    // Obtener archivos modificados
    console.log('📁 Obteniendo archivos modificados...')
    const changedFiles = getChangedFiles(previousTag, tagForStats)
    console.log(`📁 Archivos modificados: ${changedFiles.length}`)

    // Obtener cambios de código
    console.log('💻 Analizando cambios de código...')
    const codeChanges = getCodeChanges(previousTag, tagForStats)

    // Obtener snippets de código relevantes
    console.log('🔍 Extrayendo snippets de código relevantes...')
    const codeSnippets = getCodeSnippets(previousTag, tagForStats, changedFiles)
    console.log(`🔍 Snippets extraídos: ${codeSnippets.length}`)

    // Generar resumen
    let summaryContent
    try {
        if (openaiApiKey && commits.length > 0) {
            console.log('🤖 Generando resumen detallado con IA...')
            summaryContent = await generateAISummary(
                openaiApiKey,
                commits,
                changeStats,
                changedFiles,
                codeChanges,
                codeSnippets,
                previousTag || 'N/A',
                currentVersion
            )
        } else {
            console.log('📄 Generando resumen mejorado...')
            summaryContent = generateFallbackSummary(
                commits,
                changedFiles,
                codeSnippets,
                currentVersion,
                previousTag || 'N/A'
            )
        }
    } catch (error) {
        console.warn('⚠️ Error al generar con IA, usando resumen mejorado:', error.message)
        summaryContent = generateFallbackSummary(
            commits,
            changedFiles,
            codeSnippets,
            currentVersion,
            previousTag || 'N/A'
        )
    }

    // Crear directorio docs/releases si no existe
    const docsDir = path.join(process.cwd(), 'docs', 'releases')
    await fs.ensureDir(docsDir)

    // Agregar comandos de actualización al final del resumen
    const updateCommands = getUpdateCommands(currentVersion)
    if (updateCommands) {
        summaryContent += updateCommands
    }

    // Guardar archivo
    const filename = `${currentVersion}.md`
    const filepath = path.join(docsDir, filename)
    await fs.writeFile(filepath, summaryContent, 'utf-8')

    console.log(`✅ Resumen generado: ${filepath}`)
    console.log(`📄 Archivo listo para commit`)

    // Agregar al staging area
    try {
        execSync(`git add "${filepath}"`, { encoding: 'utf-8' })
        console.log(`✅ Archivo agregado al staging area`)
    } catch (error) {
        console.warn('⚠️ No se pudo agregar el archivo al staging:', error.message)
    }
}

main().catch((error) => {
    console.error('❌ Error fatal:', error)
    process.exit(1)
})
