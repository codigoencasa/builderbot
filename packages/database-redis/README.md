<p align="center">
  <a href="https://builderbot.app/">
    <h2 align="center">@builderbot/database-redis</h2>
  </a>
</p>

Redis database adapter for [BuilderBot](https://builderbot.app/), built on [ioredis](https://github.com/redis/ioredis).

It stores the conversation history of every user in a Redis list. You can cap how many messages are kept per user and how long they live. The same Redis connection can also hold the bot's per-user **state** (`state.update` / `state.get`), so it survives restarts and can be shared between several bot instances.

## Installation

```bash
pnpm add @builderbot/database-redis ioredis
```

> `ioredis` is installed explicitly because you create the connection yourself and pass it to the adapter.

## Basic usage

```ts
import { createBot, createFlow, createProvider } from '@builderbot/bot'
import { RedisAdapter as Database } from '@builderbot/database-redis'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'
import Redis from 'ioredis'

const main = async () => {
    const redis = new Redis(process.env.REDIS_URL) // e.g. redis://localhost:6379

    const adapterDB = new Database(redis, {
        prefix: 'my-bot',
        store_messages: 50,
        expire: 60 * 60 * 24 * 7,
    })

    const adapterFlow = createFlow([/* your flows */])
    const adapterProvider = createProvider(Provider)

    await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })
}

main()
```

## Options

`new RedisAdapter(redis, options)`

| Option           | Type             | Default | Description                                                                                  |
| ---------------- | ---------------- | ------- | -------------------------------------------------------------------------------------------- |
| `prefix`         | `string \| null` | `null`  | Namespace added to every key. Use it to keep several bots apart on one Redis.                |
| `store_messages` | `number \| null` | `null`  | Maximum number of messages kept per user (older ones are trimmed). `null` keeps all of them. |
| `expire`         | `number \| null` | `null`  | TTL **in seconds** for a user's history. It is renewed on every new message. `null` = no TTL. |

The second argument is required. Pass `{}` if you don't need any options.

## Persistent state in Redis (optional)

By default BuilderBot keeps each user's `state` in memory, so it is lost when the process restarts. Pass `RedisOptions` to `createBot` to store it in Redis instead. You can reuse the same connection as the adapter:

```ts
const redis = new Redis(process.env.REDIS_URL)

const adapterDB = new Database(redis, { prefix: 'my-bot' })

await createBot(
    {
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    },
    {
        RedisOptions: {
            connection: redis,
            options: { prefix: 'my-bot' },
        },
    }
)
```

With Redis state, every state method is **asynchronous**, so always `await` it:

```ts
const flow = addKeyword('hi')
    .addAnswer('What is your name?', { capture: true }, async (ctx, { state }) => {
        await state.update({ name: ctx.body })
    })
    .addAction(async (_, { state, flowDynamic }) => {
        const name = await state.get('name')
        await flowDynamic(`Nice to meet you, ${name}!`)
    })
```

`state.get` supports dot notation for nested values (`await state.get('user.address.city')`).

`RedisOptions.options` accepts:

| Option   | Type             | Default          | Description                                                                         |
| -------- | ---------------- | ---------------- | ----------------------------------------------------------------------------------- |
| `prefix` | `string \| null` | `null`           | Namespace for state keys. Use the same value as the adapter to keep things tidy.    |
| `expire` | `number \| null` | `86400` (24 h)   | TTL **in seconds**, renewed on every `state.update`. `null` or `0` = never expires. |

Clearing every state of a bot (`clearAll`) only deletes the keys of its own `prefix`. It walks the keys with `SCAN`, so it doesn't block Redis. Without a prefix it deletes every `bot:state:*` key.

## Keys stored in Redis

| Purpose       | Key                           | Redis type        |
| ------------- | ----------------------------- | ----------------- |
| Message history | `bot:history:{prefix}:{from}` | List (JSON items) |
| User state    | `bot:state:{prefix}:{from}`   | String (JSON)     |

If no `prefix` is set, the `{prefix}:` segment is left out (e.g. `bot:history:5730012345678`).

Each history item has this shape:

```json
{ "from": "5730012345678", "body": "hi", "keyword": ["hi"], "date": "2026-11-09T15:00:00.000Z" }
```

## Development

```bash
pnpm --filter @builderbot/database-redis run build
```

```bash
pnpm --filter @builderbot/database-redis run test
```

Tests use [`ioredis-mock`](https://github.com/stipsan/ioredis-mock), so no Redis server is needed.

## Documentation

Visit [builderbot](https://builderbot.app/) to view the full documentation.

## Official Course

If you want to discover all the functions and features offered by the library you can take the course.
[View Course](https://app.codigoencasa.com/courses/builderbot?refCode=LEIFER)

## Contact Us

- [💻 Discord](https://link.codigoencasa.com/DISCORD)
- [👌 𝕏 (Twitter)](https://twitter.com/leifermendez)
