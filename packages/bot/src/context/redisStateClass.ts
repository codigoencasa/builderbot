import Redis from 'ioredis'

type Context = {
    from: string
}

type StateValue = Record<string, any>

class RedisState {
    private readonly client: Redis
    private readonly PREFIX = null

    constructor(_client: Redis, options: { prefix: string | null }) {
        //Se requiere una instancia de redis ya que si se usa el database-redis se puede reutilizar la misma conexion a redis enviandola desde el main
        this.client = _client
        if (options.prefix) this.PREFIX = options.prefix
    }

    getKey = (ctx: Context) => `bot_state:${this.PREFIX ? this.PREFIX + ':' : ''}${ctx.from}`

    /**
     * Actualiza el estado en Redis (Merge de objetos)
     */
    updateState = (ctx: Context): ((keyValue: StateValue) => Promise<void>) => {
        return async (keyValue: StateValue) => {
            const key = this.getKey(ctx)
            const currentData = await this.client.get(key)
            const currentState = currentData ? JSON.parse(currentData) : {}

            const updatedState = { ...currentState, ...keyValue }
            // Guardamos con un TTL opcional (ej. 24h) para no llenar el Redis para siempre
            await this.client.set(key, JSON.stringify(updatedState), 'EX', 60 * 60 * 24)
        }
    }

    /**
     * Obtiene el estado completo
     */
    getMyState = (from: string): (() => Promise<StateValue | undefined>) => {
        return async () => {
            const key = this.getKey({ from })
            const data = await this.client.get(key)
            return data ? JSON.parse(data) : undefined
        }
    }

    /**
     * Obtiene una propiedad específica (soporta punto como 'user.name')
     */
    get = (from: string): ((prop: string) => Promise<any>) => {
        return async (prop: string) => {
            const key = this.getKey({ from })
            const data = await this.client.get(key)
            if (!data) return undefined

            const state = JSON.parse(data)
            const properties = prop.split('.')
            let result = state

            for (const property of properties) {
                result = result?.[property]
                if (result === undefined) return undefined
            }

            return result
        }
    }

    /**
     * Borra el estado de un usuario
     */
    clear = (from: string): (() => Promise<number>) => {
        const key = this.getKey({ from })
        return () => this.client.del(key)
    }

    /**
     * Borra todos los estados que empiecen con el prefijo
     */
    clearAll = async (): Promise<void> => {
        const keys = await this.client.keys('bot_state*')
        if (keys.length > 0) {
            await this.client.del(...keys)
        }
    }
}

export { RedisState }
