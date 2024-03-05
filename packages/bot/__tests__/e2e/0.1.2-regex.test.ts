import { suite } from 'uvu'
import * as assert from 'uvu/assert'

import { clear, delay, parseAnswers, setup } from '../../__mock__/env'
import { addKeyword, createBot, createFlow } from '../../src'

const suiteCase = suite('Flujo: regex')

suiteCase.before.each(setup)
suiteCase.after.each(clear)

suiteCase(`Responder a una expresion regular`, async ({ database, provider }) => {
    const REGEX_CREDIT_NUMBER = `/(^4[0-9]{12}(?:[0-9]{3})?$)|(^(?:5[1-5][0-9]{2}|222[1-9]|22[3-9][0-9]|2[3-6][0-9]{2}|27[01][0-9]|2720)[0-9]{12}$)|(3[47][0-9]{13})|(^3(?:0[0-5]|[68][0-9])[0-9]{11}$)|(^6(?:011|5[0-9]{2})[0-9]{12}$)|(^(?:2131|1800|35\d{3})\d{11}$)/gm`

    const flow = addKeyword(REGEX_CREDIT_NUMBER, { regex: true })
        .addAnswer(`Gracias por proporcionar un numero de tarjeta valido`)
        .addAnswer('Fin!')

    await createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: '374245455400126',
    })

    await delay(100)
    const history = parseAnswers(database.listHistory).map((item) => item.answer)
    assert.is('Gracias por proporcionar un numero de tarjeta valido', history[0])
    assert.is('Fin!', history[1])
    assert.is(undefined, history[2])
})

suiteCase(`NO Responder a una expresion regular`, async ({ database, provider }) => {
    const REGEX_CREDIT_NUMBER = `/(^4[0-9]{12}(?:[0-9]{3})?$)|(^(?:5[1-5][0-9]{2}|222[1-9]|22[3-9][0-9]|2[3-6][0-9]{2}|27[01][0-9]|2720)[0-9]{12}$)|(3[47][0-9]{13})|(^3(?:0[0-5]|[68][0-9])[0-9]{11}$)|(^6(?:011|5[0-9]{2})[0-9]{12}$)|(^(?:2131|1800|35\d{3})\d{11}$)/gm`
    const flow = addKeyword(REGEX_CREDIT_NUMBER, { regex: true })
        .addAnswer(`Gracias por proporcionar un numero de tarjeta valido`)
        .addAnswer('Fin!')

    await createBot({
        database,
        provider,
        flow: createFlow([flow]),
    })

    await provider.delaySendMessage(0, 'message', {
        from: '000',
        body: 'hola',
    })

    await delay(100)

    assert.is(undefined, database.listHistory[0])
    assert.is(undefined, database.listHistory[1])
})

suiteCase.run()
