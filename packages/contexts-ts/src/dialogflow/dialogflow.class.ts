import { CoreClass } from 'bot-ts-demo'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import dialogflow from '@google-cloud/dialogflow'
import { DialogFlowContextOptions, DialogFlowCredentials, MessageContextIncoming } from '../types'

const GOOGLE_ACCOUNT_PATH = join(process.cwd(), 'google-key.json')

export class DialogFlowContext extends CoreClass {
    projectId: string | null = null
    configuration = null
    sessionClient = null
    optionsDX: DialogFlowContextOptions = {
        language: 'es',
    }

    constructor(_database, _provider, _optionsDX = {}) {
        super(null, _database, _provider, null)
        this.optionsDX = { ...this.optionsDX, ..._optionsDX }
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

        const rawJson = readFileSync(GOOGLE_ACCOUNT_PATH, 'utf-8')
        const { project_id, private_key, client_email } = JSON.parse(rawJson) as DialogFlowCredentials

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
    handleMsg = async (messageCtxInComming: MessageContextIncoming): Promise<any> => {
        const languageCode = this.optionsDX.language
        const { from, body } = messageCtxInComming

        let customPayload = {}

        /**
         * 📄 Creamos session de contexto basado en el numero de la persona
         * para evitar este problema.
         * https://github.com/codigoencasa/bot-whatsapp/pull/140
         */
        const session = this.sessionClient.projectAgentSessionPath(this.projectId, from)
        const reqDialog = {
            session,
            queryInput: {
                text: {
                    text: body,
                    languageCode,
                },
            },
        }

        const [single] = (await this.sessionClient.detectIntent(reqDialog)) || [null]

        const { queryResult } = single

        const msgPayload = queryResult?.fulfillmentMessages?.find((a) => a.message === 'payload')

        // Revisamos si el dialogFlow tiene multimedia
        if (msgPayload && msgPayload?.payload) {
            const { fields } = msgPayload.payload
            const mapButtons = fields?.buttons?.listValue?.values.map((m) => {
                return { body: m?.structValue?.fields?.body?.stringValue }
            })

            customPayload = {
                options: {
                    media: fields?.media?.stringValue,
                    buttons: mapButtons,
                },
            }

            const ctxFromDX = {
                ...customPayload,
                answer: fields?.answer?.stringValue,
            }
            this.sendFlowSimple([ctxFromDX], from)
            return
        }

        /* const ctxFromDX = {
            answer: queryResult?.fulfillmentText,
        } */

        const messagesFromCX = queryResult['fulfillmentMessages']
            .map((a) => {
                if (a.message === 'text') {
                    return { answer: a.text.text[0] }
                }
            })
            .filter((e) => e)

        this.sendFlowSimple(messagesFromCX, from)
    }
}
