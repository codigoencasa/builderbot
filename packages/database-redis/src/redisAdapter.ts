import { MemoryDB } from '@builderbot/bot'
import Redis from 'ioredis'

import type { History, RedisAdapterCredentials } from './types'

class RedisAdapter extends MemoryDB {
    client: Redis
    options: RedisAdapterCredentials

    constructor(redis: Redis, _options: RedisAdapterCredentials) {
        super()
        this.options = _options
        this.client = redis
    }

    getPrevByNumber = async (from: string): Promise<any> => {
        const key = `history:${this.options.prefix ? this.options.prefix + ':' : ''}${from}`
        const result = await this.client.lrange(key, -1, -1)

        if (!result.length) return null

        return JSON.parse(result[0])
    }

    save = async (ctx: History): Promise<void> => {
        const key = `history:${this.options.prefix ? this.options.prefix + ':' : ''}${ctx.from}`

        const ctxWithDate = {
            ...ctx,
            date: new Date(),
        }

        await this.client.rpush(key, JSON.stringify(ctxWithDate))

        if (this.options.store_messages) await this.client.ltrim(key, -this.options.store_messages, -1)

        if (this.options.expire) await this.client.expire(key, this.options.expire)
    }
}

export { RedisAdapter }
