import { ProviderClass } from '@builderbot/bot'
import { promises as fsPromises, unlinkSync } from 'fs'
import { join } from 'path'
import { stub } from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { DialogFlowContextCX } from '../src/dialogflow-cx/dialogflow-cx.class'
import type { DialogFlowContextOptions } from '../src/types'
import { Message } from '../src/types'

const mockProvider = new ProviderClass()

const credentialMock = {
    project_id: 'project_id',
    private_key: 'private_key',
    client_email: 'client_email',
}

const optionsDX: DialogFlowContextOptions = {
    language: 'en',
    location: 'uecentral',
    agentId: 'project_id',
}
const existsCredentialStub = stub()
const initializeSessionClientStub = stub()
const sendFlowSimpleStub = stub()
const pathFile = join(process.cwd(), 'google-key.json')

test.before.each(async () => {
    sendFlowSimpleStub.resetHistory()
    initializeSessionClientStub.resetHistory()
    await fsPromises.writeFile(pathFile, JSON.stringify(credentialMock), 'utf-8')
})

test('init -  should return an error message', () => {
    const messageError = `No se encontró`
    try {
        const dialogFlowContext = new DialogFlowContextCX(null, mockProvider)
        dialogFlowContext['existsCredential'] = existsCredentialStub.returns(false)
        dialogFlowContext.init()
    } catch (error) {
        assert.equal(error.message.includes(messageError), true)
    }
})

test('init - should call initializeDialogFlowClient if credentials are available', () => {
    const credentials = {
        project_id: 'tu_project_id',
        private_key: 'tu_private_key',
        client_email: 'tu_client_email',
    }
    const dialogFlowContext = new DialogFlowContextCX(null, mockProvider, optionsDX)
    stub(dialogFlowContext, 'loadCredentials').returns(credentials)
    const initializeDialogFlowClientStub = stub(dialogFlowContext as any, 'initializeDialogFlowClient')
    dialogFlowContext.init()
    assert.equal(initializeDialogFlowClientStub.called, true)
    assert.equal(initializeDialogFlowClientStub.calledWith(credentials), true)
})

test('initializeDialogFlowClient should set projectId, configuration, and sessionClient', () => {
    const dialogFlowContext = new DialogFlowContextCX(null, mockProvider, optionsDX)
    const credentials = {
        project_id: 'test_project',
        private_key: 'private_key',
        client_email: 'client_email',
    }
    dialogFlowContext['initializeDialogFlowClient'](credentials)
    assert.is(dialogFlowContext.projectId, credentials.project_id)
})

test('createSession should return the correct session path', () => {
    const dialogFlowContext = new DialogFlowContextCX(null, mockProvider, optionsDX)
    const mockProjectAgentSessionPath = stub(dialogFlowContext.sessionClient as any, 'projectLocationAgentSessionPath')
    mockProjectAgentSessionPath.callsFake((projectId, from) => `${projectId}/sessions/${from}`)

    const projectId = 'project_id'
    const from = 'uecentral'
    const expectedSessionPath = `${projectId}/sessions/${from}`
    const sessionPath = dialogFlowContext['createSession'](from)
    assert.equal(sessionPath, expectedSessionPath)
    mockProjectAgentSessionPath.restore()
})

test('detectIntent - should return the correct result', async () => {
    const dialogFlowContext = new DialogFlowContextCX(null, mockProvider, optionsDX)
    const mockDetectIntent = stub(dialogFlowContext.sessionClient as any, 'detectIntent')
    const mockResult = {
        queryResult: {
            fulfillmentMessages: [{ message: 'TEXT', text: { text: ['Response from DialogFlow'] } }],
        },
    }
    mockDetectIntent.resolves([mockResult])

    const reqDialog = {
        session: 'session_path',
        queryInput: {
            text: {
                text: 'test_message',
                languageCode: 'en',
            },
        },
    }

    const result = await dialogFlowContext['detectIntent'](reqDialog)

    assert.equal(result, mockResult)

    mockDetectIntent.restore()
})

