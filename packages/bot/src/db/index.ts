interface Context {
    from: string
    keyword?: string
}

class MemoryDBClass {
    private listHistory: Context[] = []

    constructor() {}

    getPrevByNumber(from: string): Context | undefined {
        const history = this.listHistory
            .slice()
            .reverse()
            .filter((i): i is Context & { keyword: string } => !!i.keyword)
        return history.find((a) => a.from === from)
    }

    save(ctx: Context): void {
        this.listHistory.push(ctx)
    }
}

export { MemoryDBClass }
