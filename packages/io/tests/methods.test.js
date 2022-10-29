const { test } = require('uvu')
const assert = require('uvu/assert')
const { addKeyword, addAnswer } = require('../methods')

test('Debere probar las propeidades', () => {
    const ARRANGE = {
        keyword: 'hola!',
    }
    const MAIN_CTX = addKeyword(ARRANGE.keyword)

    assert.type(MAIN_CTX.addAnswer, 'function')
    assert.is(MAIN_CTX.ctx.keyword, ARRANGE.keyword)
})

test('Debere probar las propeidades array', () => {
    const ARRANGE = {
        keyword: ['hola!', 'ole'],
    }
    const MAIN_CTX = addKeyword(ARRANGE.keyword)

    assert.is(MAIN_CTX.ctx.keyword, ARRANGE.keyword)
})

test('Debere probar el paso de contexto', () => {
    const ARRANGE = {
        keyword: 'hola!',
        answer: 'Bienvenido',
    }
    const CTX_A = addKeyword(ARRANGE.keyword)
    const CTX_B = addAnswer(CTX_A)(ARRANGE.answer)

    assert.is(CTX_A.ctx.keyword, ARRANGE.keyword)
    assert.is(CTX_B.ctx.keyword, ARRANGE.keyword)
    assert.is(CTX_B.ctx.answer, ARRANGE.answer)
})

test('Debere probar la anidación', () => {
    const ARRANGE = {
        keyword: 'hola!',
        answer_A: 'Bienvenido',
        answer_B: 'Continuar',
    }
    const MAIN_CTX = addKeyword(ARRANGE.keyword)
        .addAnswer(ARRANGE.answer_A)
        .addAnswer(ARRANGE.answer_B)

    assert.is(MAIN_CTX.ctx.answer, ARRANGE.answer_B)
})

test('Debere probar las poptions', () => {
    const MAIN_CTX = addKeyword('etc', { sensitive: false })

    assert.is(MAIN_CTX.ctx.options.sensitive, false)
})

test.run()
