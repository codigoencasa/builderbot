const fs = require('fs')
const { sendMessage } = require('../controllers/send')

const sendMessagePost = (req, res) => {
    console.log('asdasdasdasdasd')
    const { message, number } = req.body
    const client = req.clientWs || null;
    sendMessage(client, number, message)
    res.send({ status: 'Enviado!' })
}

const getQr = (req, res) => {
    res.writeHead(200, { 'content-type': 'image/svg+xml' });
    fs.createReadStream(`${__dirname}/../mediaSend/qr-code.svg`).pipe(res);
}

module.exports = { sendMessagePost, getQr }