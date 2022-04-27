const dialogflow = require('@google-cloud/dialogflow');
const fs = require('fs')
const nanoid = require('nanoid')
/**
 * Debes de tener tu archivo con el nombre "chatbot-account.json" en la raíz del proyecto
 */

const KEEP_DIALOG_FLOW = (process.env.KEEP_DIALOG_FLOW === 'true')
let PROJECID;
let CONFIGURATION;
let sessionClient;

const checkFileCredentials = () => {
    if(!fs.existsSync(`${__dirname}/../chatbot-account.json`)){
        return false
    }

    const parseCredentials = JSON.parse(fs.readFileSync(`${__dirname}/../chatbot-account.json`));
    PROJECID = parseCredentials.project_id;
    CONFIGURATION = {
        credentials: {
            private_key: parseCredentials['private_key'],
            client_email: parseCredentials['client_email']
        }
    }
    sessionClient = new dialogflow.SessionsClient(CONFIGURATION);
}

// Create a new session


// Detect intent method
const detectIntent = async (queryText) => {
    let media = null;
    const sessionId = KEEP_DIALOG_FLOW ? 1 : nanoid();
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
    const parseIntent = intent['displayName'] || null
    const parsePayload = queryResult['fulfillmentMessages'].find((a) => a.message === 'payload');
    // console.log(singleResponse)
    if (parsePayload && parsePayload.payload) {
        const { fields } = parsePayload.payload
        media = fields.media.stringValue || null
    }
    const customPayload = parsePayload['payload']

    const parseData = {
        replyMessage: queryResult.fulfillmentText,
        media,
        trigger: null
    }
    return parseData
}

const getDataIa = (message = '', cb = () => { }) => {
    detectIntent(message).then((res) => {
        cb(res)
    })
}

checkFileCredentials();

module.exports = { getDataIa }
