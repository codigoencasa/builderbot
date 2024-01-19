import { CoreClass } from '@bot-whatsapp/bot'
import dialogflow from '@google-cloud/dialogflow'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

import { DialogFlowContextOptions, DialogFlowCredentials, MessageContextIncoming } from '../types'

const GOOGLE_ACCOUNT_PATH = join(process.cwd(), 'google-key.json')

export class DialogFlowContext {
    private coreInstance: CoreClass
    projectId: string | null = null
    configuration = null
    sessionClient = null
    optionsDX: DialogFlowContextOptions = {
        language: 'es',
    }

    constructor(_database, _provider, _optionsDX = {}) {
        this.coreInstance = new CoreClass(null, _database, _provider, null)
        this.optionsDX = { ...this.optionsDX, ..._optionsDX }
    }

    loadCredentials = (): DialogFlowCredentials | null => {
        if (!existsSync(GOOGLE_ACCOUNT_PATH)) {
            console.log(`[ERROR]: No se encontró ${GOOGLE_ACCOUNT_PATH}`)
            return null
        }

        const rawJson = readFileSync(GOOGLE_ACCOUNT_PATH, 'utf-8')
        console.log('rawJson--->', rawJson)
        return JSON.parse(rawJson) as DialogFlowCredentials
    }

    private initializeDialogFlowClient = (credentials: DialogFlowCredentials): void => {
        const { project_id, private_key, client_email } = credentials

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
     * Verificar conexión con servicio de DialogFlow
     */
    init = () => {
        const credentials = this.loadCredentials()

        if (credentials) {
            this.initializeDialogFlowClient(credentials)
        }
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
            this.coreInstance([ctxFromDX], from)
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

        this.coreInstance.sendFlowSimple(messagesFromCX, from)
    }
}
