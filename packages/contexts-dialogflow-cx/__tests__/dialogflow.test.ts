import { ProviderClass } from '@bot-whatsapp/bot'
import * as dialogflow from '@google-cloud/dialogflow'
import fs from 'fs'
import proxyquire from 'proxyquire'
import { stub, spy } from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { DialogFlowContextOptions } from '../src/types'

const fsMock = {
    existsSync: stub(fs, 'existsSync'),
    readFileSync: stub(),
}

const { DialogFlowContext } = proxyquire('../src/dialogflow', { fs: fsMock, GOOGLE_ACCOUNT_PATH: 'test' })

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

test('[DialogFlowContext] - instantiation', () => {
    const dialogFlowContext = new DialogFlowContext(mockDatabase, mockProvider, optionsDX)
    assert.instance(dialogFlowContext, DialogFlowContext)
})

test('[DialogFlowContext] -  constructor', () => {
    const dialogFlowContext = new DialogFlowContext(mockDatabase, mockProvider, optionsDX)
    assert.equal(dialogFlowContext.optionsDX.language, optionsDX.language)
})

test('loadCredentials - should return null when file does not exist', () => {
    const dialogFlowContext = new DialogFlowContext(mockDatabase, mockProvider, optionsDX)
    fsMock.existsSync.returns(false)
    const result = dialogFlowContext['loadCredentials']()
    assert.equal(result, null)
})

test('init- should not initialize DialogFlowClient if credentials do not exist', () => {
    const dialogFlowContext = new DialogFlowContext(mockDatabase, mockProvider, optionsDX)
    const initializeDialogFlowClientSpy = spy(dialogFlowContext['initializeDialogFlowClient'])
    stub(dialogFlowContext, 'loadCredentials').returns(null)
    dialogFlowContext.init()
    assert.equal(initializeDialogFlowClientSpy.notCalled, true)
})

test('init - should call initializeDialogFlowClient if credentials are available', () => {
    const credentials = {
        project_id: 'tu_project_id',
        private_key: 'tu_private_key',
        client_email: 'tu_client_email',
    }
    const dialogFlowContext = new DialogFlowContext(mockDatabase, mockProvider, optionsDX)
    stub(dialogFlowContext, 'loadCredentials').returns(credentials)
    const initializeDialogFlowClientStub = stub(dialogFlowContext, 'initializeDialogFlowClient')
    dialogFlowContext.init()
    assert.equal(initializeDialogFlowClientStub.called, true)
    assert.equal(initializeDialogFlowClientStub.calledWith(credentials), true)
})

test('initializeDialogFlowClient should set projectId, configuration, and sessionClient', () => {
    const dialogFlowContext = new DialogFlowContext(mockDatabase, mockProvider, optionsDX)
    const credentials = {
        project_id: 'test_project',
        private_key: 'private_key',
        client_email: 'client_email',
    }
    dialogFlowContext.initializeDialogFlowClient(credentials)
    assert.is(dialogFlowContext.projectId, credentials.project_id)
    assert.equal(dialogFlowContext.configuration, {
        credentials: { private_key: 'private_key', client_email: 'client_email' },
    })
    assert.instance(dialogFlowContext.sessionClient, dialogflow.SessionsClient)
})

test.run()
