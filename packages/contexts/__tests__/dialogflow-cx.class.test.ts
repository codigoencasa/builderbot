import { ProviderClass } from '@bot-whatsapp/bot'
import { join } from 'path'
import { stub } from 'sinon'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { DialogFlowCXContext } from '../src/index'
import { DialogFlowContextOptions, DialogFlowCredentials } from '../src/types'

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

const getCredentialsStub = stub(dialogFlowCXContext, 'getCredentials')

test.after.each(() => {
    getCredentialsStub.resetHistory()
})

test('[DialogFlowCXContext] - instantiation', () => {
    assert.instance(dialogFlowCXContext, DialogFlowCXContext)
})

test('[DialogFlowCXContext] -  constructor', () => {
    const dialogFlowContext = new DialogFlowCXContext(mockDatabase, mockProvider, optionsDX)
    assert.equal(dialogFlowContext.optionsDX.language, optionsDX.language)
})

test('DialogFlowCXContext - initializes correctly', () => {
    assert.instance(dialogFlowCXContext, DialogFlowCXContext)
    assert.is(dialogFlowCXContext.optionsDX.language, 'en')
    assert.is(dialogFlowCXContext.optionsDX.location, '')
    assert.is(dialogFlowCXContext.optionsDX.agentId, '')
    assert.is(dialogFlowCXContext.projectId, null)
    assert.is(dialogFlowCXContext.sessionClient, null)
})

test('init - It should return the error message --> Google key configuration not found', async () => {
    try {
        getCredentialsStub.returns(null)
        dialogFlowCXContext.init()
    } catch (error) {
        assert.equal(error.message, 'Google key configuration not found')
    }
})

test('init - should return the error message -->  LOCATION_NO_ENCONTRADO', async () => {
    try {
        const credentials: DialogFlowCredentials = {
            project_id: 'your_project_id',
            private_key: 'your_private_key',
            client_email: 'your_client_email',
        }
        getCredentialsStub.returns(credentials)
        dialogFlowCXContext.init()
    } catch (error) {
        assert.equal(error.message, 'LOCATION_NO_ENCONTRADO')
    }
})

test('init - hould return the error message  --> AGENTID_NO_ENCONTRADO', async () => {
    try {
        const credentials: DialogFlowCredentials = {
            project_id: 'your_project_id',
            private_key: 'your_private_key',
            client_email: 'your_client_email',
        }
        dialogFlowCXContext.optionsDX.location = 'Colombia'
        getCredentialsStub.returns(credentials)
        dialogFlowCXContext.init()
    } catch (error) {
        assert.equal(error.message, 'AGENTID_NO_ENCONTRADO')
    }
})

test('init - hould return the error message  --> AGENTID_NO_ENCONTRADO', async () => {
    const credentials: DialogFlowCredentials = {
        project_id: 'your_project_id',
        private_key: 'your_private_key',
        client_email: 'your_client_email',
    }
    dialogFlowCXContext.optionsDX.location = 'Colombia'
    dialogFlowCXContext.optionsDX.agentId = '1222344'
    getCredentialsStub.returns(credentials)
    dialogFlowCXContext.init()
    assert.equal(dialogFlowCXContext.projectId, credentials.project_id)
})

test('Devuelve credenciales de la variable de entorno si el archivo no existe', () => {
    const dialogFlowCXContext = new DialogFlowCXContext(mockDatabase, mockProvider, optionsDX)
    dialogFlowCXContext.googleKeyJson = JSON.stringify({
        project_id: 'your_project_id',
        private_key: 'your_private_key',
        client_email: 'email@email.com',
    })
    const googleKeyFilePath = join(process.cwd(), 'invalid-google-key.json')
    const credentials = dialogFlowCXContext.getCredentials(googleKeyFilePath)
    assert.ok(credentials)
    assert.type(credentials.project_id, 'string')
    assert.type(credentials.private_key, 'string')
    assert.type(credentials.client_email, 'string')
})

test('Devuelve null si no se encuentra el archivo y la variable de entorno no está definida', () => {
    const dialogFlowCXContext = new DialogFlowCXContext(mockDatabase, mockProvider, optionsDX)
    dialogFlowCXContext.googleKeyJson = undefined
    const googleKeyFilePath = join(process.cwd(), 'invalid-google-key.json')
    const credentials = dialogFlowCXContext.getCredentials(googleKeyFilePath)
    assert.equal(credentials, null)
})

test.run()
