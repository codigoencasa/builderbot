import { ProviderClass } from '@builderbot/bot'
import { promises as fsPromises, unlinkSync } from 'fs'
import { join } from 'path'
import { stub } from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { DialogFlowContext } from '../src/dialogflow/dialogflow.class'
import { Message } from '../src/types'

const mockProvider = new ProviderClass()

const credentialMock = {
    project_id: 'project_id',
    private_key: 'private_key',
    client_email: 'client_email',
}

const existsCredentialStub = stub()
const getCredentialStub = stub()
const initializeSessionClientStub = stub()
const sendFlowSimpleStub = stub()
const pathFile = join(process.cwd(), 'google-key.json')

test.before.each(async () => {
    sendFlowSimpleStub.resetHistory()
    await fsPromises.writeFile(pathFile, JSON.stringify(credentialMock), 'utf-8')
})

test('init - I should call the initializeSessionClient function', () => {
    const expectedData = {
        credentials: { private_key: 'private_key', client_email: 'client_email' },
    }
    const dialogFlowContext = new DialogFlowContext(null, mockProvider)
    dialogFlowContext['existsCredential'] = existsCredentialStub.returns(true)
    dialogFlowContext['getCredential'] = getCredentialStub.returns(credentialMock)
    dialogFlowContext['initializeSessionClient'] = initializeSessionClientStub
    dialogFlowContext.init()
    assert.equal(initializeSessionClientStub.firstCall.args[0], expectedData)
})

test('init -  should return an error message', () => {
    const messageError = `No se encontró`
    try {
        const dialogFlowContext = new DialogFlowContext(null, mockProvider)
        dialogFlowContext['existsCredential'] = existsCredentialStub.returns(false)
        dialogFlowContext.init()
    } catch (error) {
        assert.equal(error.message.includes(messageError), true)
    }
})

test('handleMsg - You should send the text message', async () => {
    const messageCtxInComming = {
        from: 'some_user_id',
        body: 'some_message_body',
    }

    const dialogFlowContext = new DialogFlowContext(null, mockProvider)
    dialogFlowContext['createSession'] = stub().resolves('session')
    dialogFlowContext['detectIntent'] = stub().resolves({
        queryResult: {
            fulfillmentMessages: [{ message: Message.TEXT, text: { text: ['Response from DialogFlow'] } }],
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

    const dialogFlowContext = new DialogFlowContext(null, mockProvider)
    dialogFlowContext['createSession'] = stub().resolves('session')
    dialogFlowContext['detectIntent'] = stub().resolves({
        queryResult: {
            fulfillmentMessages: [
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

test('createSession should return the correct session path', () => {
    const dialogFlowContext = new DialogFlowContext(null, mockProvider)
    const mockProjectAgentSessionPath = stub(dialogFlowContext.sessionClient as any, 'projectAgentSessionPath')
    mockProjectAgentSessionPath.callsFake((projectId, from) => `${projectId}/sessions/${from}`)

    const projectId = 'project_id'
    const from = 'test_user_id'
    const expectedSessionPath = `${projectId}/sessions/${from}`
    const sessionPath = dialogFlowContext['createSession'](from)
    assert.equal(sessionPath, expectedSessionPath)
    assert.equal(mockProjectAgentSessionPath.args[0], [projectId, from])
    mockProjectAgentSessionPath.restore()
})

test('detectIntent - should return the correct result', async () => {
    const dialogFlowContext = new DialogFlowContext(null, mockProvider)
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
    const dialogFlowContext = new DialogFlowContext(null, mockProvider)
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

test.after.each(() => {
    unlinkSync(pathFile)
})
test.run()
