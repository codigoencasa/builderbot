const polka = require('polka')
const parsePolka = require('@polka/parse')

class WebHookServer {
    incomingMsg = (req, res, next) => {
        const { body } = req
        let json = JSON.stringify({ error: 'Missing CSRF token', body })
        res.end(json)
    }

    start = () => {
        polka()
            .use(parsePolka.urlencoded({ extended: false }))
            .post('/hook', this.incomingMsg)
            .listen(3000, () => {
                console.log(`> Running on localhost:3000 /hook`)
            })
    }
}

module.exports = WebHookServer
