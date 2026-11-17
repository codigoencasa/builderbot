import { suite } from 'uvu'
import * as assert from 'uvu/assert'

import { setup, clear } from '../../__mock__/env'
import { addKeyword, createBot, createFlow, EVENTS } from '../../src'
import { delay } from '../../src/utils'

const suiteCase = suite('Flujo: un turno a la vez por contacto (queue.serializeByContact)')

suiteCase.before.each(setup)
suiteCase.after.each(clear)

const TURN_MS = 300

type TurnLog = { active: number; maxActive: number; order: string[] }

/** Polls instead of sleeping a fixed time, so the result does not depend on how loaded the machine is. */
const waitUntil = async (done: () => boolean, timeoutMs = 10000) => {
    const deadline = Date.now() + timeoutMs
    while (!done() && Date.now() < deadline) await delay(20)
}

/** Waits for the expected outcome and then a little longer, so a late extra reply is still caught. */
const settled = async (done: () => boolean) => {
    await waitUntil(done)
    await delay(100)
}

const slowWelcome = (log: TurnLog, hold: () => Promise<unknown> = () => delay(TURN_MS)) =>
    addKeyword(EVENTS.WELCOME).addAction(async (ctx, { flowDynamic }) => {
        log.active++
        log.maxActive = Math.max(log.maxActive, log.active)
        log.order.push(`start:${ctx.body}`)
        await hold()
        log.order.push(`end:${ctx.body}`)
        log.active--
        await flowDynamic(`R:${ctx.body}`)
    })

const repliesOf = (database: { listHistory: any[] }, from: string) =>
    database.listHistory.filter((m) => m.from === from && `${m.answer ?? ''}`.startsWith('R:')).map((m) => m.answer)

suiteCase('Por defecto los turnos del mismo contacto corren a la vez y el bloqueo no se usa', async (context) => {
    const { database, provider } = context
    const log: TurnLog = { active: 0, maxActive: 0, order: [] }
    // "uno" stays open until "dos" starts: they overlap whenever nothing serializes them.
    const untilSecondStarts = () => waitUntil(() => log.order.includes('start:dos'), 3000)
    context.bot = await createBot({ database, provider, flow: createFlow([slowWelcome(log, untilSecondStarts)]) })
    let lockCalls = 0
    const runContactTurn = context.bot.runContactTurn
    context.bot.runContactTurn = (...args: unknown[]) => {
        lockCalls++
        return runContactTurn(...args)
    }

    provider.emit('message', { from: '100', body: 'uno', name: 'c' })
    await delay(50)
    provider.emit('message', { from: '100', body: 'dos', name: 'c' })
    assert.is(context.bot.contactTurns.size, 0)
    await settled(() => repliesOf(database, '100').length === 2)

    assert.is(log.maxActive, 2)
    assert.is(lockCalls, 0)
    assert.equal(repliesOf(database, '100').sort(), ['R:dos', 'R:uno'])
})

suiteCase('Con serializeByContact el segundo mensaje espera a que acabe el turno anterior', async (context) => {
    const { database, provider } = context
    const log: TurnLog = { active: 0, maxActive: 0, order: [] }
    context.bot = await createBot(
        { database, provider, flow: createFlow([slowWelcome(log)]) },
        { queue: { timeout: 5000, concurrencyLimit: 15, serializeByContact: true } }
    )

    provider.emit('message', { from: '200', body: 'uno', name: 'c' })
    await delay(50)
    provider.emit('message', { from: '200', body: 'dos', name: 'c' })
    await settled(() => repliesOf(database, '200').length === 2)

    assert.is(log.maxActive, 1)
    assert.equal(log.order, ['start:uno', 'end:uno', 'start:dos', 'end:dos'])
    assert.equal(repliesOf(database, '200'), ['R:uno', 'R:dos'])
})

// Con `concurrencyLimit: 1` y sin serializar, el item de "dos" espera en la cola y el `clearQueue` del
// gotoFlow de "uno" lo cancela en silencio: solo llega `R:uno`.
suiteCase(
    'Con serializeByContact y un solo slot, el gotoFlow de un turno no cancela el mensaje que espera',
    async (context) => {
        const { database, provider } = context
        const target = addKeyword(EVENTS.ACTION).addAction(async (ctx, { flowDynamic }) => {
            await flowDynamic(`R:${ctx.body}`)
        })
        const welcome = addKeyword(EVENTS.WELCOME).addAction(async (_ctx, { gotoFlow }) => {
            await delay(TURN_MS)
            return gotoFlow(target)
        })
        context.bot = await createBot(
            { database, provider, flow: createFlow([welcome, target]) },
            { queue: { timeout: 5000, concurrencyLimit: 1, serializeByContact: true } }
        )

        provider.emit('message', { from: '250', body: 'uno', name: 'c' })
        await delay(50)
        provider.emit('message', { from: '250', body: 'dos', name: 'c' })
        await settled(() => repliesOf(database, '250').length === 2)

        assert.equal(repliesOf(database, '250'), ['R:uno', 'R:dos'])
    }
)

