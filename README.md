## Chatbot Whatsapp (OpenSource)
#### Actualizado Abril 2022

El siguiente proyecto se realizó con fines educativos para el canal de [Youtube (Leifer Mendez)](https://www.youtube.com/channel/UCgrIGp5QAnC0J8LfNJxDRDw?sub_confirmation=1) donde aprendemos a crear y implementar un chatbot increíble usando [node.js](https://codigoencasa.com/tag/nodejs/) además le agregamos inteligencia artificial gracias al servicio de __dialogflow__.

[![Video](https://i.giphy.com/media/OBDi3CXC83WkNeLEZP/giphy.webp)](https://youtu.be/5lEMCeWEJ8o) 

### ATENCION 🔴
> 💥💥 Si te aparece el Error Multi-device es porque tienes la cuenta de whatsapp afiliada al modo "BETA de Multi dispositivo" por el momento no se tiene soporte para esas personas si tu quieres hacer uso de este __BOT__ debes de salir del modo BETA y intentarlo de la manera tradicional

> El core de whatsapp esta en constante actualizaciones por lo cual siempre revisa la ultima fecha de la actualizacion 
> [VER](https://github.com/leifermendez/bot-whatsapp/commits/main)

### Busco colaboradores ⭐
Hola amigos me gusta mucho este proyecto pero por cuestiones de tiempo se me dificulta mantener las actualizaciones si alguno quieres participar en el proyecto escribeme a leifer.contacto@gmail.com

#### Acceso rápido 
> Si tienes una cuenta en __heroku__ puedes desplegar este proyecto con (1 click)

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/leifermendez/bot-whatsapp) 

> Comprarme un cafe!

[![Comprar](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/leifermendez)

#### Actualización

| Feature  | Status |
| ------------- | ------------- |
| Dialogflow  | ✅  |
| MySQL  | ✅  |
| JSON File  | ✅  |
| QR Scan (route) | ✅ |
| Easy deploy heroku  | ✅  |
| Buttons | ✅ℹ️  (No funciona en multi-device)|
| Send Voice Note | ✅ |
| Add support ubuntu/linux | ✅ |

## Requisitos
- node v14 o superior
- VSCode (Editor de codigo) [Descargar](https://code.visualstudio.com/download)
- MySql (opcional) solo aplica si vas a usar el modo 'mysql'  [sql-bot.sql migración](https://github.com/leifermendez/bot-whatsapp/blob/main/sql-bot.sql)
- Dialogflow (opcional) solo aplica si vas a usar el modo 'dialogflow'

### (Nuevo) Botones

[![btn](https://i.imgur.com/W7oYlSu.png)](https://youtu.be/5lEMCeWEJ8o) 

> Implementar los botones solo necesitas hacer uso del metodo __sendMessageButton__ que se encuentra dentro `./controllers/send` dejo un ejemplo de como usarlo.
[Ver implementación](https://github.com/leifermendez/bot-whatsapp/blob/main/app.js#L123)

``` javascript
const { sendMessageButton } = require('./controllers/send')

await sendMessageButton(
    {
        "title":"¿Que te interesa ver?",
        "message":"Recuerda todo este contenido es gratis y estaria genial que me siguas!",
        "footer":"Gracias",
        "buttons":[
            {"body":"😎 Cursos"},
            {"body":"👉 Youtube"},
            {"body":"😁 Telegram"}
        ]
    }
)

```

## Notas de Voz
[![voice note](https://i.imgur.com/zq6xYDp.png)](https://i.imgur.com/zq6xYDp.png) 

> Se pueden enviar notas de voz con formato nativo para que no se vea como reenviado. En este ejemplo enviare el archivo __PTT-20220223-WA0000.opus__ que se encuentra dentro de la carpeta de __/mediaSend__

``` javascript
const { sendMediaVoiceNote } = require('./controllers/send')

await sendMediaVoiceNote(client, from, 'PTT-20220223-WA0000.opus')

```

## Instruciones
__Descargar o Clonar repositorio__
![](https://i.imgur.com/dSpUbFz.png)

__Usas ¿Ubuntu / Linux?__
> Asegurate de instalar los siguientes paquetes
```
sudo apt-get install -y libgbm-dev
sudo apt install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
```

__Instalar dependencias (npm install)__
> Ubicate en le directorio que descargaste y via consola o terminal ejecuta el siguiente comando

`npm install` 

![](https://i.imgur.com/BJuMjGR.png)

__Configurar .env__
> Con el editor de texto crea un archivo `.env` el cual debes de guiarte del archivo `.env.example`
[Ver video explicando](https://youtu.be/5lEMCeWEJ8o?t=381)
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

![](https://i.imgur.com/9poNnW0.png)

__Ejecutar el script__
> Ubicate en le directorio que descargaste y via consola o terminal ejecuta el siguiente comando
`npm run start`

![](https://i.imgur.com/eMkBkuJ.png)

__Whatsapp en tu celular__
> Ahora abre la aplicación de Whatsapp en tu dispositivo y escanea el código QR
<img src="https://i.imgur.com/RSbPtat.png" width="500"  />
Visitar la pagina 
`http://localhost:3000/qr` 

![](https://i.imgur.com/Q3JEDlP.png)

__Listo 😎__
> Cuando sale este mensaje tu BOT está __listo__ para trabajar!
![](https://i.imgur.com/eoJ4Ruk.png)

# ¿Quieres ver como se creó? 🤖
- [Ver Video 1](https://www.youtube.com/watch?v=A_Xu0OR_HkE)
- [¿Como instalarlo? (Actulización)](https://youtu.be/5lEMCeWEJ8o)

## ¿Como usarlo el chatbot de whatsapp?
> Escribe un mensaje al whatsapp que vinculaste con tu BOT

![](https://i.imgur.com/OSUgljQ.png)

> Ahora deberías  obtener un arespuesta por parte del BOT como la siguiente, ademas de esto tambien se crea un archivo excel
con el historial de conversación  con el número de tu cliente

![](https://i.imgur.com/lrMLgR8.png)
![](https://i.imgur.com/UYcoUSV.png)

## Preguntar al BOT
> Puedes interactuar con el bot ejemplo escribele __hola__ y el bot debe responderte!

![](https://i.imgur.com/cNAS51I.png)
