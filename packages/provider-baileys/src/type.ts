export interface GlobalVendorArgs {
    name: string
    gifPlayback: boolean
    usePairingCode: boolean
    phoneNumber: string | null
    browser: string[]
    useBaileysStore: boolean
    port: number
}

export interface ButtonOption {
    body: string
}
