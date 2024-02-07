import { ProviderClass } from '@bot-whatsapp/bot'
import { stub } from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { DialogFlowContext } from '../src/dialogflow/dialogflow.class'
import { DialogFlowContextOptions } from '../src/types'

class MockDBA {
    listHistory = []
    save = () => {}
    getPrevByNumber = () => {}
}

const mockDatabase = new MockDBA()
const mockProvider = new ProviderClass()
const optionsDX: DialogFlowContextOptions = {
    language: 'en',
}
const initStub = stub()

test.skip('[DialogFlowCXContext] - instantiation', () => {
    const dialogFlowContext = new DialogFlowContext(mockDatabase, mockProvider, optionsDX)
    dialogFlowContext.init = initStub
    assert.instance(dialogFlowContext, DialogFlowContext)
    assert.equal(dialogFlowContext.optionsDX.language, optionsDX.language)
})

// test.skip('DialogFlowCXContext - initializes correctly', () => {
//     assert.instance(dialogFlowCXContext, DialogFlowContext)
//     assert.is(dialogFlowCXContext.optionsDX.language, 'en')
//     assert.is(dialogFlowCXContext.projectId, null)
//     assert.is(dialogFlowCXContext.sessionClient, null)
// })

test.run()
