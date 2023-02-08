const process = require('node:process')
const { Octokit } = require('@octokit/core')

const [PKG_ARG, GITHUB_TOKEN] = process.argv.slice(2) || [null]

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
    repo = 'bot-whatsapp'
) => {
    const octokit = new Octokit({
        auth,
    })

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
}

const main = async () => {
    if (PKG_ARG) {
        const githubToken = GITHUB_TOKEN ? GITHUB_TOKEN.split('=').at(1) : null
        const pkgNumber = PKG_ARG ? PKG_ARG.split('=').at(1) : null

        if (pkgNumber) await githubGithubRelease(`v${pkgNumber}`, pkgNumber, githubToken)
    }
}

main()
