import { AuthState } from '../types/auth'

export class AuthMiddleware {
    /**
     * Verifica si el usuario está autenticado
     * @param state - Estado del bot
     * @returns boolean - true si está autenticado
     */
    static isAuthenticated(state: any): boolean {
        const authState: AuthState = {
            isAuthenticated: state.get('isAuthenticated') || false,
            userId: state.get('userId'),
            username: state.get('username'),
            loginAttempts: state.get('loginAttempts') || 0,
            lastLoginAttempt: state.get('lastLoginAttempt')
        }
        
        return authState.isAuthenticated && !!authState.userId
    }

    /**
     * Obtiene la información del usuario autenticado
     * @param state - Estado del bot
     * @returns AuthState | null
     */
    static getAuthState(state: any): AuthState | null {
        if (!this.isAuthenticated(state)) {
            return null
        }

        return {
            isAuthenticated: true,
            userId: state.get('userId'),
            username: state.get('username'),
            email: state.get('email'),
            loginAttempts: state.get('loginAttempts') || 0,
            lastLoginAttempt: state.get('lastLoginAttempt')
        }
    }

    /**
     * Middleware para verificar autenticación en flujos
     * @param ctx - Contexto del mensaje
     * @param methods - Métodos del bot
     * @returns Promise<boolean> - true si está autenticado
     */
    static async requireAuth(ctx: any, methods: any): Promise<boolean> {
        const { state, flowDynamic, gotoFlow } = methods
        
        if (!this.isAuthenticated(state)) {
            await flowDynamic('🔐 *Acceso restringido*')
            await flowDynamic('Necesitas iniciar sesión para acceder a esta funcionalidad.')
            await flowDynamic('¿Deseas iniciar sesión ahora? Responde *si* para continuar.')
            
            // Redirigir al flujo de login
            setTimeout(() => {
                gotoFlow(loginFlow)
            }, 1000)
            
            return false
        }
        
        return true
    }

    /**
     * Middleware para verificar si el usuario NO está autenticado
     * @param ctx - Contexto del mensaje
     * @param methods - Métodos del bot
     * @returns Promise<boolean> - true si NO está autenticado
     */
    static async requireGuest(ctx: any, methods: any): Promise<boolean> {
        const { state, flowDynamic, gotoFlow } = methods
        
        if (this.isAuthenticated(state)) {
            const authState = this.getAuthState(state)
            await flowDynamic(`👋 Hola *${authState?.username}*`)
            await flowDynamic('Ya tienes una sesión activa.')
            await flowDynamic('¿Deseas cerrar sesión primero?')
            
            // Redirigir al menú principal
            setTimeout(() => {
                gotoFlow(mainMenuFlow)
            }, 1000)
            
            return false
        }
        
        return true
    }

    /**
     * Verifica si el usuario ha excedido el límite de intentos de login
     * @param state - Estado del bot
     * @returns boolean - true si ha excedido el límite
     */
    static hasExceededLoginAttempts(state: any): boolean {
        const loginAttempts = state.get('loginAttempts') || 0
        const lastLoginAttempt = state.get('lastLoginAttempt')
        
        if (loginAttempts >= 3) {
            if (lastLoginAttempt) {
                const timeSinceLastAttempt = Date.now() - new Date(lastLoginAttempt).getTime()
                const lockoutTime = 15 * 60 * 1000 // 15 minutos
                
                if (timeSinceLastAttempt < lockoutTime) {
                    return true
                } else {
                    // Resetear intentos después del tiempo de bloqueo
                    state.update({ loginAttempts: 0, lastLoginAttempt: null })
                    return false
                }
            }
            return true
        }
        
        return false
    }

    /**
     * Limpia el estado de autenticación
     * @param state - Estado del bot
     */
    static async clearAuthState(state: any): Promise<void> {
        await state.update({
            isAuthenticated: false,
            userId: null,
            username: null,
            email: null,
            loginAttempts: 0,
            lastLoginAttempt: null,
            tempUsername: null,
            tempEmail: null,
            loginError: null
        })
    }

    /**
     * Actualiza el estado de autenticación después de un login exitoso
     * @param state - Estado del bot
     * @param user - Datos del usuario
     */
    static async updateAuthState(state: any, user: any): Promise<void> {
        await state.update({
            isAuthenticated: true,
            userId: user.id,
            username: user.username,
            email: user.email,
            loginAttempts: 0,
            lastLoginAttempt: new Date(),
            tempUsername: null,
            tempEmail: null,
            loginError: null
        })
    }

    /**
     * Registra un intento de login fallido
     * @param state - Estado del bot
     */
    static async recordFailedLoginAttempt(state: any): Promise<void> {
        const currentAttempts = state.get('loginAttempts') || 0
        await state.update({
            loginAttempts: currentAttempts + 1,
            lastLoginAttempt: new Date()
        })
    }

    /**
     * Obtiene el tiempo restante de bloqueo
     * @param state - Estado del bot
     * @returns number - Tiempo restante en milisegundos
     */
    static getRemainingLockoutTime(state: any): number {
        const lastLoginAttempt = state.get('lastLoginAttempt')
        if (!lastLoginAttempt) return 0
        
        const timeSinceLastAttempt = Date.now() - new Date(lastLoginAttempt).getTime()
        const lockoutTime = 15 * 60 * 1000 // 15 minutos
        
        return Math.max(0, lockoutTime - timeSinceLastAttempt)
    }

    /**
     * Formatea el tiempo de bloqueo en un mensaje legible
     * @param state - Estado del bot
     * @returns string - Mensaje formateado
     */
    static getLockoutMessage(state: any): string {
        const remainingTime = this.getRemainingLockoutTime(state)
        
        if (remainingTime <= 0) {
            return 'Puedes intentar iniciar sesión nuevamente.'
        }
        
        const minutes = Math.ceil(remainingTime / (60 * 1000))
        return `Tu cuenta estará bloqueada por ${minutes} minutos más.`
    }
}

// Importar los flujos necesarios (estos se definirán en el archivo principal)
declare const loginFlow: any
declare const mainMenuFlow: any
