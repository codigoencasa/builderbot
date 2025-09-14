import { join } from 'path'
import { createBot, createProvider, createFlow, addKeyword, utils } from '@builderbot/bot'
import { MysqlAdapter as Database } from '@builderbot/database-mysql'
import { EvolutionProvider as Provider } from '@builderbot/provider-evolution-api'
import { AuthMiddleware } from './middleware/authMiddleware'
import { 
    loginFlow, 
    registerFlow, 
    mainMenuFlow, 
    profileFlow, 
    profileActionsFlow,
    settingsFlow,
    helpFlow,
    retryLoginFlow,
    cancelLoginFlow
} from './flows/authFlow'

// Cargar variables de entorno
require('dotenv').config()

const PORT = process.env.PORT ?? 3008

// Flujo de bienvenida (público)
const welcomeFlow = addKeyword<Provider, Database>(['hi', 'hello', 'hola', 'inicio', 'start'])
    .addAnswer('🤖 *¡Bienvenido al Bot con Autenticación!*')
    .addAnswer('Soy un bot que requiere autenticación para acceder a sus funcionalidades.')
    .addAnswer('Opciones disponibles:')
    .addAnswer('🔐 *login* - Iniciar sesión')
    .addAnswer('📝 *registro* - Crear nueva cuenta')
    .addAnswer('❓ *ayuda* - Ver ayuda')
    .addAnswer('¿Qué deseas hacer?', { capture: true }, async (ctx, { flowDynamic, gotoFlow }) => {
        const response = ctx.body.toLowerCase()
        
        if (response.includes('login') || response.includes('iniciar')) {
            return gotoFlow(loginFlow)
        } else if (response.includes('registro') || response.includes('crear')) {
            return gotoFlow(registerFlow)
        } else if (response.includes('ayuda') || response.includes('help')) {
            return gotoFlow(helpFlow)
        } else {
            await flowDynamic('❌ Opción no reconocida. Usa *login*, *registro* o *ayuda*.')
            return gotoFlow(welcomeFlow)
        }
    })

// Flujo de menú principal protegido
const protectedMainMenuFlow = addKeyword<Provider, Database>(['menu', 'inicio', 'principal'])
    .addAction(async (ctx, methods) => {
        const { state, flowDynamic, gotoFlow } = methods
        
        // Verificar autenticación
        if (!AuthMiddleware.isAuthenticated(state)) {
            await flowDynamic('🔐 *Acceso restringido*')
            await flowDynamic('Necesitas iniciar sesión para acceder al menú principal.')
            await flowDynamic('¿Deseas iniciar sesión? Responde *si* para continuar.')
            return gotoFlow(loginFlow)
        }
        
        // Usuario autenticado, mostrar menú
        const authState = AuthMiddleware.getAuthState(state)
        await flowDynamic(`👋 Hola *${authState?.username}*`)
        return gotoFlow(mainMenuFlow)
    })

// Flujo de perfil protegido
const protectedProfileFlow = addKeyword<Provider, Database>(['perfil', 'profile', 'mi cuenta'])
    .addAction(async (ctx, methods) => {
        const { state, flowDynamic, gotoFlow } = methods
        
        // Verificar autenticación
        if (!AuthMiddleware.isAuthenticated(state)) {
            await flowDynamic('🔐 *Acceso restringido*')
            await flowDynamic('Necesitas iniciar sesión para ver tu perfil.')
            return gotoFlow(loginFlow)
        }
        
        return gotoFlow(profileFlow)
    })

// Flujo de logout
const logoutFlow = addKeyword<Provider, Database>(['logout', 'cerrar sesion', 'salir'])
    .addAction(async (ctx, methods) => {
        const { state, flowDynamic, gotoFlow, endFlow } = methods
        
        if (AuthMiddleware.isAuthenticated(state)) {
            const authState = AuthMiddleware.getAuthState(state)
            await flowDynamic(`👋 *Cerrando sesión...*`)
            await flowDynamic(`¡Hasta luego, *${authState?.username}*!`)
            
            // Limpiar estado de autenticación
            await AuthMiddleware.clearAuthState(state)
            
            await flowDynamic('Sesión cerrada exitosamente.')
            return gotoFlow(welcomeFlow)
        } else {
            await flowDynamic('❌ No tienes una sesión activa.')
            return gotoFlow(welcomeFlow)
        }
    })

// Flujo de estado de autenticación
const authStatusFlow = addKeyword<Provider, Database>(['estado', 'status', 'sesion'])
    .addAction(async (ctx, methods) => {
        const { state, flowDynamic, gotoFlow } = methods
        
        if (AuthMiddleware.isAuthenticated(state)) {
            const authState = AuthMiddleware.getAuthState(state)
            await flowDynamic('✅ *Sesión activa*')
            await flowDynamic(`👤 Usuario: *${authState?.username}*`)
            await flowDynamic(`🆔 ID: *${authState?.userId}*`)
            await flowDynamic(`📧 Email: *${authState?.email}*`)
            await flowDynamic('¿Deseas ir al menú principal?', { capture: true }, async (ctx, { flowDynamic, gotoFlow }) => {
                if (ctx.body.toLowerCase().includes('si') || ctx.body.toLowerCase().includes('yes')) {
                    return gotoFlow(mainMenuFlow)
                }
                await flowDynamic('👋 ¡Hasta luego!')
            })
        } else {
            await flowDynamic('❌ *No hay sesión activa*')
            await flowDynamic('Inicia sesión para acceder a las funcionalidades del bot.')
            await flowDynamic('¿Deseas iniciar sesión?', { capture: true }, async (ctx, { flowDynamic, gotoFlow }) => {
                if (ctx.body.toLowerCase().includes('si') || ctx.body.toLowerCase().includes('yes')) {
                    return gotoFlow(loginFlow)
                }
                await flowDynamic('👋 ¡Hasta luego!')
            })
        }
    })

