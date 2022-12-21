# CONTRIBUTING

### 📄 Bienvenido/a
Si deseas colaborar con el proyecto existen varias maneras, la primera de ellas es aportando conocimiento y mejorando el repositorio (actualizando documentación, mejorando código, revisando __[issues](https://github.com/codigoencasa/bot-whatsapp/issues)__, etc). 

 También es bien recibido los aportes económicos que se utilizaran para diferentes fines __[ver más](https://opencollective.com/bot-whatsapp)__

El lenguaje principal que se utilizó para desarrollar este proyecto fue __JavaScript__ con el fin de qué personas que están iniciando en el mundo de la programación puedan entender fácilmente.


### 🤔 Preguntas frecuentes
- ¿Como puedo hacer aportaciones de código en el proyecto?: [Ver Video](https://youtu.be/Lxt8Acob6aU)
- ¿Como ejecutar el entorno de pruebas?: [Ver Video](https://youtu.be/Mf9V-dloBfk)
- ¿Como crear un nuevo proveedor?: [Ver Video](https://youtu.be/cahK9zH3SI8)
- ¿Que son los GithubActions?: [Ver Video](https://youtu.be/nYBEBFKLiqw)
- ¿Canales de comunicación?: [Discord](https://link.codigoencasa.com/DISCORD)

-----

![](https://i.giphy.com/media/ntMt6TvalpstTIx7Ak/giphy.webp)


__Requerimientos:__
- Node v16 o superior __[descargar node](https://nodejs.org/es/download/)__
- __[Yarn](https://classic.yarnpkg.com/lang/en/docs/install/#windows-stable)__ como gestor de paquetes. En el link conseguirás las intrucciones para instalar yarn.
- __[VSCode](https://code.visualstudio.com/download)__ (recomendado): Editor de código con plugins.
- __[Conventional Commits](https://marketplace.visualstudio.com/items?itemName=vivaxy.vscode-conventional-commits&ssr=false#overview)__ (plugin-vscode) este plugin te ayudará a crear commit semántico.
- Se usará la rama __dev__ *(https://github.com/leifermendez/bot-whatsapp/tree/dev)* como rama principal hasta que se haga oficialmente el lanzamiento de la V2.

### 🚀 Iniciando

__Clonar repo rama dev__
```
git clone --branch dev https://github.com/codigoencasa/bot-whatsapp
```
__Instalar dependencias__
``` 
cd bot-whatsapp
yarn install
```

__Compilar (build)__
Para compilar la aplicación es necesario ejecutar este comando, el cual genera un directorio `lib` dentro de los paquetes del monorepo.

```
yarn build
```

__Example-app__
Se ejecuta el CLI (Command Line Interface) para ayudarte a crear un app-bot de ejemplo.
```
yarn run cli
```

Selecionas (mediante las flechas arriba y abajo) el proveedor que quieras usar y cuando estes sobre el presiona la barra de espacio, igualmente selecciona la base de datos que quieras usar.

Se creó un subdirecorio con el nombre del proveedor y base de datos que seleccionaste, ejemplo: `base-bailey-mysql`

Dentro de ese directorio necesitas editar el archivo package.json y borrar las siguientes lineas:
```
        "@bot-whatsapp/bot": "latest",
        "@bot-whatsapp/cli": "latest",
        "@bot-whatsapp/database": "latest",
        "@bot-whatsapp/provider": "latest",
```

Cambiate al directorio creado ejemplo: `base-bailey-mysql`
```
cd base-baileys-mysql
```
Ejecuta los comandos:
```
npm install
npm run pre-copy
npm start
```
En el caso de MySql y Mongo es necesario especificar en app.js los datos de la conexión, ejemplo de MySql:
```
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
<!-- __Seguir instrucciones__
En la consola encontraras los pasos a seguir -->

![](https://i.imgur.com/dC6lEwy.png)


> __NOTA:__ [Eres libre de aportar informacion a este documento o arreglar ortografia 🤣](
https://github.com/codigoencasa/bot-whatsapp/edit/dev/CONTRIBUTING.md)

------
-   [Discord](https://link.codigoencasa.com/DISCORD)
-   [Twitter](https://twitter.com/leifermendez)
-   [Youtube](https://www.youtube.com/watch?v=5lEMCeWEJ8o&list=PL_WGMLcL4jzWPhdhcUyhbFU6bC0oJd2BR)
-   [Telegram](https://t.me/leifermendez)
