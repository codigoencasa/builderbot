export interface User {
    id: string
    username: string
    email: string
    password: string
    isActive: boolean
    createdAt: Date
    updatedAt: Date
}

export interface LoginCredentials {
    username: string
    password: string
}

export interface AuthResult {
    success: boolean
    user?: Partial<User>
    message: string
    token?: string
}

export interface AuthState {
    isAuthenticated: boolean
    userId?: string
    username?: string
    loginAttempts?: number
    lastLoginAttempt?: Date
}
