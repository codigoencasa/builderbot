export interface ProviderWithHint {
    value: string
    label: string
    hint: string
}

export interface ProviderWithoutHint {
    value: string
    label: string
}

export type Provider = ProviderWithHint | ProviderWithoutHint

export interface ProviderData {
    value: string
    label: string
}

const PROVIDER_LIST: Provider[] = [
    { value: 'baileys', label: 'Baileys', hint: 'gratis' },
    { value: 'venom', label: 'Venom', hint: 'gratis' },
    { value: 'wppconnect', label: 'WPPConnect', hint: 'gratis' },
    { value: 'wweb', label: 'Whatsapp-web.js', hint: 'gratis' },
    { value: 'twilio', label: 'Twilio' },
    { value: 'meta', label: 'Meta' },
]

const PROVIDER_DATA: ProviderData[] = [
    { value: 'memory', label: 'Memory' },
    { value: 'json', label: 'Json' },
    { value: 'mongo', label: 'Mongo' },
    { value: 'mysql', label: 'MySQL' },
    { value: 'postgres', label: 'PostgreSQL' },
]

export { PROVIDER_LIST, PROVIDER_DATA }
