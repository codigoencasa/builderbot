module.exports = (socket) => {
    return {
        sendQR:(qr) => {
            socket.emit('connection_qr',{
                qr
            })
        },
        sendStatus:() => {
            socket.emit('connection_status',{
                a:1
            })
        }
    }

}

