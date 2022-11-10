class MockDatabase {
    listHistory = []

    constructor() {}

    save = (ctx) => {
        console.log('Guardando DB...', ctx)
        this.listHistory.push(ctx)
    }
}

module.exports = MockDatabase
