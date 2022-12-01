# CONTRIBUTING

__Requerimientos:__
- Node v16 o superior __[descargar node](https://nodejs.org/es/download/)__
- __[Yarn](https://classic.yarnpkg.com/lang/en/docs/install/#windows-stable)__ como gestor de paquetes. En el link conseguiras las intrucciones para instalar yarn.
- Se usara la rama __dev__ *(https://github.com/leifermendez/bot-whatsapp/tree/dev)* como rama principal hasta que se haga oficialmente el lanzamiento de la V2

>💡 Se usa la version 3.3.0 o superior de Yarn para establecer esta version simplemente ejecuta el siguiente comando: `yarn set version 3.3.0`

__Clonar repo rama dev__
```
git clone --branch dev https://github.com/leifermendez/bot-whatsapp
```
__Instalar dependencias__
``` 
cd bot-whatsapp
yarn install
```

__Compilar (build)__
Para compilar la aplicación es necesario ejecutar, eso te genera dentro de packages del monorepo un directorio `lib`

```
yarn build
```
Luego de ejecutar el comando conseguiras algo como lo siguiente. Esas carpetas lib NO se suben al repo estan ignoradas.
```
packages/bot/lib
packages/cli/lib
packages/database/lib
packages/provider/lib
```

__Linking__
```
yarn link.dist
```

__Example-app__
```
yarn run cli
```

Abrir carpeta example-app-base
```
npm link @bot-whatsapp/bot -S
npm link @bot-whatsapp/provider -S
npm link @bot-whatsapp/database -S
npm i
npm start
```

__Commit y Push__
El proyecto tiene implementado __[husky](https://typicode.github.io/husky/#/)__ es una herramienta que dispara unas acciones al momento de hacer commit y hacer push

__commit:__ Los commit son semanticos esto quiere decir que deben cumplir un standar al momento de escribirlos ejemplo ` feat(adapter): new adapter myqsl ` puede ver más info sobre esto __[aquí](https://github.com/conventional-changelog/commitlint/#what-is-commitlint)__

__push:__ Cada push ejecutar `yarn run test` el cual ejecuta los test internos que tienen que cumplir con __95% de cobertura__.









------
-   [Discord](https://link.codigoencasa.com/DISCORD)
-   [Twitter](https://twitter.com/leifermendez)
-   [Youtube](https://www.youtube.com/watch?v=5lEMCeWEJ8o&list=PL_WGMLcL4jzWPhdhcUyhbFU6bC0oJd2BR)
-   [Telegram](https://t.me/leifermendez)
