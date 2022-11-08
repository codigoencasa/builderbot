### 🚀 Packages

Se separaran responsabilidades del proyecto en diferentes packages, de esta manera se podra versionar y controlar los diferentes versionamientos y cambios con un mayor desacoplamiento.

##### Principales Funciones

El bot tiene tres funciones principales hasta este momento la cuales divideremos en paquetes para que puedan trabajarse y por separador sin acoplamiento.

**Package CLI** (_Command Line Interface_)

> Sera basicamente un asistente via `cosola` el cual nos ayudara a realizar las instalacion de las dependencias necesarias y a crear un archivo de configuracion para tener un migrado rápido.
> La idea esque se pueda ejecutar un commando parecido a `npm create bot@leifermendez` o algo parecido y comienze a instalar todo.

🤞 Funciones deseadas:

-   Que actualice y corrija los problema de versionamientos más frecuetes
-   Verificar la versión de NODE correcta
-   Verificar OS para brindar mejor soporte de puppeter
-   Limpiar sesion, borrar carpeta de sesion
-   Seleccionar provider
-   Poder usar un archivo .json con la configuración

**Package Provider**

> Es parte clave del proyecto la idea es poder tener la opcion de incluir otro proveedor de mensajeria como la api oficial o api de twilio

-   WhatsappWeb (_default_)
-   Whatsapp API official
-   Twilio

**Package Input/Output**

> Gestionar los diferentes mensajes entranates y poder responder, a la vez de mantener un registro de los datos

---

**Comunidad**

> Forma parte de este proyecto.

-   [Discord](https://link.codigoencasa.com/DISCORD)
-   [Twitter](https://twitter.com/leifermendez)
-   [Youtube](https://www.youtube.com/watch?v=5lEMCeWEJ8o&list=PL_WGMLcL4jzWPhdhcUyhbFU6bC0oJd2BR)
-   [Telegram](https://t.me/leifermendez)
