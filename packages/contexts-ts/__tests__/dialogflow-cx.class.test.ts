import { ProviderClass } from '@bot-whatsapp/bot'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { DialogFlowCXContext } from '../src/dialogflow-cx/dialogflow-cx.class'
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

const dialogFlowCXContext = new DialogFlowCXContext(mockDatabase, mockProvider, optionsDX)

test('[DialogFlowCXContext] - instantiation', () => {
    assert.instance(dialogFlowCXContext, DialogFlowCXContext)
})

test('[DialogFlowCXContext] -  constructor', () => {
    const dialogFlowContext = new DialogFlowCXContext(mockDatabase, mockProvider, optionsDX)
    assert.equal(dialogFlowContext.optionsDX.language, optionsDX.language)
})

test.run()
