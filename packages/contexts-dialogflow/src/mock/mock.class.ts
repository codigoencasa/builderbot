import { CoreClass } from '@builderbot/bot'

export class MockContext extends CoreClass {
    constructor(_database, _provider) {
        super(null, _database, _provider, null)
    }

    init = () => {}

    /**
     * GLOSSARY.md
     * @param {*} messageCtxInComming
     * @returns
     */
    handleMsg = async (): Promise<any> => {
        console.log('DEBUG:')
    }
}