suiteCase('Con serializeByContact los contactos distintos siguen en paralelo', async (context) => {
    const { database, provider } = context
    const log: TurnLog = { active: 0, maxActive: 0, order: [] }
    // Each turn stays open until both are running: they overlap unless the order became global.
    const untilBothRun = () => waitUntil(() => log.maxActive === 2, 3000)
    context.bot = await createBot(
        { database, provider, flow: createFlow([slowWelcome(log, untilBothRun)]) },
        { queue: { timeout: 5000, concurrencyLimit: 15, serializeByContact: true } }
    )

    provider.emit('message', { from: '301', body: 'uno', name: 'c' })
    provider.emit('message', { from: '302', body: 'uno', name: 'c' })
    await settled(() => repliesOf(database, '301').length === 1 && repliesOf(database, '302').length === 1)

    assert.is(log.maxActive, 2)
    assert.equal(repliesOf(database, '301'), ['R:uno'])
    assert.equal(repliesOf(database, '302'), ['R:uno'])
})

suiteCase('Con serializeByContact un turno colgado libera al contacto tras queue.timeout', async (context) => {
    const { database, provider } = context
    const log: TurnLog = { active: 0, maxActive: 0, order: [] }
    const getPrevByNumber = database.getPrevByNumber.bind(database)
    let calls = 0
    database.getPrevByNumber = (from: string) => {
        calls++
        if (calls === 1) return new Promise(() => undefined)
        return getPrevByNumber(from)
    }
    context.bot = await createBot(
        { database, provider, flow: createFlow([slowWelcome(log, () => delay(20))]) },
        { queue: { timeout: 200, concurrencyLimit: 15, serializeByContact: true } }
    )

    provider.emit('message', { from: '400', body: 'colgado', name: 'c' })
    await delay(20)
    provider.emit('message', { from: '400', body: 'dos', name: 'c' })
    await settled(() => repliesOf(database, '400').length === 1)

    assert.equal(repliesOf(database, '400'), ['R:dos'])
})

// Cinco turnos de TURN_MS en cola con un límite de 2,5 turnos: cada uno acaba dentro de su límite si este
// cuenta desde que arranca. Si contara desde que se encola, el cuarto vencería esperando y el quinto se solaparía.
suiteCase(
    'Con serializeByContact el límite cuenta desde que arranca cada turno, no desde que se encola',
    async (context) => {
        const { database, provider } = context
        const log: TurnLog = { active: 0, maxActive: 0, order: [] }
        const bodies = ['uno', 'dos', 'tres', 'cuatro', 'cinco']
        context.bot = await createBot(
            { database, provider, flow: createFlow([slowWelcome(log)]) },
            { queue: { timeout: TURN_MS * 2.5, concurrencyLimit: 15, serializeByContact: true } }
        )

        for (const body of bodies) {
            provider.emit('message', { from: '500', body, name: 'c' })
            await delay(50)
        }
        await settled(() => repliesOf(database, '500').length === bodies.length)

        assert.is(log.maxActive, 1)
        assert.equal(
            repliesOf(database, '500'),
            bodies.map((body) => `R:${body}`)
        )
    }
)

suiteCase(
    'Con serializeByContact el primer turno arranca en el mismo tick y no deja rastro al terminar',
    async (context) => {
        const { database, provider } = context
        context.bot = await createBot(
            { database, provider, flow: createFlow([addKeyword(EVENTS.WELCOME).addAnswer('hola')]) },
            { queue: { timeout: 5000, concurrencyLimit: 15, serializeByContact: true } }
        )
        const turns: Map<string, unknown> = context.bot.contactTurns
        let started = false

        const first = context.bot.runContactTurn('600', async () => {
            started = true
            await delay(30)
            return 'uno'
        })
        assert.is(started, true)
        assert.is(turns.size, 1)

        const second = context.bot.runContactTurn('600', async () => 'dos')
        assert.equal(await Promise.all([first, second]), ['uno', 'dos'])
        assert.is(turns.size, 0)
    }
)

suiteCase('Con serializeByContact un turno que falla libera al contacto y el error no se traga', async (context) => {
    const { database, provider } = context
    context.bot = await createBot(
        { database, provider, flow: createFlow([addKeyword(EVENTS.WELCOME).addAnswer('hola')]) },
        { queue: { timeout: 5000, concurrencyLimit: 15, serializeByContact: true } }
    )
    const handleMsg = context.bot.handleMsg
    context.bot.handleMsg = async (ctx: { body: string }) => {
        if (ctx.body === 'rompe') throw new Error('turn failed')
        return handleMsg(ctx)
    }
    const greetings = () => database.listHistory.filter((m: any) => m.from === '700' && m.answer === 'hola').length
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => unhandled.push(reason)
    process.on('unhandledRejection', onUnhandled)

    try {
        provider.emit('message', { from: '700', body: 'rompe', name: 'c' })
        provider.emit('message', { from: '700', body: 'sigue', name: 'c' })
        await settled(() => greetings() === 1 && unhandled.length === 1 && context.bot.contactTurns.size === 0)
    } finally {
        process.off('unhandledRejection', onUnhandled)
    }

    assert.is(unhandled.length, 1)
    assert.is((unhandled[0] as Error).message, 'turn failed')
    assert.is(greetings(), 1)
    assert.is(context.bot.contactTurns.size, 0)
})

suiteCase.run()
