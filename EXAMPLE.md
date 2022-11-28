
```js

const {
    createBot,
    createProvider,
    createFlow,
    addKeyword,
    toSerialize,
} = require('@bot-whatsapp/bot')

const WebWhatsappProvider = require('@bot-whatsapp/provider/web-whatsapp')
const MongoAdapter = require('@bot-whatsapp/database/mongo')

const flowArepa1 = toSerialize(
    addKeyword(['1', 'AREPA14'])
        .addAnswer('Esta es una arepa calificada ⭐⭐⭐⭐⭐')
        .addAnswer(['Ingredientes:', '10g Aguacate', '20g Huevo'].join('\n'))
        .toJson()
)

const flowArepa2_2 = toSerialize(
    addKeyword('SI').addAnswer('te pongo huevo de mentira!').toJson()
)

const flowArepa2 = toSerialize(
    addKeyword(['arepa2'])
        .addAnswer('Esta es una arepa calificada ⭐⭐⭐⭐')
        .addAnswer(
            ['Ingredientes:', '10g perico', '20g huevo', '10g queso'].join('\n')
        )
        .addAnswer(
            'Eres Vegano SI o NO',
            {
                capture: true,
            },
            null,
            [...flowArepa2_2]
        )
        .toJson()
)

const flowArepa3 = toSerialize(
    addKeyword(['arepa3'])
        .addAnswer('Esta es una arepa calificada LAMEJOR ⭐⭐⭐⭐⭐')
        .toJson()
)

//////////////--MENU--PRINCIPAL--//////////////////

const flujoMenuArepa = addKeyword(['hola', 'ola', 'buenos'])
    .addAnswer('Bienvenido "Arepera Aji Picante 🤯🚀😅"')
    .addAnswer(
        [
            'El menú de hoy es el siguiente:',
            '👉 [1 -AREPA14] - Arepa tradicional con Aguacate y Huevo',
            '👉 [arepa2] - Arepa rellena de perico y huevo con un toque de queso',
            '👉 [arepa3] - Rellena de Jamon y Queso',
        ].join('\n')
    )
    .addAnswer(
        'Esperando respuesta...',
        {
            capture: true,
        },
        () => {
            console.log('Enviar un mail!')
        },
        [...flowArepa1, ...flowArepa2, ...flowArepa3]
    )
    .addAnswer('Gracias!')

const main = async () => {
    const adapterDB = new MongoAdapter()
    const adapterFlow = createFlow([flujoMenuArepa])
    const adapterProvider = createProvider(WebWhatsappProvider)

    createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })
}

main()


```
