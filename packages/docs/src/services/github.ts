/**
 * GET API from Github
 * @returns
 */
export const fetchGithub = async (token: string) => {
    const data = await fetch(`https://api.github.com/repos/codigoencasa/bot-whatsapp/contributors`, {
        method: 'GET',
        headers: {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            Authorization: `Bearer ${token}`,
        },
    })
    const listUsers = await data.json()
    return listUsers.map((u: any) => ({
        ...u,
        avatar_url: `${u.avatar_url}&s=80`,
    }))
}
