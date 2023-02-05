/**
 * Si necesitas saber que trae el "ctx"
 * Puedes ver el README.md dentro packages/database
 */

class MockDatabase {
    db
    listHistory = []

    constructor() {}

    getPrevByNumber = (from) => {
        const history = this.listHistory
            .slice()
            .reverse()
            .filter((i) => !!i.keyword)
        return history.find((a) => a.from === from)
    }

    save = (ctx) => {
        this.listHistory.push(ctx)
    }
}

module.exports = MockDatabase
