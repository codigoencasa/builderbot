import Redis from 'ioredis'

type Context = {
    from: string
}

type StateValue = Record<string, any>

type RedisStateOptions = {
    prefix?: string | null
    /** TTL en segundos del estado de cada usuario. `null` o `0` = sin expiración. Por defecto 24h. */
    expire?: number | null
}

const DEFAULT_EXPIRE = 60 * 60 * 24
const SCAN_COUNT = 100

class RedisState {
    private readonly client: Redis
    private readonly PREFIX: string | null = null
    private readonly EXPIRE: number | null = DEFAULT_EXPIRE

    constructor(_client: Redis, options: RedisStateOptions = {}) {
        //Se requiere una instancia de redis ya que si se usa el database-redis se puede reutilizar la misma conexion a redis enviandola desde el main
        this.client = _client
        if (options.prefix) this.PREFIX = options.prefix
        if (options.expire !== undefined) this.EXPIRE = options.expire && options.expire > 0 ? options.expire : null
    }

    private get keyBase(): string {
        return `bot:state:${this.PREFIX ? this.PREFIX + ':' : ''}`
    }

    getKey = (ctx: Context) => `${this.keyBase}${ctx.from}`

    private parse = (raw: string | null): any => (raw === null ? undefined : JSON.parse(raw))

    /**
     * Actualiza el estado en Redis (merge de propiedades de primer nivel, atómico)
     */
    updateState = (ctx: Context): ((keyValue: StateValue) => Promise<void>) => {
        return async (keyValue: StateValue) => {
            const entries = Object.entries(keyValue)
            if (!entries.length) return

            const key = this.getKey(ctx)
            const fields: Record<string, string> = {}
            for (const [field, value] of entries) fields[field] = JSON.stringify(value)

            const tx = this.client.multi().hset(key, fields)
            // TTL configurable (por defecto 24h) para no llenar el Redis para siempre
            if (this.EXPIRE) tx.expire(key, this.EXPIRE)
            await tx.exec()
        }
    }

    /**
     * Obtiene el estado completo
     */
    getMyState = (from: string): (() => Promise<StateValue | undefined>) => {
        return async () => {
            const data = await this.client.hgetall(this.getKey({ from }))
            const fields = Object.keys(data)
            if (!fields.length) return undefined

            const state: StateValue = {}
            for (const field of fields) state[field] = this.parse(data[field])
            return state
        }
    }

    /**
     * Obtiene una propiedad específica (soporta punto como 'user.name')
     */
    get = (from: string): ((prop: string) => Promise<any>) => {
        return async (prop: string) => {
            const [field, ...path] = prop.split('.')
            let result = this.parse(await this.client.hget(this.getKey({ from }), field))

            for (const property of path) {
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
     * Borra todos los estados de este bot (solo los de su prefijo).
     * Usa SCAN en lugar de KEYS para no bloquear Redis con muchas llaves.
     * Sin prefijo borra todas las llaves `bot:state:*`.
     */
    clearAll = async (): Promise<void> => {
        const match = `${this.keyBase}*`
        const found = new Set<string>()
        let cursor = '0'
        // Primero se recolecta y luego se borra: modificar el keyspace mientras se itera
        // puede hacer que algunas implementaciones (ej. ioredis-mock) se salten llaves
        do {
            const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', match, 'COUNT', SCAN_COUNT)
            cursor = nextCursor
            for (const key of keys) found.add(key)
        } while (cursor !== '0')

        const keys = [...found]
        for (let i = 0; i < keys.length; i += SCAN_COUNT) {
            await this.client.del(...keys.slice(i, i + SCAN_COUNT))
        }
    }
}

export { RedisState }
export type { RedisStateOptions }
