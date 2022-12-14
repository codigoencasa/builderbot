const {
    createBot,
    createProvider,
    createFlow,
    addKeyword,
} = require('@bot-whatsapp/bot')

const VenomProvider = require('@bot-whatsapp/provider/venom')
const MockAdapter = require('@bot-whatsapp/database/mock')

const flowPrincipal = addKeyword(['hola', 'ole', 'HOLA'])
    .addAnswer('Bienvenido a mi tienda')
    .addAnswer('Como puedo ayudarte?')
    .addAnswer(['Tengo:', 'Zapatos', 'Bolsos', 'etc..'])

const main = async () => {
    const adapterDB = new MockAdapter()
    const adapterFlow = createFlow([flowPrincipal])
    const adapterProvider = createProvider(VenomProvider)

    createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })
}

main()
