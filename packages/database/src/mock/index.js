class MockDatabase {
    listHistory = []

    constructor() {
        /**
         * Se debe cargar listHistory con historial de mensajes
         * para que se pueda continuar el flow
         */
    }

    save = (ctx) => {
        console.log('Guardando DB...', ctx)
        this.listHistory.push(ctx)
    }
}

module.exports = MockDatabase
