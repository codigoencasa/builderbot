class DatabaseClass {
    engineDB
    constructor(_engineDB) {
        this.engineDB = _engineDB
    }

    saveLog = (ctx) => {
        this.engineDB.save(ctx)
        return ctx
    }
}

module.exports = DatabaseClass
