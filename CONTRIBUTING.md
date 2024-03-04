# CONTRIBUTING

### 👋 Bienvenido/a
Nos alegra que estés interesado en colaborar en nuestro proyecto. Para hacerlo, puedes contribuir de diversas maneras, la principal es aportando tu conocimiento y habilidades para mejorar el repositorio, ya sea actualizando la documentación, mejorando el código o revisando problemas pendientes en los __[issues](https://github.com/codigoencasa/bot-whatsapp/issues)__. 

También agradecemos los aportes económicos, que utilizaremos para diversos fines relacionados con el desarrollo y mantenimiento del proyecto. Puedes ver más detalles aquí: __[ver más](https://opencollective.com/bot-whatsapp)__


------

__Requisitos:__
Para poder aportar al proyecto necesitarás tener:
- Node v20 o superior. Puedes descargar Node aquí: __[descargar node](https://nodejs.org/es/download/)__
- __[pnpm](https://pnpm.io/cli/install)__ como administrador de paquetes. Puedes seguir el enlace para saber cómo instalarlo.
- __[VSCode](https://code.visualstudio.com/download)__ es el editor de código que recomendamos, ya que cuenta con plugins útiles.
- __[Conventional Commits](https://marketplace.visualstudio.com/items?itemName=vivaxy.vscode-conventional-commits&ssr=false#overview)__ es un plugin de VSCode que te ayudará a crear commits semánticos, siguiendo buenas prácticas.

### 🚀 Empezando

__Hacer Fork del Proyecto__

Antes de comenzar, es necesario que hagas un fork del proyecto en tu propia cuenta de GitHub. Esto te permitirá trabajar en tu propia copia del repositorio. Haz clic en el siguiente enlace para realizar el fork: [aquí](https://github.com/codigoencasa/bot-whatsapp/fork)

__Clona repositorio (desde tu fork)__
```
git clone https://github.com/TU_USERNAME/bot-whatsapp
```
__Instalar dependencias__
Entra a la carpeta del proyecto y ejecuta el siguiente comando para instalar las dependencias necesarias.
``` 
cd bot-whatsapp
pnpm install
```

__Compilar (build)__
Para compilar la aplicación, debes ejecutar el siguiente comando, el cual generará un directorio `lib` dentro de los paquetes del monorepo.
```
pnpm run build
```

__Aplicación de ejemplo__
Se ejecuta el CLI (Command Line Interface) para ayudarte a crear un bot de ejemplo.
```
pnpm run cli
```

__Test e2e__
Todos los cambios realizados deben de pasar las pruebas end-to-end
```
pnpm run test.e2e
```

Selecciona el proveedor y la base de datos que quieras usar usando las flechas arriba y abajo de tu teclado y marcándolas con la barra de espacio.

Este proceso creará un subdirectorio con el nombre del proveedor y la base de datos que seleccionaste, por ejemplo: `base-bailey-mysql`

Dentro de ese directorio, tendrás que editar el archivo package.json y borrar las siguientes líneas:
```
        "@bot-whatsapp/bot": "latest",
        "@bot-whatsapp/cli": "latest",
        "@bot-whatsapp/database": "latest",
        "@bot-whatsapp/provider": "latest",
```

A continuación, debes desplazarte al directorio que acabas de crear, por ejemplo: `base-baileys-mysql`
```
cd base-baileys-mysql
```
Y ejecuta los siguientes comandos:
```
npm install
npm run pre-copy
npm start
```
En el caso de MySql y Mongo, necesitarás especificar en el archivo app.js los datos de la conexión, por ejemplo, para MySql:
```js
const BaileysProvider = require('@bot-whatsapp/provider/baileys')
const MySQLAdapter = require('@bot-whatsapp/database/mysql')

/**
 * Declaramos las conexiones de MySQL
 */
const MYSQL_DB_HOST = 'localhost'
const MYSQL_DB_USER = 'usr'
const MYSQL_DB_PASSWORD = 'pass'
const MYSQL_DB_NAME = 'bot'
```

> __NOTA:__ Si encuentras información que podría mejorarse en este documento o algún error ortográfico que dificulte la comprensión, eres libre de corregirlo.([edita aqui](https://github.com/codigoencasa/bot-whatsapp/edit/dev/CONTRIBUTING.md))

------
-   [Discord](https://link.codigoencasa.com/DISCORD)
-   [Twitter](https://twitter.com/leifermendez)
-   [Youtube](https://www.youtube.com/watch?v=5lEMCeWEJ8o&list=PL_WGMLcL4jzWPhdhcUyhbFU6bC0oJd2BR)
-   [Telegram](https://t.me/leifermendez)