const axios = require('axios')

async function getMediaUrl(version, IdMedia, numberId, Token) {
    try {
        const response = await axios.get(
            `https://graph.facebook.com/${version}/${IdMedia}?phone_number_id=${numberId}`,
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
    getMediaUrl,
}
