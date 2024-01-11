import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { ProviderClass } from 'bot-ts-demo'
import { DialogFlowContext } from '../src/dialogflow'
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
const dialogFlowContext = new DialogFlowContext(mockDatabase, mockProvider, optionsDX)

test('[DialogFlowContext] - instantiation', () => {
    assert.instance(dialogFlowContext, DialogFlowContext)
})

test('[DialogFlowContext] -  constructor', () => {
    const dialogFlowContext = new DialogFlowContext(mockDatabase, mockProvider, optionsDX)
    assert.equal(dialogFlowContext.optionsDX.language, optionsDX.language)
})

test.run()
