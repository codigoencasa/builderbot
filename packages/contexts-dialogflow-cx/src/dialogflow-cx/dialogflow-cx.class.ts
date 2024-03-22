import { CoreClass } from '@builderbot/bot'
import { SessionsClient } from '@google-cloud/dialogflow-cx'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

import type { DialogFlowContextOptions, DialogFlowCredentials, MessageContextIncoming } from '../types'
import { Message } from '../types'

const GOOGLE_ACCOUNT_PATH = join(process.cwd(), 'google-key.json')

export class DialogFlowContextCX extends CoreClass {
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
        if (!this.existsCredential()) {
            throw new Error(`No se encontró ${GOOGLE_ACCOUNT_PATH}`)
        }
        const credentials = this.loadCredentials()
        this.initializeDialogFlowClient(credentials)
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

        const session = this.createSession(from)

        const reqDialog = {
            session,
            queryInput: {
                text: {
                    text: body,
                },
                languageCode,
            },
        }

        const { queryResult } = await this.detectIntent(reqDialog)

        const listMessages = queryResult?.responseMessages?.map((res) => {
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

    private existsCredential(): boolean {
        return existsSync(GOOGLE_ACCOUNT_PATH)
    }

    private createSession(from: string): string {
        const { location, agentId } = this.optionsDX
        return this.sessionClient.projectLocationAgentSessionPath(this.projectId, location, agentId, from)
    }

    private async detectIntent(reqDialog: any): Promise<any> {
        const [single] = (await this.sessionClient.detectIntent(reqDialog)) || [null]
        return single
    }
}
