const { CoreClass } = require('@bot-whatsapp/bot')
const { SessionsClient } = require('@google-cloud/dialogflow-cx').v3beta1
const { existsSync, readFileSync } = require('fs')
const { join } = require('path')

/**
 * Necesita extender de core.class
 * handleMsg(messageInComming) //   const { body, from } = messageInComming
 */

const GOOGLE_ACCOUNT_PATH = join(process.cwd(), 'google-key.json')

class DialogFlowCXContext extends CoreClass {
    // Opciones del usuario
    optionsDX = {
        language: 'es',
        location: '',
        agentId: '',
    }
    projectId = null
    configuration = null
    sessionClient = null

    constructor(_database, _provider, _optionsDX = {}) {
        super(null, _database, _provider)
        this.optionsDX = { ...this.optionsDX, ..._optionsDX }
        this.init()
    }

    /**
     * Verificar conexión con servicio de DialogFlow
     */
    init = () => {
        if (!existsSync(GOOGLE_ACCOUNT_PATH)) {
            console.log(`[ERROR]: No se encontro ${GOOGLE_ACCOUNT_PATH}`)
            /**
             * Emitir evento de error para que se mueste por consola dicinedo que no tiene el json
             *  */
        }

        if (!this.optionsDX.location.length) throw new Error('LOCATION_NO_ENCONTRADO')
        if (!this.optionsDX.agentId.length) throw new Error('AGENTID_NO_ENCONTRADO')

        const rawJson = readFileSync(GOOGLE_ACCOUNT_PATH, 'utf-8')
        const { project_id, private_key, client_email } = JSON.parse(rawJson)

        this.projectId = project_id

        this.sessionClient = new SessionsClient({
            credentials: { private_key, client_email },
            apiEndpoint: `${this.optionsDX.location}-dialogflow.googleapis.com`,
        })
    }

    /**
     * GLOSSARY.md
     * @param {*} messageCtxInComming
     * @returns
     */
    handleMsg = async (messageCtxInComming) => {
        const languageCode = this.optionsDX.language
        const { from, body } = messageCtxInComming

        /**
         * 📄 Creamos session de contexto basado en el numero de la persona
         * para evitar este problema.
         * https://github.com/codigoencasa/bot-whatsapp/pull/140
         */

        const session = this.sessionClient.projectLocationAgentSessionPath(
            this.projectId,
            this.optionsDX.location,
            this.optionsDX.agentId,
            from
        )

        const reqDialog = {
            session,
            queryInput: {
                text: {
                    text: body,
                },
                languageCode,
            },
        }

        const [single] = (await this.sessionClient.detectIntent(reqDialog)) || [null]

        const listMessages = single.queryResult.responseMessages.map((res) => {
            if (res.message == 'text') {
                return { answer: res.text.text[0] }
            }

            if (res.message == 'payload') {
                const { media = null, buttons = [], answer = '' } = res.payload.fields
                const buttonsArray = buttons?.listValue?.values?.map((btnValue) => {
                    const { stringValue } = btnValue.structValue.fields.body
                    return { body: stringValue }
                })
                return {
                    answer: answer?.stringValue,
                    options: {
                        media: media?.stringValue,
                        buttons: buttonsArray,
                    },
                }
            }
        })

        this.sendFlowSimple(listMessages, from)
    }
}

module.exports = DialogFlowCXContext
