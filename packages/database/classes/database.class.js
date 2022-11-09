class DatabaseClass {
    history = []
    engineDB
    constructor(_engineDB) {
        this.engineDB = _engineDB
    }

    /**
     * Se debe guardar mensaje numero
     * @param {*} ctx
     * @returns
     */
    saveLog = (ctx) => {
        this.history.pop()
        this.history.push(ctx)
        this.engineDB.save(ctx)
        return ctx
    }
}

module.exports = DatabaseClass
