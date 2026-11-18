# CONTRIBUTING

### 👋 Bienvenido/a
Nos alegra que estés interesado en colaborar en nuestro proyecto. Para hacerlo, puedes contribuir de diversas maneras, la principal es aportando tu conocimiento y habilidades para mejorar el repositorio, ya sea actualizando la documentación, mejorando el código o revisando problemas pendientes en los __[issues](https://github.com/codigoencasa/builderbot/issues)__.

También agradecemos los aportes económicos, que utilizaremos para diversos fines relacionados con el desarrollo y mantenimiento del proyecto. Puedes ver más detalles aquí: __[ver más](https://opencollective.com/bot-whatsapp)__


------

__Requisitos:__
Para poder aportar al proyecto necesitarás tener:
- __[Node.js](https://nodejs.org/es/download/)__ con una versión compatible con la dependencia `sharp`: `^18.17.0 || ^20.3.0 || >=21.0.0` (definida en el campo `engines` de `packages/bot/package.json`).
- __[pnpm](https://pnpm.io/cli/install)__ como administrador de paquetes. Puedes seguir el enlace para saber cómo instalarlo.
- __[VSCode](https://code.visualstudio.com/download)__ es el editor de código que recomendamos, ya que cuenta con plugins útiles.
- __[Conventional Commits](https://marketplace.visualstudio.com/items?itemName=vivaxy.vscode-conventional-commits&ssr=false#overview)__ es un plugin de VSCode que te ayudará a crear commits semánticos, siguiendo buenas prácticas.

### 🚀 Empezando

__Hacer Fork del Proyecto__

Antes de comenzar, es necesario que hagas un fork del proyecto en tu propia cuenta de GitHub. Esto te permitirá trabajar en tu propia copia del repositorio. Haz clic en el siguiente enlace para realizar el fork: [aquí](https://github.com/codigoencasa/builderbot/fork)

__Clona repositorio (desde tu fork)__
```
git clone https://github.com/TU_USERNAME/builderbot
```
__Instalar dependencias__
Entra a la carpeta del proyecto y ejecuta el siguiente comando para instalar las dependencias necesarias.
```
cd builderbot
pnpm install
```

__Compilar (build)__
Para compilar la aplicación, debes ejecutar el siguiente comando, el cual generará un directorio `dist` dentro de los paquetes del monorepo.
```
pnpm run build
```

__Aplicación de ejemplo__
Se ejecuta el CLI (Command Line Interface) para ayudarte a crear un bot de ejemplo.
```
pnpm run cli
```
Selecciona el proveedor y la base de datos que quieras usar usando las flechas arriba y abajo de tu teclado y marcándolas con la barra de espacio.

Este proceso creará un subdirectorio con el nombre del proveedor y la base de datos que seleccionaste, por ejemplo: `base-js-baileys-mysql`. El `package.json` generado ya incluye las dependencias de `@builderbot/*` necesarias, por ejemplo:
```
"@builderbot/bot": "latest",
"@builderbot/database-mysql": "latest",
"@builderbot/provider-baileys": "latest"
```
A continuación, debes desplazarte al directorio que acabas de crear, por ejemplo: `base-js-baileys-mysql`
```
cd base-js-baileys-mysql
```
Y ejecuta los siguientes comandos:
```
npm install
npm start
```
En el caso de MySql y Mongo, necesitarás especificar en el archivo `src/app.js` los datos de la conexión, por ejemplo, para MySql:
```js
import { MysqlAdapter as Database } from '@builderbot/database-mysql'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'

/**
 * Declaramos las conexiones de MySQL
 */
const MYSQL_DB_HOST = 'localhost'
const MYSQL_DB_USER = 'usr'
const MYSQL_DB_PASSWORD = 'pass'
const MYSQL_DB_NAME = 'bot'

const adapterDB = new Database({
    host: MYSQL_DB_HOST,
    user: MYSQL_DB_USER,
    password: MYSQL_DB_PASSWORD,
    database: MYSQL_DB_NAME,
})
```

__Pruebas (tests)__
Todos los cambios realizados deben pasar las pruebas del monorepo:
```
pnpm test
```
También puedes ejecutar las pruebas de un solo paquete:
```
pnpm --filter <package-name> test
```
Por ejemplo: `pnpm --filter @builderbot/bot test`.

### Antes de enviar un Pull Request
Revisa la guía para contribuir en `AGENTS.md` y asegúrate de que:
- Los chequeos de lint y formato pasan:
```
pnpm run lint:check
pnpm run format:check
```
- Las pruebas del paquete afectado pasan: `pnpm --filter <package-name> test`.
- Los commits siguen el estándar [Conventional Commits](https://www.conventionalcommits.org/): el repositorio usa commitlint y no acepta otro formato.
- No editas a mano los starters generados (`starters/apps/**`); se regeneran con `pnpm run generate.templates`.
- Rellenas la plantilla de Pull Request (`.github/PULL_REQUEST_TEMPLATE.md`) con una descripción clara de tu aporte y abres el PR desde una rama de tu fork hacia la rama `builderbot`.

> __NOTA:__ Si encuentras información que podría mejorarse en este documento o algún error ortográfico que dificulte la comprensión, eres libre de corregirlo.([edita aqui](https://github.com/codigoencasa/builderbot/edit/builderbot/CONTRIBUTING.md))

------
-   [Discord](https://link.codigoencasa.com/DISCORD)
-   [Twitter](https://twitter.com/leifermendez)
-   [Youtube](https://www.youtube.com/watch?v=5lEMCeWEJ8o&list=PL_WGMLcL4jzWPhdhcUyhbFU6bC0oJd2BR)
-   [Telegram](https://t.me/leifermendez)
