export interface DialogFlowContextOptions {
    language?: string
}

export interface DialogFlowCredentials {
    project_id: string
    private_key: string
    client_email: string
}

export interface DialogFlowCXContextOptions {
    language: string
    location: string
    agentId: string
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
        buttons?: { body: string }[]
    }
}

export enum Message {
    PAYLOAD = 'payload',
    TEXT = 'text',
}