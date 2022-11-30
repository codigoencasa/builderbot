# CONTRIBUTING

__Requerimientos:__
- Node v16 o superior __[descargar node](https://nodejs.org/es/download/)__
- __[Yarn](https://classic.yarnpkg.com/lang/en/docs/install/#windows-stable)__ como gestor de paquetes. En el link conseguiras las intrucciones para instalar yarn.
- Se usara la rama __dev__ *(https://github.com/leifermendez/bot-whatsapp/tree/dev)* como rama principal hasta que se haga oficialmente el lanzamiento de la V2

__Clonar__
```shell
git clone --branch dev https://github.com/leifermendez/bot-whatsapp
```
__Instalar dependencias__
```shell 
cd bot-whatsapp
yarn
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
