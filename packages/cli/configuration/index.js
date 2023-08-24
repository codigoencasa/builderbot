const PROVIDER_LIST = [
    { value: 'baileys', label: 'Baileys', hint: 'gratis' },
    { value: 'venom', label: 'Venom', hint: 'gratis' },
    { value: 'wppconnect', label: 'WPPConnect', hint: 'gratis' },
    { value: 'wweb', label: 'Whatsapp-web.js', hint: 'gratis' },
    { value: 'twilio', label: 'Twilio' },
    { value: 'meta', label: 'Meta' },
]

const PROVIDER_DATA = [
    { value: 'memory', label: 'Memory' },
    { value: 'json', label: 'Json' },
    { value: 'mongo', label: 'Mongo' },
    { value: 'mysql', label: 'MySQL' },
    { value: 'postgres', label: 'PostgreSQL' },
]

module.exports = { PROVIDER_LIST, PROVIDER_DATA }
