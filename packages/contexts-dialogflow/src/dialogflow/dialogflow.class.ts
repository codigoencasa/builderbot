import { CoreClass } from '@bot-whatsapp/bot'
import { SessionsClient } from '@google-cloud/dialogflow'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

import { Credential, DialogFlowContextOptions, Message, MessageContextIncoming } from '../types'

const GOOGLE_ACCOUNT_PATH = join(process.cwd(), 'google-key.json')

export class DialogFlowContext extends CoreClass {
    optionsDX: DialogFlowContextOptions = {
        language: 'es',
    }
    projectId: string | null = null
    sessionClient = null
    googleKeyJson: string | undefined = process.env.GOOGLE_KEY_JSON
    constructor(_database, _provider, _optionsDX = {}) {
        super(null, _database, _provider, null)
        this.optionsDX = { ...this.optionsDX, ..._optionsDX }
        this.init()
    }

    /**
     * Verificar conexión con servicio de DialogFlow
     */
    init = () => {
        if (!this.existsCredential()) {
            throw new Error(`No se encontró ${GOOGLE_ACCOUNT_PATH}`)
        }

        const { project_id, private_key, client_email } = this.getCredential()

        this.projectId = project_id
        const configuration = {
            credentials: {
                private_key,
                client_email,
            },
        }

        this.initializeSessionClient(configuration)
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

        const msgPayload = queryResult?.fulfillmentMessages?.find((a) => a.message === Message.PAYLOAD)

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

        const messagesFromCX = queryResult['fulfillmentMessages']
            .map((a) => {
                if (a.message === Message.TEXT) {
                    return { answer: a.text.text[0] }
                }
            })
            .filter((e) => e)

        this.sendFlowSimple(messagesFromCX, from)
    }

    private existsCredential(): boolean {
        return existsSync(GOOGLE_ACCOUNT_PATH)
    }

    private getCredential(): Credential {
        const rawJson = readFileSync(GOOGLE_ACCOUNT_PATH, 'utf-8')
        const { project_id, private_key, client_email } = JSON.parse(rawJson)
        return { project_id, private_key, client_email }
    }

    private initializeSessionClient(configuration: { credentials: { private_key: string; client_email: string } }) {
        this.sessionClient = new SessionsClient({ ...configuration })
    }
}
