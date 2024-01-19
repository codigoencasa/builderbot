import { test } from 'uvu'
import * as assert from 'uvu/assert'

import FlowClass from '../../src/io/flowClass'
import { addKeyword } from '../../src/io/methods'

test('[FlowClass] Probando instanciamiento de clase', () => {
    const MOCK_FLOW = addKeyword('hola').addAnswer('Buenas!')
    const flowClass = new FlowClass([MOCK_FLOW])
    assert.instance(flowClass, FlowClass)
})

test('[FlowClass] Probando find', () => {
    const MOCK_FLOW = addKeyword('hola').addAnswer('Buenas!')
    const flowClass = new FlowClass([MOCK_FLOW])
    const result = flowClass.find('hola')
    assert.equal(result[0].answer, 'Buenas!')
})

test('[FlowClass] Probando findBySerialize', () => {
    const MOCK_FLOW = addKeyword('hola').addAnswer('Buenas!')
    const flowClass = new FlowClass([MOCK_FLOW])
    const result = flowClass.find('hola')
    const resultSerialize = flowClass.findBySerialize(result[0].refSerialize)
    assert.equal(resultSerialize.answer, 'Buenas!')
})

test('[FlowClass] Probando findIndexByRef', () => {
    const MOCK_FLOW = addKeyword('hola').addAnswer('Buenas!', { ref: '10000' })
    const flowClass = new FlowClass([MOCK_FLOW])
    const ref = flowClass.flowSerialize[0].ref
    const index = flowClass.findIndexByRef(ref)
    assert.is(index, 0)
})

test('[FlowClass] Probando findSerializeByRef', () => {
    const MOCK_FLOW = addKeyword('hola').addAnswer('Buenas!')
    const flowClass = new FlowClass([MOCK_FLOW])
    const ref = flowClass.flowSerialize[0].ref
    const context = flowClass.findSerializeByRef(ref)
    assert.equal(context.keyword, 'hola')
})

test('[FlowClass] Probando getRefToContinueChild', () => {
    const MOCK_FLOW_CHILD = addKeyword('ping').addAnswer('pong!')
    const MOCK_FLOW = addKeyword('hola').addAnswer('Buenas!', { ref: '1000' }, null, [MOCK_FLOW_CHILD])
    const flowClass = new FlowClass([MOCK_FLOW])
    const context = flowClass.getRefToContinueChild('a243678f1e3e31a35c43b03c53503ef7')
    assert.equal(context.keyword, 'ping')
})

test('[FlowClass] Probando getFlowsChild', () => {
    const MOCK_FLOW = addKeyword('hola').addAnswer('Buenas!')
    const flowClass = new FlowClass([MOCK_FLOW])
    const contexts = flowClass.getFlowsChild()
    assert.equal(contexts, [])
})

test.run()
