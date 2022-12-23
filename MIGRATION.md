# Migración 

#### Versión (legacy)

En la ***versión (legacy)*** se implementaban los flujos de esta manera, en dos archivos independientes.

> __`initial.json`__ para establecer las palabras claves y el flujo a responder, por otro lado tambien se necesitaba implementar 
> __`response.json`__ donde se escriben los mensajes a responder.

```json
//initial.json
[
    {
        "keywords":  [
            "hola",
            "ola",
            "alo"
        ],
        "key": "hola"
    },
    {
        "keywords": ["productos", "info"],
        "key": "productos"
    },
    {
        "keywords": ["adios", "bye"],
        "key": "adios"
    },
    {
        "keywords": ["imagen", "foto"],
        "key": "catalogo"
    }
]
```
```json
//response.json
{
    "hola":{
        "replyMessage":[
            "Gracias a ti! \n"
        ],
        "media":null,
        "trigger":null
    },
    "adios":{
        "replyMessage":[
            "Que te vaya bien!!"
        ],
    },
    "productos":{
        "replyMessage":[
            "Más productos aquí"
        ],
        "trigger":null,
        "actions":{
            "title":"¿Que te interesa ver?",
            "message":"Abajo unos botons",
            "footer":"",
            "buttons":[
                {"body":"Telefonos"},
                {"body":"Computadoras"},
                {"body":"Otros"}
            ]
        }
    },
    "catalogo":{
        "replyMessage":[
            "Te envio una imagen"
        ],
        "media":"https://media2.giphy.com/media/VQJu0IeULuAmCwf5SL/giphy.gif",
        "trigger":null,
    },
    
}

```

#### Versión 2 (0.2.X)

En esta versión es mucho más sencillo, abajo encontraras un ejemplo del mismo flujo anteriormente mostrado.

```js
//app.js
const {
    createBot,
    createProvider,
    createFlow,
    addKeyword,
    addChild,
} = require('@bot-whatsapp/bot')

const BaileysProvider = require('@bot-whatsapp/provider/baileys')
const MockAdapter = require('@bot-whatsapp/database/mock')
/**
 * Declarando flujos principales.
 */
const flowHola = addKeyword(['hola', 'ola', 'alo'])
    .addAnswer('Bienvenido a tu tienda online!')

const flowAdios = addKeyword(['adios', 'bye'])
    .addAnswer('Que te vaya bien!!')
    .addAnswer('Hasta luego!')

const flowProductos = addKeyword(['productos', 'info'])
    .addAnswer('Te envio una imagen', {
        buttons:[
            {body:"Telefonos"},
            {body:"Computadoras"},
            {body:"Otros"}
        ]
    })

const flowCatalogo = addKeyword(['imagen', 'foto'])
    .addAnswer('Te envio una imagen', {media:'https://media2.giphy.com/media/VQJu0IeULuAmCwf5SL/giphy.gif'})


    const main = async () => {
    const adapterDB = new MockAdapter()
    const adapterFlow = createFlow([flowHola, flowAdios, flowProductos, flowCatalogo])
    const adapterProvider = createProvider(BaileysProvider)
    createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })
}
```

#### Flujos hijos

A continuación se muestra un ejemplo de flujos hijos, estos nos sirven para crear flujos que solo se disparan cuando el flujo anterior es el especificado, ejemplo:

 >          Menu Principal (Escoge zapatos o bolsos)
 >           - SubMenu 1 (Elegiste bolsos, ahora escoge piel o tela)
 >             - Submenu 1.1 (piel)
 >           - Submenu 2 (Elegiste zapatos, ahora escoge piel o tela)
 >             - Submenu 2.1 (piel)

El __submenu 1__ solo se va a disparar cuando el flujo anterior sea el __principal__, e igualmente el __submenu 1.1__, solo cuando el flujo anterior sea el __submenu 1__, ejemplo:

```js
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
        [...addChild(flowZapatos2)]
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
        [...addChild(flowBolsos2)]
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
        [...addChild(flowBolsos), ...addChild(flowZapatos)]
    )
```


> Forma parte de este proyecto.

-   [Discord](https://link.codigoencasa.com/DISCORD)
-   [Twitter](https://twitter.com/leifermendez)
-   [Youtube](https://www.youtube.com/watch?v=5lEMCeWEJ8o&list=PL_WGMLcL4jzWPhdhcUyhbFU6bC0oJd2BR)
-   [Telegram](https://t.me/leifermendez)
