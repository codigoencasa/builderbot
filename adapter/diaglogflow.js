const dialogflow = require('@google-cloud/dialogflow');
const fs = require('fs')
const nanoid = require('nanoid')
/**
 * Debes de tener tu archivo con el nombre "chatbot-account.json" en la raíz del proyecto
 */
const CREDENTIALS = JSON.parse(fs.readFileSync(`${__dirname}/../chatbot-account.json`));

const PROJECID = CREDENTIALS.project_id;

const CONFIGURATION = {
    credentials: {
        private_key: CREDENTIALS['private_key'],
        client_email: CREDENTIALS['client_email']
    }
}

// Create a new session
const sessionClient = new dialogflow.SessionsClient(CONFIGURATION);

// Detect intent method
const detectIntent = async (queryText) => {
    const sessionId = nanoid.nanoid()
    const sessionPath = sessionClient.projectAgentSessionPath(PROJECID, sessionId);
    const languageCode = process.env.LANGUAGE
    const request = {
        session: sessionPath,
        queryInput: {
            text: {
                text: queryText,
                languageCode: languageCode,
            },
        },
    };

    const responses = await sessionClient.detectIntent(request);
    const [singleResponse] = responses;
    const { queryResult } = singleResponse
    const { intent } = queryResult || { intent: {} }
    const parseIntent = intent?.displayName || null

    const parseData = {
        replyMessage:queryResult.fulfillmentText,
        media:null,
        trigger:null
    }

    return parseData
}

const getDataIa = (message = '',cb = () => {}) => {
    detectIntent(message).then((res) => {
        cb(res)
    })
}

module.exports = { getDataIa }