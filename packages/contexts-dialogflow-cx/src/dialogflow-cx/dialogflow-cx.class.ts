import { CoreClass } from '@bot-whatsapp/bot'
import { SessionsClient } from '@google-cloud/dialogflow-cx'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

import { DialogFlowContextOptions, DialogFlowCredentials, Message, MessageContextIncoming } from '../types'

const GOOGLE_ACCOUNT_PATH = join(process.cwd(), 'google-key.json')

export class DialogFlowContext extends CoreClass {
    projectId: string | null = null
    configuration = null
    sessionClient = null
    optionsDX: DialogFlowContextOptions = {
        language: 'es',
        location: '',
        agentId: '',
    }

    constructor(_database, _provider, _optionsDX = {}) {
        super(null, _database, _provider, null)
        this.optionsDX = { ...this.optionsDX, ..._optionsDX }
        this.init()
    }

    loadCredentials = (): DialogFlowCredentials | null => {
        if (!existsSync(GOOGLE_ACCOUNT_PATH)) {
            console.log(`[ERROR]: No se encontró ${GOOGLE_ACCOUNT_PATH}`)
            return null
        }

        const rawJson = readFileSync(GOOGLE_ACCOUNT_PATH, 'utf-8')
        return JSON.parse(rawJson) as DialogFlowCredentials
    }

    private initializeDialogFlowClient = (credentials: DialogFlowCredentials): void => {
        const { project_id, private_key, client_email } = credentials

        this.projectId = project_id
        const configuration = {
            credentials: {
                private_key,
                client_email,
            },
            apiEndpoint: `${this.optionsDX.location}-dialogflow.googleapis.com`,
        }
        this.sessionClient = new SessionsClient({ ...configuration })
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

        /**
         * 📄 Creamos session de contexto basado en el numero de la persona
         * para evitar este problema.
         * https://github.com/codigoencasa/bot-whatsapp/pull/140
         */
        // const session = this.sessionClient.projectAgentSessionPath(this.projectId, from)

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

        const listMessages = single?.queryResult?.responseMessages?.map((res) => {
            if (res.message === Message.TEXT) {
                return { answer: res.text.text[0] }
            }

            if (res.message === Message.PAYLOAD) {
                const { media = null, buttons = [], answer = '' } = res.payload.fields
                const buttonsArray =
                    buttons?.listValue?.values?.map((btnValue): { body: string } => {
                        const { stringValue } = btnValue.structValue.fields.body
                        return { body: stringValue }
                    }) || []
                return {
                    answer: answer?.stringValue || '',
                    options: {
                        media: media?.stringValue,
                        buttons: buttonsArray,
                    },
                }
            }
            return { answer: '' }
        })

        this.sendFlowSimple(listMessages, from)
    }
}
