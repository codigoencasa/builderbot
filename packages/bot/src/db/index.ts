// export type Context = {
//     from: string
//     keyword: string
//     answer: string
//     ref?: string
//     refSerialize?: string
//     _id?: string
//     options: { [key: string]: any }
// }

class MemoryDB {
    public listHistory: any[] = []

    constructor() {}

    async getPrevByNumber(from: string): Promise<any> {
        const history = this.listHistory
            .slice()
            .reverse()
            .filter((i) => !!i.keyword)
        return history.find((a) => a.from === from)
    }

    async save(ctx: any): Promise<void> {
        this.listHistory.push(ctx)
    }
}

export { MemoryDB }
