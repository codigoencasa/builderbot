import { CoreClass } from '@bot-whatsapp/bot'
import { SessionsClient } from '@google-cloud/dialogflow'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

import {
    DialogFlowCXContextOptions,
    DialogFlowCredentials,
    DialogResponseMessage,
    Message,
    MessageContextIncoming,
} from '../types'

export class DialogFlowCXContext {
    // Opciones del usuario
    private coreInstance: CoreClass
    optionsDX: DialogFlowCXContextOptions = {
        language: 'es',
        location: '',
        agentId: '',
    }
    projectId: string | null = null
    sessionClient = null

    constructor(_database, _provider, _optionsDX = {}) {
        this.coreInstance = new CoreClass(null, _database, _provider, null)
        this.optionsDX = { ...this.optionsDX, ..._optionsDX }
    }

    /**
     * Verificar conexión con servicio de DialogFlow
     */
    init = () => {
        let credentials: DialogFlowCredentials
        const googleKeyFilePath = join(process.cwd(), 'google-key.json')

        if (existsSync(googleKeyFilePath)) {
            const rawJson = readFileSync(googleKeyFilePath, 'utf-8')
            credentials = JSON.parse(rawJson) as DialogFlowCredentials
        } else if (process.env.GOOGLE_KEY_JSON) {
            credentials = JSON.parse(process.env.GOOGLE_KEY_JSON)
        } else {
            throw new Error('Google key configuration not found')
        }

        if (!this.optionsDX.location.length) throw new Error('LOCATION_NO_ENCONTRADO')
        if (!this.optionsDX.agentId.length) throw new Error('AGENTID_NO_ENCONTRADO')

        const { project_id, private_key, client_email } = credentials

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
    handleMsg = async (messageCtxInComming: MessageContextIncoming): Promise<any> => {
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

        const listMessages: DialogResponseMessage[] = single.queryResult.responseMessages.map((res) => {
            if (res.message == Message.TEXT) {
                return { answer: res.text.text[0] }
            }

            if (res.message == Message.PAYLOAD) {
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

        this.coreInstance.sendFlowSimple(listMessages, from)
    }
}
