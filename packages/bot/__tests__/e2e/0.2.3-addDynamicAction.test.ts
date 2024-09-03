import { suite } from 'uvu'
import * as assert from 'uvu/assert'

import { setup, clear, parseAnswers } from '../../__mock__/env'
import { addKeyword, createBot, createFlow, EVENTS } from '../../src'
import { delay } from '../../src/utils'

const suiteCase = suite('Flujo: Dynamic callbacks')

suiteCase.before.each(setup)
suiteCase.after.each(clear)

suiteCase(`Debe saltar del id: dynamic al id: t2_3`, async ({ database, provider }) => {
    /*
        Se lanza el primer trigger `soy t2`, luego se captura la respuesta

        # caso de uso: 
            - El cliente indica algo diferente a la palabra `foo`, esto dispararia el ultimo `addAnswer` con id: t2_3

    */

    const f1 = addKeyword(EVENTS.WELCOME, undefined)
        .addAnswer('soy t2', { capture: true })
        .addDynamicAction(
            async (ctx) => {
                return new Promise((resolve) => {
                    const re = /foo/gim

                    resolve(re.test(ctx.body!))
                })
            },
            async (ctx, { flowDynamic }) => await flowDynamic('soy dynamic'),
            { id: 'dynamic', skip_id: 't2_3' }
        )
        .addAnswer('soy t2_2', { id: 't2_2' })
        .addAnswer('soy t2_3', { id: 't2_3' })

    await createBot({
        database,
        flow: createFlow([f1]),
        provider,
    })

    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: 'hola',
    })
    await delay(250)

    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: 'aja',
    })
    await delay(250)

    const history = parseAnswers(database.listHistory).map((item) => item.answer)

    assert.is('soy t2_3', history.at(-1))
})

suiteCase(`Debe terminar en el 'endFlow'`, async ({ database, provider }) => {
    /*
        Se lanza el primer trigger `soy t2`, luego se captura la respuesta

        # caso de uso: 
            - El cliente indica la palabra `t2`, esto daria por terminado el flujo.

    */

    const t2 = addKeyword(EVENTS.WELCOME, undefined)
        .addAnswer('soy t2')
        .addAction({ id: 't2_0', capture: true }, async (ctx, { endFlow }) => {
            if (ctx.body === 't2') return await endFlow()
        })
        .addDynamicAction(
            async (ctx) => {
                return new Promise((resolve) => {
                    const re = /foo/gim

                    resolve(re.test(ctx.body!))
                })
            },
            async (ctx, { flowDynamic }) => await flowDynamic('soy dynamic'),
            { id: 'dynamic', skip_id: 't2_3' }
        )
        .addAnswer('soy t2_2', { id: 't2_2' })
        .addAnswer('soy t2_3', { id: 't2_3' })

    await createBot({
        database,
        flow: createFlow([t2]),
        provider,
    })

    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: 'hola',
    })
    await delay(250)

    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: 't2',
    })
    await delay(250)

    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: 'aja',
    })
    await delay(250)

    const history = parseAnswers(database.listHistory).map((item) => item.answer)

    assert.is('t2', history.at(1))
    assert.is(4, history.length)
    assert.is('soy t2', history.at(-1))
})

suiteCase(`Debe completar todo el flow`, async ({ database, provider }) => {
    /*
        Se lanza el primer trigger `soy t2`, luego se captura la respuesta

        # caso de uso: 
            - El cliente indica la palabra `foo`, esto completaria todo el flujo.

    */

    const t2 = addKeyword(EVENTS.WELCOME, undefined)
        .addAnswer('soy t2', { capture: true })
        .addDynamicAction(
            async (ctx) => {
                return new Promise((resolve) => {
                    const re = /foo/gim

                    resolve(re.test(ctx.body!))
                })
            },
            async (ctx, { flowDynamic }) => await flowDynamic('soy dynamic'),
            { id: 'dynamic', skip_id: 't2_3' }
        )
        .addAnswer('soy t2_2', { id: 't2_2' })
        .addAnswer('soy t2_3', { id: 't2_3' })

    await createBot({
        database,
        flow: createFlow([t2]),
        provider,
    })

    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: 'hola',
    })
    await delay(250)

    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: 'foo',
    })
    await delay(250)

    const history = parseAnswers(database.listHistory).map((item) => item.answer)

    assert.is(5, history.length)
})

