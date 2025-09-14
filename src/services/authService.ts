import bcrypt from 'bcrypt'
import { User, LoginCredentials, AuthResult } from '../types/auth'

export class AuthService {
    private static readonly SALT_ROUNDS = 12
    private static readonly MAX_LOGIN_ATTEMPTS = 3
    private static readonly LOCKOUT_TIME = 15 * 60 * 1000 // 15 minutos

    /**
     * Encripta una contraseña usando bcrypt
     * @param password - Contraseña en texto plano
     * @returns Promise<string> - Contraseña encriptada
     */
    static async hashPassword(password: string): Promise<string> {
        try {
            return await bcrypt.hash(password, this.SALT_ROUNDS)
        } catch (error) {
            throw new Error('Error al encriptar la contraseña')
        }
    }

    /**
     * Verifica si una contraseña coincide con el hash
     * @param password - Contraseña en texto plano
     * @param hashedPassword - Contraseña encriptada
     * @returns Promise<boolean> - true si coinciden
     */
    static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
        try {
            return await bcrypt.compare(password, hashedPassword)
        } catch (error) {
            throw new Error('Error al verificar la contraseña')
        }
    }

    /**
     * Valida las credenciales de inicio de sesión
     * @param credentials - Credenciales del usuario
     * @param user - Usuario de la base de datos
     * @returns Promise<AuthResult> - Resultado de la autenticación
     */
    static async validateCredentials(
        credentials: LoginCredentials, 
        user: User | null
    ): Promise<AuthResult> {
        // Verificar si el usuario existe
        if (!user) {
            return {
                success: false,
                message: 'Usuario no encontrado'
            }
        }

        // Verificar si el usuario está activo
        if (!user.isActive) {
            return {
                success: false,
                message: 'Cuenta desactivada. Contacta al administrador'
            }
        }

        // Verificar la contraseña
        const isPasswordValid = await this.verifyPassword(credentials.password, user.password)
        
        if (!isPasswordValid) {
            return {
                success: false,
                message: 'Contraseña incorrecta'
            }
        }

        // Autenticación exitosa
        return {
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                isActive: user.isActive
            },
            message: 'Autenticación exitosa'
        }
    }

    /**
     * Valida el formato de las credenciales
     * @param credentials - Credenciales a validar
     * @returns { valid: boolean, message: string }
     */
    static validateCredentialsFormat(credentials: LoginCredentials): { valid: boolean, message: string } {
        const { username, password } = credentials

        if (!username || username.trim().length === 0) {
            return { valid: false, message: 'El nombre de usuario es requerido' }
        }

        if (!password || password.length === 0) {
            return { valid: false, message: 'La contraseña es requerida' }
        }

        if (username.length < 3) {
            return { valid: false, message: 'El nombre de usuario debe tener al menos 3 caracteres' }
        }

        if (password.length < 6) {
            return { valid: false, message: 'La contraseña debe tener al menos 6 caracteres' }
        }

        if (username.length > 50) {
            return { valid: false, message: 'El nombre de usuario no puede exceder 50 caracteres' }
        }

        if (password.length > 100) {
            return { valid: false, message: 'La contraseña no puede exceder 100 caracteres' }
        }

        return { valid: true, message: 'Credenciales válidas' }
    }

    /**
     * Simula la búsqueda de usuario en la base de datos
     * En una implementación real, esto se conectaría a tu base de datos
     * @param username - Nombre de usuario
     * @returns Promise<User | null>
     */
    static async findUserByUsername(username: string): Promise<User | null> {
        // TODO: Implementar búsqueda real en la base de datos
        // Por ahora, simulamos algunos usuarios de prueba
        
        const mockUsers: User[] = [
            {
                id: '1',
                username: 'admin',
                email: 'admin@example.com',
                password: await this.hashPassword('admin123'),
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: '2',
                username: 'usuario',
                email: 'usuario@example.com',
                password: await this.hashPassword('password123'),
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: '3',
                username: 'test',
                email: 'test@example.com',
                password: await this.hashPassword('test123'),
                isActive: false, // Usuario inactivo para pruebas
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ]

        return mockUsers.find(user => user.username.toLowerCase() === username.toLowerCase()) || null
    }

    /**
     * Registra un nuevo usuario
     * @param userData - Datos del usuario
     * @returns Promise<AuthResult>
     */
    static async registerUser(userData: Omit<User, 'id' | 'password' | 'createdAt' | 'updatedAt'> & { password: string }): Promise<AuthResult> {
        try {
            // Validar que el usuario no exista
            const existingUser = await this.findUserByUsername(userData.username)
            if (existingUser) {
                return {
                    success: false,
                    message: 'El nombre de usuario ya está en uso'
                }
            }

            // Validar formato de credenciales
            const validation = this.validateCredentialsFormat({
                username: userData.username,
                password: userData.password
            })

            if (!validation.valid) {
                return {
                    success: false,
                    message: validation.message
                }
            }

            // Encriptar contraseña
            const hashedPassword = await this.hashPassword(userData.password)

            // Crear usuario (en implementación real, guardar en BD)
            const newUser: User = {
                id: Date.now().toString(), // ID temporal
                username: userData.username,
                email: userData.email,
                password: hashedPassword,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            }

            // TODO: Guardar en base de datos real
            console.log('Usuario registrado:', { ...newUser, password: '[ENCRYPTED]' })

            return {
                success: true,
                user: {
                    id: newUser.id,
                    username: newUser.username,
                    email: newUser.email,
                    isActive: newUser.isActive
                },
                message: 'Usuario registrado exitosamente'
            }

        } catch (error) {
            return {
                success: false,
                message: 'Error interno del servidor'
            }
        }
    }
}
