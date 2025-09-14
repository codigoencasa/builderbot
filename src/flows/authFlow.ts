import { addKeyword, utils } from '@builderbot/bot'
import { AuthService } from '../services/authService'
import { LoginCredentials } from '../types/auth'

// Flujo de inicio de sesión
export const loginFlow = addKeyword(['login', 'iniciar sesion', 'entrar', 'auth'])
    .addAnswer('🔐 *Sistema de Inicio de Sesión*')
    .addAnswer('Por favor, ingresa tu nombre de usuario:', { capture: true }, async (ctx, { state }) => {
        const username = ctx.body.trim()
        
        // Validar formato básico
        if (username.length < 3) {
            await state.update({ loginError: 'El nombre de usuario debe tener al menos 3 caracteres' })
            return
        }
        
        await state.update({ 
            tempUsername: username,
            loginError: null 
        })
    })
    .addAnswer('Ahora ingresa tu contraseña:', { capture: true }, async (ctx, { state, flowDynamic, gotoFlow, endFlow }) => {
        const username = state.get('tempUsername')
        const password = ctx.body
        
        // Verificar si hay error previo
        const loginError = state.get('loginError')
        if (loginError) {
            await flowDynamic(`❌ ${loginError}`)
            await state.clear()
            return gotoFlow(loginFlow)
        }
        
        // Validar formato de contraseña
        if (password.length < 6) {
            await flowDynamic('❌ La contraseña debe tener al menos 6 caracteres')
            await state.clear()
            return gotoFlow(loginFlow)
        }
        
        try {
            // Mostrar indicador de carga
            await flowDynamic('⏳ Verificando credenciales...')
            
            // Crear credenciales
            const credentials: LoginCredentials = { username, password }
            
            // Buscar usuario en la base de datos
            const user = await AuthService.findUserByUsername(username)
            
            // Validar credenciales
            const authResult = await AuthService.validateCredentials(credentials, user)
            
            if (authResult.success && authResult.user) {
                // Autenticación exitosa
                await state.update({
                    isAuthenticated: true,
                    userId: authResult.user.id,
                    username: authResult.user.username,
                    email: authResult.user.email,
                    loginAttempts: 0,
                    lastLoginAttempt: new Date(),
                    tempUsername: null,
                    loginError: null
                })
                
                await flowDynamic('✅ *¡Inicio de sesión exitoso!*')
                await flowDynamic(`👋 Bienvenido, *${authResult.user.username}*`)
                await flowDynamic('Ahora puedes acceder a todas las funcionalidades del bot.')
                
                // Redirigir al menú principal
                return gotoFlow(mainMenuFlow)
                
            } else {
                // Autenticación fallida
                const currentAttempts = state.get('loginAttempts') || 0
                const newAttempts = currentAttempts + 1
                
                await state.update({
                    loginAttempts: newAttempts,
                    lastLoginAttempt: new Date(),
                    tempUsername: null,
                    loginError: authResult.message
                })
                
                if (newAttempts >= 3) {
                    await flowDynamic('🚫 *Demasiados intentos fallidos*')
                    await flowDynamic('Tu cuenta ha sido bloqueada temporalmente por seguridad.')
                    await flowDynamic('Intenta nuevamente en 15 minutos.')
                    await state.clear()
                    return endFlow('Cuenta bloqueada temporalmente')
                }
                
                await flowDynamic(`❌ *${authResult.message}*`)
                await flowDynamic(`⚠️ Intentos restantes: ${3 - newAttempts}`)
                await flowDynamic('¿Deseas intentar nuevamente? Responde *si* para continuar o *no* para salir.')
                
                return gotoFlow(retryLoginFlow)
            }
            
        } catch (error) {
            console.error('Error en autenticación:', error)
            await flowDynamic('❌ *Error interno del servidor*')
            await flowDynamic('Por favor, intenta nuevamente más tarde.')
            await state.clear()
            return endFlow('Error interno')
        }
    })

