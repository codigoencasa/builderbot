const {
    createBot,
    createProvider,
    createFlow,
    addKeyword,
} = require('@bot-whatsapp/bot')

require('./server.http')

const BaileysProvider = require('@bot-whatsapp/provider/baileys')
const MockAdapter = require('@bot-whatsapp/database/mock')

/**
 * Aqui declaramos los flujos hijos, los flujos se declaran de atras para adelante, es decir que si tienes un flujo de este tipo:
 *
 *          Menu Principal
 *           - SubMenu 1
 *             - Submenu 1.1
 *           - Submenu 2
 *             - Submenu 2.1
 *
 * Primero declaras los submenus 1.1 y 2.1, luego el 1 y 2 y al final el principal.
 */

const flowBolsos2 = addKeyword(['bolsos2', '2'])
    .addAnswer('🤯 *MUCHOS* bolsos ...')
    .addAnswer('y mas bolsos... bla bla')

const flowZapatos2 = addKeyword(['zapatos2', '2'])
    .addAnswer('🤯 repito que tengo *MUCHOS* zapatos.')
    .addAnswer('y algunas otras cosas.')

const flowZapatos = addKeyword(['1', 'zapatos', 'ZAPATOS'])
    .addAnswer('🤯 Veo que elegiste zapatos')
    .addAnswer('Tengo muchos zapatos...bla bla')
    .addAnswer(
        ['Manda:', '*(2) Zapatos2*', 'para mas información'],
        { capture: true },
        (ctx) => {
            console.log('Aqui puedes ver más info del usuario...')
            console.log('Puedes enviar un mail, hook, etc..')
            console.log(ctx)
        },
        [flowZapatos2]
    )

const flowBolsos = addKeyword(['2', 'bolsos', 'BOLSOS'])
    .addAnswer('🙌 Veo que elegiste bolsos')
    .addAnswer('Tengo muchos bolsos...bla bla')
    .addAnswer(
        ['Manda:', '*(2) Bolsos2*', 'para mas información.'],
        { capture: true },
        (ctx) => {
            console.log('Aqui puedes ver más info del usuario...')
            console.log('Puedes enviar un mail, hook, etc..')
            console.log(ctx)
        },
        [flowBolsos2]
    )

/**
 * Declarando flujo principal
 */

const flowPrincipal = addKeyword(['hola', 'ole', 'alo'])
    .addAnswer(['Hola, bienvenido a mi tienda', '¿Como puedo ayudarte?'])
    .addAnswer(['Tengo:', 'Zapatos', 'Bolsos', 'etc ...'])
    .addAnswer(
        ['Para continuar escribe:', '*(1) Zapatos*', '*(2) Bolsos*'],
        { capture: true },
        (ctx) => {
            console.log('Aqui puedes ver más info del usuario...')
            console.log('Puedes enviar un mail, hook, etc..')
            console.log(ctx)
        },
        [flowBolsos, flowZapatos]
    )

const main = async () => {
    const adapterDB = new MockAdapter()
    const adapterFlow = createFlow([flowPrincipal])
    const adapterProvider = createProvider(BaileysProvider)
    createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })
}

main()
