const process = require('node:process')
const { Octokit } = require('@octokit/core')

const [PKG_ARG, GITHUB_TOKEN] = process.argv.slice(2) || [null]

/**
 * Verificar si el release ya existe por tag
 * @param {Octokit} octokit
 * @param {string} owner
 * @param {string} repo
 * @param {string} tag_name
 * @returns {Promise<boolean>}
 */
const releaseExists = async (octokit, owner, repo, tag_name) => {
    try {
        await octokit.request(`GET /repos/${owner}/${repo}/releases/tags/${tag_name}`, {
            owner,
            repo,
            tag: tag_name,
        })
        return true
    } catch (error) {
        if (error.status === 404) {
            return false
        }
        throw error
    }
}

/**
 * Publicar Release en Github
 * @param {*} name
 * @param {*} tag_name
 * @param {*} auth
 * @param {*} owner
 * @param {*} repo
 */
const githubGithubRelease = async (
    name = '',
    tag_name = '',
    auth = '',
    owner = 'codigoencasa',
    repo = 'builderbot'
) => {
    const octokit = new Octokit({
        auth,
    })

    // Verificar si el release ya existe
    const exists = await releaseExists(octokit, owner, repo, tag_name)

    if (exists) {
        // Si el release ya existe, saltar sin error
        console.log(`⚠️ Release ${tag_name} ya existe, saltando creación...`)
        console.log(`ℹ️ Esto puede ocurrir si la versión no se incrementó correctamente.`)
        return
    }

    // Crear nuevo release
    console.log(`🚀 Creando nuevo release ${tag_name}...`)
    await octokit.request(`POST /repos/${owner}/${repo}/releases`, {
        owner,
        repo,
        tag_name,
        name,
        body: 'Description of the release',
        draft: false,
        prerelease: false,
        generate_release_notes: true,
    })
    console.log(`✅ Release ${tag_name} creado correctamente`)
}

const main = async () => {
    if (PKG_ARG) {
        const githubToken = GITHUB_TOKEN ? GITHUB_TOKEN.split('=').at(1) : null
        const pkgNumber = PKG_ARG ? PKG_ARG.split('=').at(1) : null

        if (pkgNumber) await githubGithubRelease(`v${pkgNumber}`, pkgNumber, githubToken)
    }
}

main()