suiteCase(
    `Multiples 'addDynamicAction', salta el primero y ejecuta el segundo dynamic`,
    async ({ database, provider }) => {
        /*
        Se lanza el primer trigger `soy t2`, luego se captura la respuesta

        # caso de uso: 
            - El sistema deberá poder saltar el primero dynamic y ejecutar el segundo, (Respetando las condiciones)

    */

        const f1 = addKeyword(EVENTS.WELCOME, undefined)
            .addAnswer('soy t2', { capture: true })
            .addDynamicAction(
                async (ctx) => {
                    return new Promise((resolve) => {
                        const re = /foo/gim

                        resolve(re.test(ctx.body!))
                    })
                },
                async (ctx, { flowDynamic }) => await flowDynamic('soy dynamic'),
                { id: 'dynamic', skip_id: 't2_3' }
            )
            .addAnswer('soy t2_2', { id: 't2_2' })
            .addAnswer('soy t2_3', { id: 't2_3', capture: true })
            .addDynamicAction(
                async (ctx) => {
                    return new Promise((resolve) => {
                        const re = /foo2/gim

                        resolve(re.test(ctx.body!))
                    })
                },
                async (ctx, { flowDynamic }) => await flowDynamic('soy dynamic2'),
                { id: 'dynamic2' }
            )
            .addAnswer('soy t2_4', { id: 't2_4' })
            .addAnswer('soy t2_5', { id: 't2_5' })

        await createBot({
            database,
            flow: createFlow([f1]),
            provider,
        })

        await provider.delaySendMessage(100, 'message', {
            from: '000',
            body: 'hola',
        })
        await delay(250)

        await provider.delaySendMessage(100, 'message', {
            from: '000',
            body: 'aja',
        })
        await delay(250)

        await provider.delaySendMessage(100, 'message', {
            from: '000',
            body: 'foo2',
        })
        await delay(250)

        const history = parseAnswers(database.listHistory).map((item) => item.answer)

        assert.equal(true, !history.includes('soy dynamic'))
        assert.equal(true, !history.includes('soy t2_2'))
        assert.is(7, history.length)
    }
)

suiteCase(`Multiples 'addDynamicAction'`, async ({ database, provider }) => {
    /*
        Se lanza el primer trigger `soy t2`, luego se captura la respuesta

        # caso de uso: 
            - Se ejecutan todos los addDynamicActions

    */

    const f1 = addKeyword(EVENTS.WELCOME, undefined)
        .addAnswer('soy t2', { capture: true })
        .addDynamicAction(
            async (ctx) => {
                return new Promise((resolve) => {
                    const re = /foo/gim

                    resolve(re.test(ctx.body!))
                })
            },
            async (ctx, { flowDynamic }) => await flowDynamic('soy dynamic'),
            { id: 'dynamic', skip_id: 't2_3' }
        )
        .addAnswer('soy t2_2', { id: 't2_2' })
        .addAnswer('soy t2_3', { id: 't2_3', capture: true })
        .addDynamicAction(
            async (ctx) => {
                return new Promise((resolve) => {
                    const re = /foo2/gim

                    resolve(re.test(ctx.body!))
                })
            },
            async (ctx, { flowDynamic }) => await flowDynamic('soy dynamic2'),
            { id: 'dynamic2' }
        )
        .addAnswer('soy t2_4', { id: 't2_4' })
        .addAnswer('soy t2_5', { id: 't2_5' })

    await createBot({
        database,
        flow: createFlow([f1]),
        provider,
    })

    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: 'hola',
    })
    await delay(250)

    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: 'foo',
    })
    await delay(250)

    await provider.delaySendMessage(100, 'message', {
        from: '000',
        body: 'foo2',
    })
    await delay(250)

    const history = parseAnswers(database.listHistory).map((item) => item.answer)

    assert.equal(true, history.includes('soy dynamic'))
    assert.equal(true, history.includes('soy dynamic2'))
    assert.is(9, history.length)
})

suiteCase(
    `Multiples 'addDynamicAction', el ultimo 'addDynamicAction' no se ejecuta`,
    async ({ database, provider }) => {
        /*
        Se lanza el primer trigger `soy t2`, luego se captura la respuesta

        # caso de uso: 
            - Se ejecutan solo el primer addDynamicAction

    */

        const f1 = addKeyword(EVENTS.WELCOME, undefined)
            .addAnswer('soy t2', { capture: true })
            .addDynamicAction(
                async (ctx) => {
                    return new Promise((resolve) => {
                        const re = /foo/gim

                        resolve(re.test(ctx.body!))
                    })
                },
                async (ctx, { flowDynamic }) => await flowDynamic('soy dynamic'),
                { id: 'dynamic', skip_id: 't2_3' }
            )
            .addAnswer('soy t2_2', { id: 't2_2' })
            .addAnswer('soy t2_3', { id: 't2_3', capture: true })
            .addDynamicAction(
                async (ctx) => {
                    return new Promise((resolve) => {
                        const re = /foo2/gim

                        resolve(re.test(ctx.body!))
                    })
                },
                async (ctx, { flowDynamic }) => await flowDynamic('soy dynamic2'),
                { id: 'dynamic2' }
            )
            .addAnswer('soy t2_4', { id: 't2_4' })
            .addAnswer('soy t2_5', { id: 't2_5' })

        await createBot({
            database,
            flow: createFlow([f1]),
            provider,
        })

        await provider.delaySendMessage(100, 'message', {
            from: '000',
            body: 'hola',
        })
        await delay(250)

        await provider.delaySendMessage(100, 'message', {
            from: '000',
            body: 'foo',
        })
        await delay(250)

        await provider.delaySendMessage(100, 'message', {
            from: '000',
            body: 'eje',
        })
        await delay(250)

        const history = parseAnswers(database.listHistory).map((item) => item.answer)

        assert.equal(true, history.includes('soy dynamic'))
        assert.equal(true, !history.includes('soy dynamic2'))
        assert.is(8, history.length)
    }
)

suiteCase.run()
