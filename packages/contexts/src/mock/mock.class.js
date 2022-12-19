const { CoreClass } = require('@bot-whatsapp/bot')
/**
 * Necesita extender de core.class
 * handleMsg(messageInComming) //   const { body, from } = messageInComming
 */

class MockContext extends CoreClass {
    constructor(_database, _provider) {
        super(null, _database, _provider)
    }

    init = () => {}

    /**
     * GLOSSARY.md
     * @param {*} messageCtxInComming
     * @returns
     */
    handleMsg = async () => {
        console.log('DEBUG:')
    }
}

module.exports = MockContext
