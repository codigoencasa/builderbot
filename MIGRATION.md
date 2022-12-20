# Migración 

#### Versión (legacy)

En la  ***versión (legacy)***  se implementas los flujos de esta manera, en dos archivos independientes.

> __`initial.json`__ para establecer las palabras claves y el flujo a responder, por otro lado tambien se necesitaba implementar.
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

En esta versión es mucho más sencillo abajo encontraras un ejemplo del mismo flujo anteriormente mostrado.

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

> Forma parte de este proyecto.

-   [Discord](https://link.codigoencasa.com/DISCORD)
-   [Twitter](https://twitter.com/leifermendez)
-   [Youtube](https://www.youtube.com/watch?v=5lEMCeWEJ8o&list=PL_WGMLcL4jzWPhdhcUyhbFU6bC0oJd2BR)
-   [Telegram](https://t.me/leifermendez)
