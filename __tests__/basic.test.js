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
    /**
     * Emitter para tener on and emit
     */

    flowClass
    databaseClass
    providerClass
    constructor(_flow, _database, _provider) {
        super()
        this.flowClass = _flow
        this.databaseClass = _database
        this.providerClass = _provider
    }

    continue = () => {
        const r = this.flowClass.find()
        if (r) {
            this.provider.sendMessage(r.answer)
            this.continue(null, r.ref)
            console.log(r)
        }
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
            keyRef = this.flow.find((n) => n.keyword.includes(message)).ref
        }
        ansRef = this.flow.find((n) => n.keyword === keyRef)
        if (ansRef) return ansRef
        return false
    }
}

test(`[Flow Basico]: Saludar y Responder`, () => {
    let messages = []

    const botBasic = new BotClass(new FlowClass(flow), null, null)

    botBasic.on('message', (ctx) => messages.push(ctx.body))

    // Esta linea emula el llegar un mensaje!
    botBasic.emit('message', { body: 'hola' })

    assert.is(messages.join(','), 'hola')
})

test.run()