test('detectIntent - should return null', async () => {
    const dialogFlowContext = new DialogFlowContextCX(null, mockProvider, optionsDX)
    const mockDetectIntent = stub(dialogFlowContext.sessionClient as any, 'detectIntent')

    mockDetectIntent.resolves(null)

    const reqDialog = {
        session: 'session_path',
        queryInput: {
            text: {
                text: 'test_message',
                languageCode: 'en',
            },
        },
    }

    const result = await dialogFlowContext['detectIntent'](reqDialog)

    assert.equal(result, null)

    mockDetectIntent.restore()
})

test('handleMsg - You should send the text message', async () => {
    const messageCtxInComming = {
        from: 'some_user_id',
        body: 'some_message_body',
    }

    const dialogFlowContext = new DialogFlowContextCX(null, mockProvider, optionsDX)
    dialogFlowContext['createSession'] = stub().resolves('session')
    dialogFlowContext['detectIntent'] = stub().resolves({
        queryResult: {
            responseMessages: [{ message: Message.TEXT, text: { text: ['Response from DialogFlow'] } }],
        },
    })
    const expectedMessage = { answer: 'Response from DialogFlow' }

    dialogFlowContext['sendFlowSimple'] = sendFlowSimpleStub

    await dialogFlowContext.handleMsg(messageCtxInComming)
    assert.equal(sendFlowSimpleStub.called, true)
    assert.equal(sendFlowSimpleStub.firstCall.args[0][0], expectedMessage)
})

test('handleMsg - You should send the payload type message', async () => {
    const messageCtxInComming = {
        from: 'some_user_id',
        body: 'some_message_body',
    }

    const dialogFlowContext = new DialogFlowContextCX(null, mockProvider)
    dialogFlowContext['createSession'] = stub().resolves('session')
    dialogFlowContext['detectIntent'] = stub().resolves({
        queryResult: {
            responseMessages: [
                {
                    message: Message.PAYLOAD,
                    payload: {
                        fields: {
                            buttons: {
                                listValue: {
                                    values: [
                                        {
                                            structValue: { fields: { body: { stringValue: 'Test button' } } },
                                        },
                                    ],
                                },
                            },
                            media: { stringValue: 'url-example' },
                            answer: { stringValue: 'test image' },
                        },
                    },
                },
            ],
        },
    })
    const expectedMessage = [
        {
            options: { media: 'url-example', buttons: [{ body: 'Test button' }] },
            answer: 'test image',
        },
    ]

    dialogFlowContext['sendFlowSimple'] = sendFlowSimpleStub

    await dialogFlowContext.handleMsg(messageCtxInComming)
    assert.equal(sendFlowSimpleStub.called, true)
    assert.equal(sendFlowSimpleStub.args[0][0], expectedMessage)
})

test('handleMsg - You should send the payload type media', async () => {
    const messageCtxInComming = {
        from: 'some_user_id',
        body: 'some_message_body',
    }

    const dialogFlowContext = new DialogFlowContextCX(null, mockProvider)
    dialogFlowContext['createSession'] = stub().resolves('session')
    dialogFlowContext['detectIntent'] = stub().resolves({
        queryResult: {
            responseMessages: [
                {
                    message: Message.PAYLOAD,
                    payload: {
                        fields: {
                            buttons: {
                                listValue: {
                                    values: [],
                                },
                            },
                            media: { stringValue: 'url-example' },
                            answer: { stringValue: null },
                        },
                    },
                },
            ],
        },
    })
    const expectedMessage = [
        {
            options: { media: 'url-example', buttons: [] },
            answer: '',
        },
    ]

    dialogFlowContext['sendFlowSimple'] = sendFlowSimpleStub

    await dialogFlowContext.handleMsg(messageCtxInComming)
    assert.equal(sendFlowSimpleStub.called, true)
    assert.equal(sendFlowSimpleStub.args[0][0], expectedMessage)
})

test.after.each(() => {
    unlinkSync(pathFile)
})
test.run()
