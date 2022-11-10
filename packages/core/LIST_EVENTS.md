-   **require_action**: Indica que accion se necesita por parte del usuario y debe contener `instructions` obligatorio

```json
{
    "instructions": `Debes escanear el QR Code para iniciar session reivsa qr.svg`,
    ... otros argumentos
}
```

-   **ready**: Indica que todo los procesos para usar el provider han pasado correctamente. Ejemplo validacion de token credenciales etc

retorna: `true`

-   **auth_failure**: Indica que un problema ocurrio en el inicio del provider `instructions` obligatorio

```json
{
    "instructions": `Debes escanear el QR Code para iniciar session reivsa qr.svg`,
    ... otros argumentos
}
```

-   **message**: Indica que mensaje a entrado se debe contemplar la siguiente estructura

```json
{
    "from": 'Numero de telefono o id que identifique al usuario',
    "body": 'Mensaje en string que esta entrando',
    "hasMedia": 'boolean true o false indicando is tiene un archivo multimedia',
    ... otros argumentos
}
```
