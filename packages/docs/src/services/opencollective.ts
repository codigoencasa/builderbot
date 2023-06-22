/**
 * GET API from OpenCollective
 * @returns
 */
// envolver listUsers en un try catch y devolver un array vacio en caso de error

export const fetchOpenCollective = async () => {
    const data = await fetch(`https://opencollective.com/bot-whatsapp/members/users.json?limit=22&offset=0`, {
        method: 'GET',
    })
    const listUsers = await data.json()
    return listUsers.map((u: any) => ({
        html_url: u.profile,
        avatar_url: u.image ?? 'https://i.imgur.com/HhiYKwN.png',
        login: u.name,
        id: u.MemberId,
    }))
    // try {
    //     const listUsers = await data.json()
    //     return listUsers.map((u: any) => ({
    //         html_url: u.profile,
    //         avatar_url: u.image ?? 'https://i.imgur.com/HhiYKwN.png',
    //         login: u.name,
    //         id: u.MemberId,
    //     }))
    // } catch (error) {
    //     return []
    // }
}
