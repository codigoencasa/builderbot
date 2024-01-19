/**
 * Si necesitas saber que trae el "ctx"
 * Puedes ver el README.md dentro packages/database
 */

import { History } from '../types'

class MockDatabase {
    db: any
    listHistory: History[] = []

    constructor() {}

    getPrevByNumber = (from: string) => {
        const history = this.listHistory
            .slice()
            .reverse()
            .filter((i) => !!i.keyword)
        return history.find((a) => a.from === from)
    }

    save = (ctx): void => {
        this.listHistory.push(ctx)
    }
}

export { MockDatabase }