// Función principal
const main = async () => {
    try {
        // Crear flujo principal con todos los flujos
        const adapterFlow = createFlow([
            welcomeFlow,
            loginFlow,
            registerFlow,
            retryLoginFlow,
            cancelLoginFlow,
            protectedMainMenuFlow,
            protectedProfileFlow,
            mainMenuFlow,
            profileFlow,
            profileActionsFlow,
            settingsFlow,
            helpFlow,
            logoutFlow,
            authStatusFlow
        ])

        // Configurar provider
        const adapterProvider = createProvider(Provider, {
            apiKey: process.env.EVOLUTION_API_KEY || '1234567890',
            baseURL: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
            instanceName: process.env.INSTANCE_NAME || 'auth-bot',
        })

        // Configurar base de datos
        const adapterDB = new Database({
            host: process.env.MYSQL_DB_HOST || 'localhost',
            user: process.env.MYSQL_DB_USER || 'root',
            database: process.env.MYSQL_DB_NAME || 'builderbot_auth',
            password: process.env.MYSQL_DB_PASSWORD || '',
            port: parseInt(process.env.MYSQL_DB_PORT || '3306')
        })

        // Crear bot
        const { handleCtx, httpServer } = await createBot({
            flow: adapterFlow,
            provider: adapterProvider,
            database: adapterDB,
        })

        // Configurar rutas de API
        setupApiRoutes(adapterProvider, handleCtx)

        // Iniciar servidor
        httpServer(+PORT)
        console.log(`🚀 Bot con autenticación iniciado en puerto ${PORT}`)
        console.log(`📱 Escanea el QR para conectar WhatsApp`)
        console.log(`🔐 Usuarios de prueba:`)
        console.log(`   - admin / admin123`)
        console.log(`   - usuario / password123`)
        console.log(`   - test / test123 (inactivo)`)

    } catch (error) {
        console.error('❌ Error al iniciar el bot:', error)
        process.exit(1)
    }
}

// Configurar rutas de API
function setupApiRoutes(provider: any, handleCtx: any) {
    // Ruta para enviar mensajes
    provider.server.post(
        '/v1/messages',
        handleCtx(async (bot, req, res) => {
            try {
                const { number, message, urlMedia } = req.body
                
                if (!number || !message) {
                    res.writeHead(400, { 'Content-Type': 'application/json' })
                    return res.end(JSON.stringify({ error: 'Número y mensaje son requeridos' }))
                }
                
                await bot.sendMessage(number, message, { media: urlMedia ?? null })
                
                res.writeHead(200, { 'Content-Type': 'application/json' })
                return res.end(JSON.stringify({ 
                    success: true, 
                    message: 'Mensaje enviado exitosamente' 
                }))
                
            } catch (error) {
                console.error('Error enviando mensaje:', error)
                res.writeHead(500, { 'Content-Type': 'application/json' })
                return res.end(JSON.stringify({ 
                    error: 'Error interno del servidor' 
                }))
            }
        })
    )

    // Ruta para verificar estado de autenticación
    provider.server.get(
        '/v1/auth/status',
        handleCtx(async (bot, req, res) => {
            try {
                const { number } = req.query
                
                if (!number) {
                    res.writeHead(400, { 'Content-Type': 'application/json' })
                    return res.end(JSON.stringify({ error: 'Número es requerido' }))
                }
                
                // Obtener estado del usuario desde la base de datos
                const userState = await bot.database.getPrevByNumber(number as string)
                const isAuthenticated = userState?.isAuthenticated || false
                
                res.writeHead(200, { 'Content-Type': 'application/json' })
                return res.end(JSON.stringify({ 
                    isAuthenticated,
                    user: isAuthenticated ? {
                        username: userState?.username,
                        email: userState?.email
                    } : null
                }))
                
            } catch (error) {
                console.error('Error verificando estado:', error)
                res.writeHead(500, { 'Content-Type': 'application/json' })
                return res.end(JSON.stringify({ 
                    error: 'Error interno del servidor' 
                }))
            }
        })
    )

    // Ruta para cerrar sesión
    provider.server.post(
        '/v1/auth/logout',
        handleCtx(async (bot, req, res) => {
            try {
                const { number } = req.body
                
                if (!number) {
                    res.writeHead(400, { 'Content-Type': 'application/json' })
                    return res.end(JSON.stringify({ error: 'Número es requerido' }))
                }
                
                // Limpiar estado de autenticación
                await bot.database.save({
                    from: number,
                    body: '',
                    ref: 'LOGOUT',
                    refSerialize: 'LOGOUT',
                    isAuthenticated: false,
                    username: null,
                    email: null,
                    userId: null
                })
                
                res.writeHead(200, { 'Content-Type': 'application/json' })
                return res.end(JSON.stringify({ 
                    success: true,
                    message: 'Sesión cerrada exitosamente'
                }))
                
            } catch (error) {
                console.error('Error cerrando sesión:', error)
                res.writeHead(500, { 'Content-Type': 'application/json' })
                return res.end(JSON.stringify({ 
                    error: 'Error interno del servidor' 
                }))
            }
        })
    )

    // Ruta de salud del servidor
    provider.server.get(
        '/health',
        (req, res) => {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ 
                status: 'OK',
                timestamp: new Date().toISOString(),
                service: 'BuilderBot Auth Service'
            }))
        }
    )
}

// Manejar errores no capturados
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error)
    process.exit(1)
})

// Iniciar la aplicación
if (require.main === module) {
    main()
}

export { main }
