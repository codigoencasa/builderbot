const { CoreClass } = require('@bot-whatsapp/bot')
const dialogflow = require('@google-cloud/dialogflow')
const { existsSync, readFileSync } = require('fs')
const { join } = require('path')

/**
 * Necesita extender de core.class
 * handleMsg(messageInComming) //   const { body, from } = messageInComming
 */

const GOOGLE_ACCOUNT_PATH = join(process.cwd(), 'google-key.json')

class DialogFlowContext extends CoreClass {
    projectId = null
    configuration = null
    sessionClient = null

    constructor(_database, _provider) {
        super(null, _database, _provider)
    }

    /**
     * Verificar conexión con servicio de DialogFlow
     */
    init = () => {
        if (!existsSync(GOOGLE_ACCOUNT_PATH)) {
            /**
             * Emitir evento de error para que se mueste por consola dicinedo que no tiene el json
             *  */
        }

        const rawJson = readFileSync(GOOGLE_ACCOUNT_PATH, 'utf-8')
        const { project_id, private_key, client_email } = JSON.parse(rawJson)

        this.projectId = project_id
        this.configuration = {
            credentials: {
                private_key,
                client_email,
            },
        }

        this.sessionClient = new dialogflow.SessionsClient(this.configuration)
    }

    /**
     * GLOSSARY.md
     * @param {*} messageCtxInComming
     * @returns
     */
    handleMsg = async (messageCtxInComming) => {
        const languageCode = process.env.LANGUAGE || 'es' //????? language

        console.log('DEBUG:', messageCtxInComming)
        const { from, body } = messageCtxInComming // body: hola
        let media = null

        /**
         * 📄 Creamos session de contexto basado en el numero de la persona
         * para evitar este problema.
         * https://github.com/codigoencasa/bot-whatsapp/pull/140
         */
        const session = this.sessionClient.projectAgentSessionPath(
            this.projectId,
            from
        )
        const requestDialog = {
            session,
            queryInput: {
                text: {
                    text: body,
                    languageCode,
                },
            },
        }

        const [singleResponse] = (await sessionClient.detectIntent(
            requestDialog
        )) || [null]

        const { queryResult } = singleResponse
        const { intent } = queryResult || { intent: {} }

        // const parseIntent = intent['displayName'] || null
        //****** HE LLEGADO A ESTE PUNTO */
        //****** this.sendFlow(msgToSend, from) */

        const parsePayload = queryResult['fulfillmentMessages'].find(
            (a) => a.message === 'payload'
        )
        // console.log(singleResponse)
        if (parsePayload && parsePayload.payload) {
            const { fields } = parsePayload.payload
            media = fields.media.stringValue || null
        }
        const customPayload = parsePayload ? parsePayload['payload'] : null

        const parseData = {
            replyMessage: queryResult.fulfillmentText,
            media,
            trigger: null,
        }

        // se tiene que enviar mensaje
        // msgToSend = [{options?.delay}]
        this.sendFlow(msgToSend, from)

        return parseData
    }
}

module.exports = DialogFlowContext
