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


#### CTX
```json
 {
    ref: 'ans_7d9981e5-5019-422c-a19a-565cbb021391',
    keyword: 'ans_cfdad31b-ff6d-475f-873a-4ed6f8a79a43',
    answer: 'Esperando respuesta...',
    options: {
      media: null,
      buttons: [],
      capture: true,
      child: null,
      nested: [Array],
      keyword: {},
      callback: true
    },
    refSerialize: '81f18f563fd26a6c6d12c62aed98095f',
    from: 'NUMERO_PERSONA_QUE_ESCRIBE'
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
