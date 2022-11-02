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

test('Debere probar las addAnswer', () => {
    const MOCK_OPT = {
        media: 'http://image.mock/mock.png',
        buttons: [1],
    }
    const MAIN_CTX = addKeyword('hola').addAnswer('etc', MOCK_OPT)

    assert.is(MAIN_CTX.ctx.options.answer.media, MOCK_OPT.media)
    assert.is(MAIN_CTX.ctx.options.answer.buttons.length, 1)
})

test('Debere probar error las addAnswer', () => {
    const MOCK_OPT = {
        media: { a: 1, b: [] },
        buttons: 'test',
    }
    const MAIN_CTX = addKeyword('hola').addAnswer('etc', MOCK_OPT)

    assert.is(MAIN_CTX.ctx.options.answer.media, null)
    assert.is(MAIN_CTX.ctx.options.answer.buttons.length, 0)
})

test('Obtener toJson', () => {
    const [ctxA, ctxB, ctxC] = addKeyword('hola')
        .addAnswer('pera!')
        .addAnswer('chao')
        .toJson()

    assert.is(ctxA.keyword, 'hola')
    assert.match(ctxA.ref, /^key_/)

    assert.is(ctxB.answer, 'pera!')
    assert.match(ctxB.ref, /^ans_/)

    assert.is(ctxC.answer, 'chao')
    assert.match(ctxC.ref, /^ans_/)
})

test.run()
