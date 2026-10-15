import { copy } from 'fs-extra'
import { join } from 'path'
import { rimraf } from 'rimraf'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs'

type genericProps = {
    IMPORT: string
    IMPLEMENTATION: string
    DEPENDENCIES: Object
    DEV_DEPENDENCIES: Object
    /** Optional: replaces the default flow block in the app entrypoint. */
    FLOW?: string
    /** Optional: replaces the `createFlow([...])` argument list. */
    FLOW_LIST?: string
    /** Optional: replaces the default HTTP endpoint block in the entrypoint. */
    ENDPOINTS?: string
}

/** Default flow list used by the base template (chat-oriented). */
const DEFAULT_FLOW_LIST = 'welcomeFlow, registerFlow, fullSamplesFlow'

/** Block of default flows in the template, replaceable by a provider FLOW. */
const FLOWS_BLOCK = /\/\*\* flows-default \*\*\/[\s\S]*?\/\*\* flows-default-end \*\*\//

/** Block of default HTTP endpoints, replaceable by a provider ENDPOINTS. */
const ENDPOINTS_BLOCK = /\/\*\* endpoints-default \*\*\/[\s\S]*?\/\*\* endpoints-default-end \*\*\//
const BASE_TEMPLATE: string = join(process.cwd(), 'scripts', 'generate')
const BASE_TEMPLATES_APP: string = join(process.cwd(), 'starters', 'apps')

export const delay = (milliseconds: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

const [, , inputLanguage]: string[] = process.argv

/**
 * @param input
 * @param to
 */
const copyBase = async (input: string, database: string, provider: string): Promise<string> => {
    const FROM = join(BASE_TEMPLATE, 'template', input)
    const TO = join(BASE_TEMPLATES_APP, `base-${input}-${provider}-${database}`)
    const options = { overwrite: true }
    await copy(FROM, TO, options)
    return TO
}

/**
 *
 */
const cleanTemplates = async (): Promise<void> => {
    try {
        const list = readdirSync(BASE_TEMPLATES_APP)
        for (const iterator of list) {
            await rimraf(join(BASE_TEMPLATES_APP, '/', iterator))
        }
    } catch (e) {
        console.log(`[Error]:`, e)
    }
}

/**
 *
 * @param fullPath
 * @param database
 * @param provider
 */
const replaceZones = async (fullPath: string, database: string, provider: string, language: 'js' | 'ts') => {
    const findApp = readdirSync(`${fullPath}/src`).find((f) => f.startsWith('app'))

    if (!findApp) {
        throw new Error('error found entrypoint')
    }

    const ZONE_PATH_DATABASES = join(BASE_TEMPLATE, 'zones', 'databases', `${database}.json`)
    const ZONE_PATH_PROVIDERS = join(BASE_TEMPLATE, 'zones', 'providers', `${provider}.json`)

    const jsonConstantsDB: genericProps = JSON.parse(readFileSync(ZONE_PATH_DATABASES, 'utf8'))
    const jsonConstantsProvider: genericProps = JSON.parse(readFileSync(ZONE_PATH_PROVIDERS, 'utf8'))

    const pathEntryPoint = join(fullPath, 'src', findApp)
    const textPlain = readFileSync(pathEntryPoint, 'utf8')

    // Provider flows are authored with TypeScript generics; strip them for JS.
    const providerFlow =
        jsonConstantsProvider.FLOW && language === 'js'
            ? jsonConstantsProvider.FLOW.replace(/<Provider, Database>/g, '')
            : jsonConstantsProvider.FLOW

    let newTextPlain = textPlain
        .replace(`/** import-zone **/`, jsonConstantsDB.IMPORT + jsonConstantsProvider.IMPORT)
        // Provider flows end with a trailing newline; strip it so the template's
        // own `\n\n` before `const main` yields exactly one blank line.
        .replace(FLOWS_BLOCK, (match) => (providerFlow ? providerFlow.replace(/\n+$/, '') : match))
        // The marker is a standalone line so the generated `createFlow` call stays
        // on one line (prettier would otherwise wrap it around the comment).
        .replace(/ *\/\*\* flow-list-replace \*\*\/\n/, '')
        .replace(
            'const adapterFlow = createFlow([welcomeFlow, registerFlow, fullSamplesFlow])',
            `const adapterFlow = createFlow([${jsonConstantsProvider.FLOW_LIST ?? DEFAULT_FLOW_LIST}])`
        )
        .replace(ENDPOINTS_BLOCK, (match) =>
            jsonConstantsProvider.ENDPOINTS ? jsonConstantsProvider.ENDPOINTS : match
        )
        .replace(`/** provider-replace **/`, jsonConstantsProvider.IMPLEMENTATION)
        .replace(`/** database-replace **/`, jsonConstantsDB.IMPLEMENTATION)
        // Drop the block markers when the default blocks are kept, so generated
        // starters are byte-identical to the pre-marker template.
        .replace(/\/\*\* flows-default \*\*\/\n/, '')
        .replace(/\/\*\* flows-default-end \*\*\/\n\n/, '')
        .replace(/ *\/\*\* endpoints-default \*\*\/\n/, '')
        .replace(/ *\/\*\* endpoints-default-end \*\*\/\n/, '')

    // Provider flows never use the default `join`-based media samples, so drop
    // the now-unused imports instead of shipping dead code.
    if (providerFlow) {
        newTextPlain = newTextPlain.replace("import { join } from 'path'\n", '')
        if (!providerFlow.includes('utils.')) {
            newTextPlain = newTextPlain.replace('createFlow, addKeyword, utils }', 'createFlow, addKeyword }')
        }
    }

    writeFileSync(pathEntryPoint, newTextPlain)
}

/**
 * Copy optional per-provider extras (README, .env.example) when present.
 *
 * Layout: `zones/extras/<provider>/{README.md,env.example}`. Providers without
 * an extras directory keep the base template files untouched.
 *
 * @param fullPath Generated starter directory.
 * @param provider Provider zone name.
 */
/**
 * Merge optional per-provider package.json metadata (name, description,
 * keywords...) into the generated package.json. Dependencies are never touched
 * here — they come from the provider/database zones.
 *
 * Layout: `zones/extras/<provider>/package.json`. The literal `{{dir}}` in a
 * string value is replaced with the generated starter directory name.
 *
 * @param fullPath Generated starter directory.
 * @param provider Provider zone name.
 */
const applyPackageExtras = async (fullPath: string, provider: string): Promise<void> => {
    const extras = join(BASE_TEMPLATE, 'zones', 'extras', provider, 'package.json')
    if (!existsSync(extras)) return

    const pkgPath = join(fullPath, 'package.json')
    const extra = JSON.parse(readFileSync(extras, 'utf8')) as Record<string, unknown>
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, unknown>
    const dirName = fullPath.split(/[\\/]/).pop() ?? ''

    for (const [key, value] of Object.entries(extra)) {
        if (key === 'dependencies' || key === 'devDependencies') continue
        pkg[key] = typeof value === 'string' ? value.replace('{{dir}}', dirName) : value
    }

    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))
}

