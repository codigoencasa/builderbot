### 🚀 Package (@bot-whatsapp/database)

Este package tiene como reponsabilidad proveer de diferentes adaptadores para la capa de datos. 
La idea es brindar multiples opciones como un adaptador de MySQL, Mongo, entre otros.

Ejemplo de como se implementaria:


```js
const MongoAdapter = require('@bot-whatsapp/database/mongo')
/// o
const MySQLAdapter = require('@bot-whatsapp/database/mysql')

const main = async () => {

    const adapterDB = new MongoAdapter()
    const adapterFlow = createFlow([flujoBot])
    const adapterProvider = createProvider(WebWhatsappProvider)

    createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })
}
```

#### Video

> Video explicando como debes de agregar nuevos adaptadores 
[![Video](https://i.imgur.com/DlxJIKV.gif)](https://youtu.be/Sjzkpg1OJuY)
---

**Comunidad**

> Forma parte de este proyecto.

-   [Discord](https://link.codigoencasa.com/DISCORD)
-   [Twitter](https://twitter.com/leifermendez)
-   [Youtube](https://www.youtube.com/watch?v=5lEMCeWEJ8o&list=PL_WGMLcL4jzWPhdhcUyhbFU6bC0oJd2BR)
-   [Telegram](https://t.me/leifermendez)
