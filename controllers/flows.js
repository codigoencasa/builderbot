const { get, reply, getIA } = require('../adapter')
const { saveExternalFile, checkIsUrl } = require('./handle')

const getMessages = async (message) => {
    const data = await get(message)
    return data
}

const responseMessages = async (step) => {
    const data = await reply(step)
    if (data && data.media) {
        const file = checkIsUrl(data.media) ? await saveExternalFile(data.media) : data.media;
        return { ...data, ...{ media: file } }
    }
    return data
}

const bothResponse = async (message, sessionId) => {
    const data = await getIA(message, sessionId)
    if (data && data.media) {
        const file = await saveExternalFile(data.media)
        return { ...data, ...{ media: file } }
    }
    return data
}

const waitFor = (conditionFunction, WAIT_TIME) => {
    const poll = resolve => {
        if (conditionFunction())
            resolve();
        else setTimeout(_ => poll(resolve), WAIT_TIME);
    }
    return new Promise(poll);
}

module.exports = { getMessages, responseMessages, bothResponse, waitFor }