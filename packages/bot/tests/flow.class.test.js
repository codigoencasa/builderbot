const { test } = require('uvu')
const assert = require('uvu/assert')
const FlowClass = require('../io/flow.class')
const { addKeyword } = require('../index')

test(`[FlowClass] Probando instanciamiento de clase`, async () => {
    const MOCK_FLOW = addKeyword('hola').addAnswer('Buenas!')
    const flowClass = new FlowClass([MOCK_FLOW])
    assert.is(flowClass instanceof FlowClass, true)
})

test(`[FlowClass] Probando find`, async () => {
    const MOCK_FLOW = addKeyword('hola').addAnswer('Buenas!')
    const flowClass = new FlowClass([MOCK_FLOW])

    flowClass.find('hola')
    assert.is(flowClass instanceof FlowClass, true)
})

test(`[FlowClass] Probando findBySerialize`, async () => {
    const MOCK_FLOW = addKeyword('hola').addAnswer('Buenas!')
    const flowClass = new FlowClass([MOCK_FLOW])

    flowClass.findBySerialize('')
    assert.is(flowClass instanceof FlowClass, true)
})

test.run()
