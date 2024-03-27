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

export interface ValueLabel {
    value: string
    label: string
}

export const PROVIDER_LIST: Provider[] = [
    { value: 'baileys', label: 'Baileys', hint: 'opensource' },
    { value: 'venom', label: 'Venom', hint: 'opensource' },
    { value: 'wppconnect', label: 'WPPConnect', hint: 'opensource' },
    // { value: 'wweb', label: 'Whatsapp-web.js', hint: 'opensource' },
    { value: 'twilio', label: 'Twilio' },
    { value: 'meta', label: 'Meta' },
]

export const PROVIDER_DATA: ValueLabel[] = [
    { value: 'memory', label: 'Memory' },
    { value: 'json', label: 'Json' },
    { value: 'mongo', label: 'Mongo' },
    { value: 'mysql', label: 'MySQL' },
    { value: 'postgres', label: 'PostgreSQL' },
]

export const AVAILABLE_LANGUAGES: ValueLabel[] = [
    { value: 'ts', label: 'TypeScript' },
    { value: 'js', label: 'JavaScript' },
]
