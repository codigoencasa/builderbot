import type { Button } from '@builderbot/bot/dist/types'

export interface DialogFlowContextOptions {
    language: string
    location: string
    agentId: string
}

export interface DialogFlowCredentials {
    project_id: string
    private_key: string
    client_email: string
}

export interface DialogFlowCXContextOptions {
    location: string
    agentId: string
    language?: string
}

export interface MessageContextIncoming {
    from: string
    ref?: string
    body?: string
}

export interface DialogResponseMessage {
    answer: string
    options?: {
        media?: string
        buttons?: Button[]
    }
}

export enum Message {
    PAYLOAD = 'payload',
    TEXT = 'text',
}

export interface ParamsDialogFlowCX {
    database: any
    provider: any
    options: DialogFlowCXContextOptions
}
