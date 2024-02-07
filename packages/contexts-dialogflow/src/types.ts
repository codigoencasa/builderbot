export interface DialogFlowContextOptions {
    language?: string
}

export interface MessageContextIncoming {
    from: string
    ref?: string
    body?: string
}

export enum Message {
    PAYLOAD = 'payload',
    TEXT = 'text',
}

export interface ParamsDialogFlow {
    database: any
    provider: any
    options?: DialogFlowContextOptions
}

export interface Credential {
    project_id: string
    private_key: string
    client_email: string
}
