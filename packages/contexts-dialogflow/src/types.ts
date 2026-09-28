/**
 * LAYER: Domain
 * Contains: DialogFlowContextOptions, MessageContextIncoming, Message, ParamsDialogFlow
 * Rules: No external dependencies. Pure business logic.
 * BigO: O(1) score:5
 * keywords: [DialogFlowContextOptions, MessageContextIncoming, Message, ParamsDialogFlow]
 * GOAL: Own the "types" concern of the contexts-dialogflow package.
 */
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
