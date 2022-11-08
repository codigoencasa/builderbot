const { test } = require('uvu')
const assert = require('uvu/assert')
const { EventEmitter } = require('node:events')
const { addKeyword } = require('../packages/io')
const database = require('mime-db')

const flow = addKeyword('hola')
    .addAnswer('bienvenido')
    .addAnswer('chao')
    .toJson()

const provider = {
    sendMessage: (ctx) => {
        console.log('Enviando...', ctx)
    },
}
////  DataBaseMock ---------------------------------------------
class DataBaseMock {
    flow
    provider
    constructor(_flow, _provider) {
        this.flow = _flow
        this.provider = _provider
    }

    continue = (message, ref = false) => {
        let keyRef = ref
        let ansRef = null
        if (!keyRef) {
            keyRef = this.flow.find((n) => n.keyword.includes(message)).ref
        }
        ansRef = this.flow.find((n) => n.keyword === keyRef)

        if (ansRef) {
            this.provider.sendMessage(ansRef.answer)
            this.continue(null, ansRef.ref)
        }
    }
}
////  ProviderMock ---------------------------------------------
class ProviderMock {
    constructor() {
        //twilio ...
    }

    sendMessage = (ctx) => {
        console.log('Enviando...', ctx)
    }
}

// const bot = {
//     start: ({ flow, database, provider }) => {
//         // console.log(database instanceof DataBaseMock)
//         const flowCtx = database
//         const botEmitter = new MyEmitter()

//         botEmitter.on('message', (ctx) => flowCtx.continue(ctx.body))
//         return botEmitter
//     },
// }

////  BotMock ---------------------------------------------

// test(`[Flow Basico]: Saludar y Responder`, () => {
//     let messages = []

//     const botBasic = new BotMock(
//         flow,
//         new DataBaseMock(flow, provider),
//         provider
//     )

//     botBasic.on('message', (ctx) => messages.push(ctx.body))

//     // Esta linea emula el llegar un mensaje!
//     botBasic.emit('message', { body: 'hola' })

//     assert.is(messages.join(','), 'hola')
// })

// test.run()

/***
 * NEW
 */

class BotClass extends EventEmitter {
    flowClass
    databaseClass
    providerClass
    constructor(_flow, _database, _provider) {
        super()
        this.flowClass = _flow
        this.databaseClass = _database
        this.providerClass = _provider

        this.on('message', (ctxMessage) => {
            this.databaseClass.saveLog(ctxMessage)
            this.continue(ctxMessage.body)
        })
    }

    continue = (message, ref = false) => {
        const responde = this.flowClass.find(message, ref)
        if (responde) {
            this.providerClass.sendMessage(responde.answer)
            this.continue(null, responde.ref)
        }
    }
}

class ProviderClass {
    constructor() {}

    sendMessage = (message) => {
        console.log('Enviar...', message)
    }
}

class FlowClass {
    flow
    constructor(_flow) {
        this.flow = _flow
    }

    find = (message, ref = false) => {
        let keyRef = ref
        let ansRef = null
        if (!keyRef) {
            keyRef =
                this.flow.find((n) => n.keyword.includes(message))?.ref || null
        }
        ansRef = this.flow.find((n) => n.keyword === keyRef)
        if (ansRef) return ansRef
        return false
    }
}

class DatabaseClass {
    constructor() {}

    saveLog = (ctx) => {
        console.log('Guardando...', ctx)
    }
}

test(`[Flow Basico]: Saludar y Responder`, () => {
    let messages = []

    const botBasic = new BotClass(
        new FlowClass(flow),
        new DatabaseClass(),
        new ProviderClass()
    )

    botBasic.on('message', (ctx) => messages.push(ctx.body))

    botBasic.emit('message', { body: 'hola' })

    assert.is(messages.join(','), 'hola')
})

test.run()
