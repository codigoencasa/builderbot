const { EventEmitter } = require('node:events')
const polka = require('polka')
const { urlencoded } = require('body-parser')
const { parseNumber } = require('./utils')

class TwilioWebHookServer extends EventEmitter {
    incomingMsg = (req, res) => {
        const { body } = req
        this.emit('message', {
            from: parseNumber(body.From),
            to: parseNumber(body.To),
            body: body.Body,
        })
        const json = JSON.stringify({ body })
        res.end(json)
    }

    start = () => {
        polka()
            .use(urlencoded({ extended: true }))
            .post('/hook', this.incomingMsg)
            .listen(3000, () => {
                console.log(`> Running on localhost:3000 /hook`)
            })
    }
}

module.exports = TwilioWebHookServer
