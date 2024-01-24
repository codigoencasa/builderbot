export interface GlobalVendorArgs {
    name: string
    gifPlayback: boolean
    usePairingCode: boolean
    phoneNumber: string | null
    useBaileysStore: boolean
}

export interface ButtonOption {
    body: string
}

export interface SendOptions {
    buttons?: ButtonOption[]
    media?: string
}
