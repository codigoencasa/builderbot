## Chatbot Whatsapp (OpenSource)
#### Actualizado Enero 2022

El siguiente proyecto se realizó con fines educativos para el canal de [Youtube (Leifer Mendez)](https://www.youtube.com/channel/UCgrIGp5QAnC0J8LfNJxDRDw?sub_confirmation=1) donde aprendemos a crear y implementar un chatbot increíble usando [node.js](https://codigoencasa.com/tag/nodejs/) además le agregamos inteligencia artificial gracias al servicio de __dialogflow__.

[![Video](https://i.giphy.com/media/OBDi3CXC83WkNeLEZP/giphy.webp)](https://youtu.be/5lEMCeWEJ8o) 

#### Acceso rápido
> Si tienes una cuenta en __heroku__ puedes desplegar este proyecto con (1 click)

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/leifermendez/bot-ventas) 

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
| Add support ubuntu/linux | ✅ |

## Requisitos
- node v14 o superior
- VSCode (Editor de codigo) [Descargar](https://code.visualstudio.com/download)
- MySql (opcional) solo aplica si vas a usar el modo 'mysql'  [sql-bot.sql migración](https://github.com/leifermendez/bot-whatsapp/blob/main/sql-bot.sql)
- Dialogflow (opcional) solo aplica si vas a usar el modo 'dialogflow'

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
