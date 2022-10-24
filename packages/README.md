### 🚀 Packages

Se separaran responsabilidades del proyecto en diferentes packages, de esta manera se podra versionar y controlar los diferentes versionamientos y cambios con un mayor desacoplamiento.

##### Principales Funciones
 El bot tiene tres funciones principales hasta este momento la cuales divideremos en paquetes para que puedan trabajarse y por separador sin acoplamiento.

__Package CLI__  (*Command Line Interface*)
> Sera basicamente un asistente via `cosola` el cual nos ayudara a realizar las instalacion de las dependencias necesarias y a crear un archivo de configuracion para tener un migrado rápido.
> La idea esque se pueda ejecutar un commando parecido a `npm create bot@leifermendez` o algo parecido y comienze a instalar todo. 

🤞 Funciones deseadas:

- Que actualice y corrija los problema de versionamientos más frecuetes
-  Verificar la versión de NODE correcta
- Verificar OS para brindar mejor soporte de puppeter
-  Limpiar sesion, borrar carpeta de sesion
- Seleccionar provider
- Poder usar un archivo .json con la configuración 


__Package Provider__
> Es parte clave del proyecto la idea es poder tener la opcion de incluir otro proveedor de mensajeria como la api oficial o api de twilio

- WhatsappWeb (*default*)
- Whatsapp API official
- Twilio

__Package Input/Output__
> Gestionar los diferentes mensajes entranates y poder responder, a la vez de mantener un registro de los datos