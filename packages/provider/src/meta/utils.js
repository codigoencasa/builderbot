const axios = require('axios')

async function GetUrl(version, IdImage, numberId, Token) {
    try {
        const response = await axios.get(
            `https://graph.facebook.com/${version}/${IdImage}?phone_number_id=${numberId}`,
            {
                headers: {
                    Authorization: `Bearer ${Token}`,
                },
                maxBodyLength: Infinity,
            }
        )
        return response.data?.url
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    GetUrl,
}
