# 🤖 BuilderBot con Autenticación con bcrypt

Este proyecto implementa un bot de WhatsApp usando BuilderBot con sistema de autenticación completo utilizando bcrypt para el hash de contraseñas.

## 🚀 Características

- ✅ **Autenticación segura** con bcrypt
- ✅ **Sistema de registro** de usuarios
- ✅ **Control de intentos** de login (máximo 3 intentos)
- ✅ **Bloqueo temporal** por seguridad
- ✅ **Middleware de autenticación** para flujos protegidos
- ✅ **API REST** para integración externa
- ✅ **Manejo de estados** persistente
- ✅ **Validación de credenciales** robusta

## 📋 Requisitos

- Node.js >= 18.0.0
- MySQL 5.7+ o 8.0+
- Evolution API configurada
- npm o yarn

## 🛠️ Instalación

1. **Clonar el repositorio**
```bash
git clone <tu-repositorio>
cd builderbot-auth-example
```

2. **Instalar dependencias**
```bash
npm install
# o
yarn install
```

3. **Configurar variables de entorno**
```bash
cp env.example .env
```

Edita el archivo `.env` con tus configuraciones:
```env
PORT=3008
EVOLUTION_API_KEY=tu_api_key
EVOLUTION_API_URL=http://localhost:8080
INSTANCE_NAME=auth-bot
MYSQL_DB_HOST=localhost
MYSQL_DB_USER=root
MYSQL_DB_PASSWORD=tu_password
MYSQL_DB_NAME=builderbot_auth
MYSQL_DB_PORT=3306
```

4. **Configurar base de datos**
```sql
CREATE DATABASE builderbot_auth;
```

5. **Iniciar el bot**
```bash
npm start
# o
npm run dev
```

## 🔐 Usuarios de Prueba

El sistema incluye usuarios de prueba predefinidos:

| Usuario | Contraseña | Estado |
|---------|------------|--------|
| admin | admin123 | Activo |
| usuario | password123 | Activo |
| test | test123 | Inactivo |

## 📱 Comandos del Bot

### Comandos Públicos
- `hi`, `hello`, `hola` - Mensaje de bienvenida
- `login`, `iniciar sesion` - Iniciar sesión
- `registro`, `crear cuenta` - Crear nueva cuenta
- `ayuda`, `help` - Mostrar ayuda

### Comandos Autenticados
- `menu`, `inicio` - Menú principal
- `perfil`, `mi cuenta` - Ver perfil
- `estado`, `status` - Estado de sesión
- `logout`, `cerrar sesion` - Cerrar sesión

## 🏗️ Estructura del Proyecto

```
src/
├── types/
│   └── auth.ts              # Tipos TypeScript para autenticación
├── services/
│   └── authService.ts       # Servicio de autenticación con bcrypt
├── middleware/
│   └── authMiddleware.ts    # Middleware de verificación
├── flows/
│   └── authFlow.ts          # Flujos de autenticación
└── app.ts                   # Aplicación principal
```

## 🔧 API Endpoints

### POST `/v1/messages`
Enviar mensaje a un número
```json
{
  "number": "1234567890",
  "message": "Hola mundo",
  "urlMedia": "https://example.com/image.jpg" // opcional
}
```

### GET `/v1/auth/status?number=1234567890`
Verificar estado de autenticación de un usuario

### POST `/v1/auth/logout`
Cerrar sesión de un usuario
```json
{
  "number": "1234567890"
}
```

### GET `/health`
Verificar estado del servidor

## 🔒 Seguridad

- **bcrypt** con 12 rounds de salt para hash de contraseñas
- **Límite de intentos** de login (3 intentos máximo)
- **Bloqueo temporal** de 15 minutos después de intentos fallidos
- **Validación robusta** de credenciales
- **Limpieza automática** de estados temporales

## 🚀 Uso Avanzado

### Crear un Flujo Protegido

```typescript
import { AuthMiddleware } from './middleware/authMiddleware'

const protectedFlow = addKeyword(['mi-flujo'])
    .addAction(async (ctx, methods) => {
        const { state, flowDynamic, gotoFlow } = methods
        
        // Verificar autenticación
        if (!AuthMiddleware.isAuthenticated(state)) {
            await flowDynamic('🔐 Acceso restringido')
            return gotoFlow(loginFlow)
        }
        
        // Tu lógica aquí
        await flowDynamic('¡Contenido protegido!')
    })
```

### Personalizar Configuración de Seguridad

```typescript
// En src/services/authService.ts
export class AuthService {
    private static readonly SALT_ROUNDS = 12        // Cambiar rounds de bcrypt
    private static readonly MAX_LOGIN_ATTEMPTS = 3  // Cambiar intentos máximos
    private static readonly LOCKOUT_TIME = 15 * 60 * 1000 // Cambiar tiempo de bloqueo
}
```

## 🐛 Solución de Problemas

### Error de conexión a MySQL
- Verifica que MySQL esté ejecutándose
- Confirma las credenciales en `.env`
- Asegúrate de que la base de datos existe

### Error de Evolution API
- Verifica que Evolution API esté ejecutándose
- Confirma la URL y API key en `.env`
- Revisa los logs de Evolution API

### Error de bcrypt
- Asegúrate de que bcrypt esté instalado: `npm install bcrypt @types/bcrypt`
- En sistemas Windows, puede requerir: `npm install --global windows-build-tools`

## 📝 Logs

El bot registra información detallada en la consola:
- Intentos de login exitosos y fallidos
- Errores de autenticación
- Estados de sesión
- Errores de base de datos

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 🆘 Soporte

Si tienes problemas o preguntas:
1. Revisa la documentación de [BuilderBot](https://builderbot.app/docs)
2. Abre un issue en este repositorio
3. Contacta al equipo de desarrollo

---

**¡Disfruta construyendo bots seguros con BuilderBot! 🚀**