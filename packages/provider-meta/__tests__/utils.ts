export const listen = function (app: any, host?: any) {
    app.listen() // boots
    let { port } = app.server.address()
    return `http://${host || 'localhost'}:${port}`
}