const copyProviderExtras = async (fullPath: string, provider: string): Promise<void> => {
    const extrasDir = join(BASE_TEMPLATE, 'zones', 'extras', provider)
    if (!existsSync(extrasDir)) return

    const files: Array<[string, string]> = [
        ['env.example', '.env.example'],
        ['README.md', 'README.md'],
    ]

    for (const [from, to] of files) {
        const src = join(extrasDir, from)
        if (existsSync(src)) {
            await copy(src, join(fullPath, to), { overwrite: true })
        }
    }
}

/**
 *
 * @param fullPath
 * @param database
 * @param provider
 */
const mergeDependencies = async (
    fullPath: string,
    database: string,
    provider: string,
    language: 'js' | 'ts'
): Promise<void> => {
    try {
        const pkg = join(fullPath, 'package.json')
        const targetDocker = join(fullPath, 'Dockerfile')
        const ZONE_PATH_PROVIDERS = join(BASE_TEMPLATE, 'zones', 'providers', `${provider}.json`)
        const ZONE_PATH_DATABASES = join(BASE_TEMPLATE, 'zones', 'databases', `${database}.json`)
        const ZONE_PATH_DOCKER = join(BASE_TEMPLATE, 'zones', 'docker', language, provider)

        const dbDep: genericProps = JSON.parse(readFileSync(ZONE_PATH_DATABASES, 'utf8'))
        const provDep: genericProps = JSON.parse(readFileSync(ZONE_PATH_PROVIDERS, 'utf8'))
        const projectDep = JSON.parse(readFileSync(pkg, 'utf8'))
        const dockerFile = readFileSync(ZONE_PATH_DOCKER, 'utf-8')

        const updatedDependencies = {
            ...projectDep,
            dependencies: {
                ...projectDep.dependencies,
                ...provDep.DEPENDENCIES,
                ...dbDep.DEPENDENCIES,
            },
            devDependencies: {
                ...projectDep.devDependencies,
                ...provDep.DEV_DEPENDENCIES,
                ...dbDep.DEV_DEPENDENCIES,
            },
        }

        writeFileSync(targetDocker, dockerFile)
        writeFileSync(pkg, JSON.stringify(updatedDependencies, null, 2))
    } catch (err) {
        console.log(`Error: `, err)
    }
}

const main = async (): Promise<void> => {
    try {
        const { AVAILABLE_LANGUAGES, PROVIDER_DATA, PROVIDER_LIST, validateTemplateCombination } =
            await import('../../packages/cli/src/configuration/index.ts')

        console.log(`Cleaning...`)
        await cleanTemplates()

        for (const language of AVAILABLE_LANGUAGES) {
            for (const database of PROVIDER_DATA) {
                for (const provider of PROVIDER_LIST) {
                    const validation = validateTemplateCombination({
                        provider: provider.value,
                        language: language.value,
                        database: database.value,
                    })

                    if (!validation.pass) {
                        console.log(`Skipped ${language.value}: ${database.value}-${provider.value}`)
                        continue
                    }

                    const runtimeLanguage = language.value as 'js' | 'ts'
                    await delay(10)
                    const full = await copyBase(runtimeLanguage, database.value, provider.value)
                    await replaceZones(full, database.value, provider.value, runtimeLanguage)
                    await copyProviderExtras(full, provider.value)
                    await mergeDependencies(full, database.value, provider.value, runtimeLanguage)
                    await applyPackageExtras(full, provider.value)
                    console.log(`Generated ${runtimeLanguage.toUpperCase()} 🌟: ${database.value}-${provider.value}`)
                }
            }
        }

        console.info(`[INFO]: Packages created successfully`)
    } catch (err) {
        console.error('[ERROR]:', err?.message)
    }
}

main()
