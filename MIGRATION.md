## MIGRANDO DE LA VERSIÓN 1 A LAS VERSIÓN 2

Pasar los flujos del bot de la versión 1 a la 2 es muy fácil, supongamos que en tu initial.json y response.json tienes un flujo como el siguiente:

```js
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
        "keywords": ["adios", "bye"],
        "key": "adios"
    }
]
```
y

```js
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
        "media":null
    }
}
```
En la versión 2, no es necesario tener esos 2 archivos, los flujos se ponen directamente en app.js de la siguiente manera:

```js
//app.js
/**
 * Declarando flujos principales.
 */
const flowHola = addKeyword(['hola', 'ola', 'alo']) //Aqui van los "keywords" de initial.json
    .addAnswer('Gracias a ti!') // Aquí va la respuesta del response.json, no es necesario especificar nuevamente los "keywords"
    .addAnswer('Siempre un placer!!!') // Y se pueden agregar varias respuestas encadenadas ... TANTAS com sean necesarias.

const flowAdios = addKeyword(['adios', 'bye']) //Aqui van los "keywords" de initial.json
    .addAnswer('Que te vaya bien!!') // Aquí va la respuesta del response.json, no es necesario especificar nuevamente los "keywords"
    .addAnswer('Hasta luego!', // Y se pueden agregar varias respuestas encadenadas ... TANTAS com sean necesarias.
    null, null,[...addChild(flowHijo1)] // Y se pueden agregar flujos HIJOS (Sub Menus). Los flujos hijos se tienen que definir ANTES que los principales.
    )


##FALTAN EJEMPLOS DE ENVIOS DE IMAGENES!


    const main = async () => {
    const adapterDB = new MockAdapter()
    const adapterFlow = createFlow([flowHola, flowAdios]) // Aqui se crean los flujos.
    const adapterProvider = createProvider(BaileysProvider)
    createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })
}
    ```