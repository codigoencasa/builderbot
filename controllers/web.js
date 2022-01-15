const { sendMessage } = require('../controllers/send')

const sendMessagePost = (req, res) => {
    const { message, number } = req.body
    const client = req.clientWs || null;
    sendMessage(client, number, message)
    res.send({ status: 'Enviado!' })
}

module.exports = { sendMessagePost }