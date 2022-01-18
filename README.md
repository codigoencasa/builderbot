## Chatbot Whatsapp (OpenSource)
#### Actualizado Enero 2022

El siguiente proyecto se realizó con fines educativos para el canal de [Youtube (Leifer Mendez)](https://www.youtube.com/channel/UCgrIGp5QAnC0J8LfNJxDRDw?sub_confirmation=1) donde aprendemos como usando node.js podemos crear un chatbot increíble que además le agregamos inteligencia artificial gracias al servicio de dialogflow.
![](https://i.giphy.com/media/OBDi3CXC83WkNeLEZP/giphy.webp)
> Si tienes una cuenta en __heroku__ puedes desplegar este proyecto con 1 click

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/leifermendez/bot-ventas) 

> Comprarme un cafe!

[![Comprar](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/leifermendez)

#### Requisitos
- node v14 o superior

#### Video Creación 🤖
- [Ver Video 1](https://www.youtube.com/watch?v=A_Xu0OR_HkE)
- [¿Como instalarlo? (Actulización)](https://youtu.be/5lEMCeWEJ8o)

#### ¿Que puedo hacer con este chatbot?

Puedes crear tus flujos de trabajo, ya sea usando mysql, dialogflow o simplemente condiciones en el codigo.
IMAGE

### Instruciones
__Descargar o Clonar repositorio__
![](https://i.imgur.com/dSpUbFz.png)

__Instalar paquetes (npm install)__
> Ubicate en le directorio que descargaste y via consola o terminal ejecuta el siguiente comando

`npm install` 

![](https://i.imgur.com/BJuMjGR.png)

__Ejecutar el script app.js__
> Ubicate en le directorio que descargaste y via consola o terminal ejecuta el siguiente comando `node app.js` o `npm start`.
Escanea el el código QR desde tu aplicación de Whatsapp
`npm run start`

![](https://i.imgur.com/eMkBkuJ.png)

> Ahora abre la aplicación de Whatsapp en tu dispositivo y escanea el código QR
<img src="https://i.imgur.com/RSbPtat.png" width="500"  />

> Tambien puedes visitar la pagina `http://localhost:3000/qr` 
![](https://i.imgur.com/Q3JEDlP.png)

> Cuando sale este mensaje tu BOT está __listo__ para trabajar!
![](https://i.imgur.com/bhYHUyH.png)

### Configurar
Recuerda debes de crear tu archivo __.env__ basado en el archivo __.env.example__
```
######DATABASE: none, mysql, dialogflow

DEFAULT_MESSAGE=true
SAVE_MEDIA=true
PORT=3000
DATABASE=none
LANGUAGE=es
SQL_HOST=
SQL_USER=
SQL_PASS=
SQL_DATABASE=
```

> Si quieres usar la conexion via _mysql_ puedes importar el archivo [sql-bot.sql](s)

### ¿Como usarlo el chatbot de whatsapp?
> Escribe un mensaje al whatsapp que vinculaste con tu BOT

![](https://i.imgur.com/OSUgljQ.png)

> Ahora deberías  obtener un arespuesta por parte del BOT como la siguiente, ademas de esto tambien se crea un archivo excel
con el historial de conversación  con el número de tu cliente

![](https://i.imgur.com/lrMLgR8.png)
![](https://i.imgur.com/UYcoUSV.png)

### Preguntar al BOT
> Puedes interactuar con el bot ejemplo escribele __hola__ y el bot debe responderte!

![](https://i.imgur.com/cNAS51I.png)