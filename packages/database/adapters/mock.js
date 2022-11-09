class MockDatabase {
    listHistory = []

    constructor() {}

    save = (ctx) => {
        this.listHistory.push(ctx)
    }
}

module.exports = MockDatabase
