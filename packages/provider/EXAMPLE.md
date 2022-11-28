```js

const { inout, provider, database } = require('@bot-whatsapp')


const adapterDB = database.instance(
    {
        engine:'mysql / pg / mongo / json (json-default)',
        credentials:{....}
    }
)

const adapterProvider = provider.instance(
    {
        vendor:'twilio / web / meta',
        credentials:{...}
    }
)

const adapterFlow = (() => {
       const flowA =  inout
        .addKeyword('hola')
        .addAnswer('Bienvenido a tu tienda 🥲')
        .addAnswer('escribe *catalogo* o *ofertas*')
        .toJson()

    const flowB =  inout
        .addKeyword(['catalogo', 'ofertas'])
        .addAnswer('Este es nuestro CATALOGO mas reciente!', {
            buttons: [{ body: 'Xiaomi' }, { body: 'Samsung' }],
        }).toJson()

    const flowC =  inout
        .addKeyword('Xiaomi')
        .addAnswer('Estos son nuestro productos XIAOMI ....', {
            media: 'https://....',
        })
        .addAnswer('Si quieres mas info escrbie *info*').toJson()

    const flowD =  inout
        .addKeyword('chao!')
        .addAnswer('bye!')
        .addAnswer('Recuerda que tengo esta promo', {
            media: 'https://media2.giphy.com/media/VQJu0IeULuAmCwf5SL/giphy.gif',
        }).toJson()

    const flowE =  inout
        .addKeyword('Modelo C', { sensitive: false })
        .addAnswer('100USD', { media: 'http//:...' }).toJson()

    return [...flowA, ...flowB, ...flowC, ...flowC, ...flowD, ...flowE]
})


const bot = await provider.start(
    {
        database: adapterDB,
        flow: adapterFlow,
        provider:adapterProvider
    }
)


bot.on('message | auth | auth_error ', (ctx) => {
    ....
})

```
