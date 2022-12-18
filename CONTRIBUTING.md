# CONTRIBUTING

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

Abrir carpeta __example-app-base__ y ejecutar
```
cd example-app-base
npm i
npm run pre-copy
npm start
```

### __Commit y Push__

El proyecto tiene implementado __[husky](https://typicode.github.io/husky/#/)__, es una herramienta que dispara unas acciones al momento de hacer commit y hacer push.

__commit:__ Los commit son semánticos, esto quiere decir que deben cumplir un standar al momento de escribirlos ejemplo: ` feat(adapter): new adapter myqsl ` puede ver más info sobre esto __[aquí](https://github.com/conventional-changelog/commitlint/#what-is-commitlint)__

__push:__ Cada push ejecutar `yarn run test` el cual realiza los test internos que tienen que cumplir con __95% de cobertura__.


> Documento en constante actualización....

------
-   [Discord](https://link.codigoencasa.com/DISCORD)
-   [Twitter](https://twitter.com/leifermendez)
-   [Youtube](https://www.youtube.com/watch?v=5lEMCeWEJ8o&list=PL_WGMLcL4jzWPhdhcUyhbFU6bC0oJd2BR)
-   [Telegram](https://t.me/leifermendez)
