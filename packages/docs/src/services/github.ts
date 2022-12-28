/**
 * GET API from Github
 * @returns
 */
export const fetchGithub = async (token: string) => {
    const data = await fetch(
        `https://api.github.com/repos/codigoencasa/bot-whatsapp/contributors`,
        {
            method: 'GET',
            headers: {
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                Authorization: `Bearer ${token}`,
            },
        }
    )
    const listUsers = data.json()
    return listUsers
}
