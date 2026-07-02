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

export interface TemplateCombination {
    provider: string
    language: string
    database: string
}

export interface TemplateValidationResult {
    pass: boolean
    message: string
}

export const PROVIDER_LIST: Provider[] = [
    { value: 'baileys', label: 'Baileys', hint: 'opensource' },
    { value: 'sherpa', label: 'Sherpa', hint: 'opensource' },
    { value: 'evolution-api', label: 'Evolution API', hint: 'opensource' },
    // { value: 'venom', label: 'Venom', hint: 'opensource' },
    { value: 'wppconnect', label: 'WPPConnect', hint: 'opensource' },
    // { value: 'wweb', label: 'Whatsapp-web.js', hint: 'opensource' },
    { value: 'twilio', label: 'Twilio' },
    { value: 'meta', label: 'Meta' },
    { value: 'facebook-messenger', label: 'Facebook Messenger' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'gupshup', label: 'Gupshup' },
    { value: 'gohighlevel', label: 'GoHighLevel' },
    { value: 'email', label: 'Email', hint: 'IMAP/SMTP' },
    { value: 'voice', label: 'Voice', hint: 'LiveKit + OpenAI' },
    { value: 'voice-sip', label: 'Voice SIP (PSTN)', hint: 'LiveKit SIP + OpenAI' },
    { value: 'voice-whatsapp', label: 'Voice WhatsApp', hint: 'Meta WebRTC + OpenAI' },
]

export const PROVIDER_DATA: ValueLabel[] = [
    { value: 'memory', label: 'Memory' },
    { value: 'json', label: 'Json' },
    { value: 'mongo', label: 'Mongo' },
    { value: 'mysql', label: 'MySQL' },
    { value: 'postgres', label: 'PostgreSQL' },
]

export type ProviderData = ValueLabel

export const AVAILABLE_LANGUAGES: ValueLabel[] = [
    { value: 'ts', label: 'TypeScript' },
    { value: 'js', label: 'JavaScript' },
]

const GUPSHUP_SUPPORTED_TEMPLATE_COMBINATIONS: TemplateCombination[] = [
    { provider: 'gupshup', language: 'ts', database: 'memory' },
]

export const validateTemplateCombination = ({
    provider,
    language,
    database,
}: TemplateCombination): TemplateValidationResult => {
    if (provider !== 'gupshup') {
        return { pass: true, message: '' }
    }

    const pass = GUPSHUP_SUPPORTED_TEMPLATE_COMBINATIONS.some(
        (combo) => combo.provider === provider && combo.language === language && combo.database === database
    )

    if (pass) {
        return { pass, message: '' }
    }

    const supportedCombinations = GUPSHUP_SUPPORTED_TEMPLATE_COMBINATIONS.map(
        (combo) => `--provider=${combo.provider} --language=${combo.language} --database=${combo.database}`
    ).join('\n')

    return {
        pass,
        message: `Unsupported template combination for provider ${provider}.\nSupported combinations:\n${supportedCombinations}`,
    }
}