// Flujo para reintentar login
export const retryLoginFlow = addKeyword(['si', 'yes', 'continuar', 'retry'])
    .addAnswer('🔄 Reintentando inicio de sesión...')
    .addAnswer('Ingresa tu nombre de usuario nuevamente:', { capture: true }, async (ctx, { state }) => {
        const username = ctx.body.trim()
        await state.update({ tempUsername: username })
    })
    .addAnswer('Ingresa tu contraseña:', { capture: true }, async (ctx, { state, flowDynamic, gotoFlow, endFlow }) => {
        const username = state.get('tempUsername')
        const password = ctx.body
        
        try {
            await flowDynamic('⏳ Verificando credenciales...')
            
            const credentials: LoginCredentials = { username, password }
            const user = await AuthService.findUserByUsername(username)
            const authResult = await AuthService.validateCredentials(credentials, user)
            
            if (authResult.success && authResult.user) {
                await state.update({
                    isAuthenticated: true,
                    userId: authResult.user.id,
                    username: authResult.user.username,
                    email: authResult.user.email,
                    loginAttempts: 0,
                    lastLoginAttempt: new Date(),
                    tempUsername: null,
                    loginError: null
                })
                
                await flowDynamic('✅ *¡Inicio de sesión exitoso!*')
                await flowDynamic(`👋 Bienvenido, *${authResult.user.username}*`)
                return gotoFlow(mainMenuFlow)
                
            } else {
                const currentAttempts = state.get('loginAttempts') || 0
                const newAttempts = currentAttempts + 1
                
                await state.update({
                    loginAttempts: newAttempts,
                    lastLoginAttempt: new Date(),
                    tempUsername: null,
                    loginError: authResult.message
                })
                
                if (newAttempts >= 3) {
                    await flowDynamic('🚫 *Demasiados intentos fallidos*')
                    await flowDynamic('Tu cuenta ha sido bloqueada temporalmente.')
                    await state.clear()
                    return endFlow('Cuenta bloqueada')
                }
                
                await flowDynamic(`❌ *${authResult.message}*`)
                await flowDynamic(`⚠️ Intentos restantes: ${3 - newAttempts}`)
                return gotoFlow(retryLoginFlow)
            }
            
        } catch (error) {
            console.error('Error en reintento de autenticación:', error)
            await flowDynamic('❌ *Error interno del servidor*')
            await state.clear()
            return endFlow('Error interno')
        }
    })

// Flujo para cancelar login
export const cancelLoginFlow = addKeyword(['no', 'cancelar', 'salir', 'exit'])
    .addAnswer('👋 *Inicio de sesión cancelado*')
    .addAnswer('Gracias por usar nuestro servicio. ¡Hasta luego!')
    .addAction(async (_, { state }) => {
        await state.clear()
    })

// Flujo de registro de usuario
export const registerFlow = addKeyword(['registro', 'register', 'crear cuenta', 'signup'])
    .addAnswer('📝 *Registro de Nuevo Usuario*')
    .addAnswer('Ingresa tu nombre de usuario:', { capture: true }, async (ctx, { state }) => {
        const username = ctx.body.trim()
        await state.update({ tempUsername: username })
    })
    .addAnswer('Ingresa tu email:', { capture: true }, async (ctx, { state }) => {
        const email = ctx.body.trim()
        await state.update({ tempEmail: email })
    })
    .addAnswer('Crea una contraseña (mínimo 6 caracteres):', { capture: true }, async (ctx, { state, flowDynamic, gotoFlow, endFlow }) => {
        const username = state.get('tempUsername')
        const email = state.get('tempEmail')
        const password = ctx.body
        
        try {
            await flowDynamic('⏳ Creando cuenta...')
            
            const registerResult = await AuthService.registerUser({
                username,
                email,
                password,
                isActive: true
            })
            
            if (registerResult.success) {
                await flowDynamic('✅ *¡Cuenta creada exitosamente!*')
                await flowDynamic(`👤 Usuario: *${username}*`)
                await flowDynamic(`📧 Email: *${email}*`)
                await flowDynamic('Ahora puedes iniciar sesión con tus credenciales.')
                
                await state.clear()
                return gotoFlow(loginFlow)
                
            } else {
                await flowDynamic(`❌ *${registerResult.message}*`)
                await flowDynamic('Intenta con otros datos o contacta al soporte.')
                await state.clear()
                return endFlow('Error en registro')
            }
            
        } catch (error) {
            console.error('Error en registro:', error)
            await flowDynamic('❌ *Error interno del servidor*')
            await state.clear()
            return endFlow('Error interno')
        }
    })

