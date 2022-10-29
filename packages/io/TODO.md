# @bot-whatsapp/io

### Caso de uso

> Una persona escribe `hola`

**addKeyword** recibe `string | string[]`

> `sensitivy` false _default_

-   [ ] addKeyword
-   [ ] addAnswer
-   [ ] Si ha contactado previamente. Seguir continuida

```js
// bootstrap.js Como iniciar el provider
const { inout, provider, database } = require('@bot-whatsapp')

/**
 * async whatsapp-web, twilio, meta
 * */

const bootstrap = async () => {
    console.log(`Iniciando....`)
    const client = await provider.start()
    /**
     * - QR
     * - Endpoint
     * - Check Token Meta, Twilio
     * - Return events? on message
     * */
    console.log(`Fin...`)
    // Esto es opcional ? no deberia ser necesario
    client.on('message', ({number, body,...}) => {
        // Incoming message
    })
}

```

```js
// flow.js Como agregar keywords y respuestas
const { inout, provider, database } = require('@bot-whatsapp')

await inout
    .addKeyword('hola')
    .addAnswer('Bienvenido a tu tienda 🥲')
    .addAnswer('escribe *catalogo* o *ofertas*')

await inout
    .addKeyword(['catalogo', 'ofertas'])
    .addAnswer('Este es nuestro CATALOGO mas reciente!', {
        buttons: [{ body: 'Xiaomi' }, { body: 'Samsung' }],
    })

await inout
    .addKeyword('Xiaomi')
    .addAnswer('Estos son nuestro productos XIAOMI ....', {
        media: 'https://....',
    })
    .addAnswer('Si quieres mas info escrbie *info*')

await inout
    .addKeyword('chao!')
    .addAnswer('bye!')
    .addAnswer('Recuerda que tengo esta promo', {
        media: 'https://media2.giphy.com/media/VQJu0IeULuAmCwf5SL/giphy.gif',
    })

await inout
    .addKeyword('Modelo C', { sensitivy: false })
    .addAnswer('100USD', { media: 'http//:...' })

await inout
    .addKeyword('hola!', { sensitivy: false })
    .addAnswer('Bievenido Escribe *productos*')

await inout
    .addKeyword('productos', { sensitivy: false })
    .addAnswer('Esto son los mas vendidos')
    .addAnswer('*PC1* Precio 10USD', { media: 'https://....' })
    .addAnswer('*PC2* Precio 10USD', { media: 'https://....' })

await inout
    .addKeyword('PC1', { sensitivy: false })
    .addAnswer('Bievenido Escribe *productos*')

const answerOne = await inout.addAnswer({
    message: 'Como estas!',
    media: 'https://media2.giphy.com/media/VQJu0IeULuAmCwf5SL/giphy.gif',
})

const otherAnswer = await inout.addAnswer('Aprovecho para decirte!')

answerOne.push(otherAnswer)

inout.addKeywords(['hola', 'hi', 'ola'])
```