// Flujo de menú principal (requiere autenticación)
export const mainMenuFlow = addKeyword(['menu', 'inicio', 'principal', 'home'])
    .addAnswer('🏠 *Menú Principal*')
    .addAnswer('Selecciona una opción:')
    .addAnswer('1️⃣ Ver perfil\n2️⃣ Configuración\n3️⃣ Cerrar sesión\n4️⃣ Ayuda', { capture: true }, 
        async (ctx, { state, flowDynamic, gotoFlow, endFlow }) => {
            const option = ctx.body.trim()
            
            switch (option) {
                case '1':
                case 'perfil':
                    return gotoFlow(profileFlow)
                    
                case '2':
                case 'configuracion':
                    return gotoFlow(settingsFlow)
                    
                case '3':
                case 'cerrar sesion':
                case 'logout':
                    await flowDynamic('👋 *Cerrando sesión...*')
                    await state.clear()
                    await flowDynamic('¡Hasta luego! Gracias por usar nuestro servicio.')
                    return endFlow('Sesión cerrada')
                    
                case '4':
                case 'ayuda':
                    return gotoFlow(helpFlow)
                    
                default:
                    await flowDynamic('❌ Opción inválida. Por favor, selecciona una opción válida.')
                    return gotoFlow(mainMenuFlow)
            }
        }
    )

// Flujo de perfil de usuario
export const profileFlow = addKeyword(['perfil', 'profile', 'mi cuenta'])
    .addAnswer('👤 *Tu Perfil*')
    .addAction(async (ctx, { state, flowDynamic, gotoFlow }) => {
        const username = state.get('username')
        const email = state.get('email')
        const userId = state.get('userId')
        
        if (!username) {
            await flowDynamic('❌ No estás autenticado. Inicia sesión primero.')
            return gotoFlow(loginFlow)
        }
        
        await flowDynamic(`👤 *Usuario:* ${username}`)
        await flowDynamic(`🆔 *ID:* ${userId}`)
        await flowDynamic(`📧 *Email:* ${email}`)
        await flowDynamic('¿Qué deseas hacer?')
        await flowDynamic('1️⃣ Volver al menú\n2️⃣ Editar perfil\n3️⃣ Cerrar sesión')
        
        return gotoFlow(profileActionsFlow)
    })

// Flujo de acciones del perfil
export const profileActionsFlow = addKeyword(['1', '2', '3', 'volver', 'editar', 'cerrar'])
    .addAnswer('', { capture: true }, async (ctx, { state, flowDynamic, gotoFlow, endFlow }) => {
        const option = ctx.body.trim()
        
        switch (option) {
            case '1':
            case 'volver':
                return gotoFlow(mainMenuFlow)
                
            case '2':
            case 'editar':
                await flowDynamic('🔧 *Funcionalidad de edición en desarrollo*')
                return gotoFlow(profileFlow)
                
            case '3':
            case 'cerrar':
                await flowDynamic('👋 *Cerrando sesión...*')
                await state.clear()
                await flowDynamic('¡Hasta luego!')
                return endFlow('Sesión cerrada')
                
            default:
                await flowDynamic('❌ Opción inválida.')
                return gotoFlow(profileFlow)
        }
    })

// Flujo de configuración
export const settingsFlow = addKeyword(['configuracion', 'settings', 'ajustes'])
    .addAnswer('⚙️ *Configuración*')
    .addAnswer('Funcionalidad en desarrollo...')
    .addAnswer('¿Deseas volver al menú principal?', { capture: true }, async (ctx, { flowDynamic, gotoFlow }) => {
        if (ctx.body.toLowerCase().includes('si') || ctx.body.toLowerCase().includes('yes')) {
            return gotoFlow(mainMenuFlow)
        }
        await flowDynamic('👋 ¡Hasta luego!')
    })

// Flujo de ayuda
export const helpFlow = addKeyword(['ayuda', 'help', 'soporte'])
    .addAnswer('❓ *Centro de Ayuda*')
    .addAnswer('Comandos disponibles:')
    .addAnswer('• *login* - Iniciar sesión')
    .addAnswer('• *registro* - Crear nueva cuenta')
    .addAnswer('• *menu* - Menú principal')
    .addAnswer('• *perfil* - Ver tu perfil')
    .addAnswer('• *ayuda* - Mostrar esta ayuda')
    .addAnswer('¿Necesitas más ayuda? Contacta al soporte técnico.')
    .addAnswer('¿Deseas volver al menú?', { capture: true }, async (ctx, { flowDynamic, gotoFlow }) => {
        if (ctx.body.toLowerCase().includes('si') || ctx.body.toLowerCase().includes('yes')) {
            return gotoFlow(mainMenuFlow)
        }
        await flowDynamic('👋 ¡Hasta luego!')
    })
